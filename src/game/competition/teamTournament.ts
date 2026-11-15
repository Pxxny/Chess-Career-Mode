import { getCountry } from '@/data/world/countries';
import { teamInfoOf, teamSpec } from '@/data/chess/nationalTeamEvents';
import { stateOf, cupKey, type NationalTeam, type TeamCup } from '@/game/career/expansion';
import { createRng, mixSeed } from '@/game/rng';
import { npcActor, playerActor } from '@/game/prediction/adapters';
import { systemsOf } from '@/game/career/systems';
import { highestTitle } from '@/game/match/setup';
import type { ActiveTournament, EventRegistration, GameSave, Npc, TournamentPairing, TournamentPlayer } from '@/types';
import { buildEventTeams, swissPairs, teamPrize } from './teamEvents';
import { eventAgenda, gameDay, dayStamp } from './agenda';

const strength = (t: NationalTeam) => t.players.reduce((sum,p)=>sum+p.elo,0);
export function teamStandings(t: ActiveTournament): NationalTeam[] {
  return [...(t.team?.teams ?? [])].sort((a,b)=>b.points-a.points || b.boardPoints-a.boardPoints || strength(b)-strength(a) || a.country.localeCompare(b.country));
}

/** Creates rosters and zero scores only. Starting an edition never settles its results. */
export function createTeamTournament(save: GameSave, reg: EventRegistration, npcs: Npc[], seed: number):
  {ok:true;tournament:ActiveTournament} | {ok:false;error:string} {
  const info=teamInfoOf(reg.details), spec=teamSpec(info.key), expansion=stateOf(save);
  if (!spec || spec.abstract) return {ok:false,error:'This national team event cannot be entered by the player.'};
  if (expansion.membershipYear!==reg.year) return {ok:false,error:'Join your federation for this year first.'};
  if (expansion.cups.some(c=>c.year===reg.year&&cupKey(c)===info.key&&c.represented)) return {ok:false,error:'This year’s national team cup is already finished.'};
  const teams=buildEventTeams(save,npcs,info), home=teams.find(t=>t.country===save.player.country);
  if (!home?.players.some(p=>p.id==='player')) return {ok:false,error:'National team starting-roster selection required.'};
  if (teams.length<2) return {ok:false,error:'At least two national teams are needed.'};
  if (save.player.ap.current<2) return {ok:false,error:'Representing your country costs 2 AP.'};
  const byNpc=new Map(npcs.map(n=>[n.id,n])), plan=systemsOf(save).captain[info.key];
  const players: TournamentPlayer[]=teams.flatMap(team=>{
    const members=[...team.players,...(team.reserves??[])];
    for(let i=team.players.length;i<info.boards;i++) members.push({id:`unfilled:${team.country}:${i}`,name:`Unfilled board (${team.country})`,elo:0});
    return members.map(member=>{
      const npc=byNpc.get(member.id), board=team.players.findIndex(p=>p.id===member.id);
      let actor=member.id==='player'?playerActor(save):npc?npcActor(npc):undefined;
      if(actor&&team===home&&plan&&member.id!=='player') {
        if(plan.strategy==='anchor'&&board===0)actor={...actor,style:'solid'};
        if(plan.strategy==='attack'&&board>=Math.floor(info.boards/2))actor={...actor,style:'attacking'};
      }
      return {id:member.id,name:member.name,elo:member.elo,title:member.id==='player'?highestTitle(save):npc?.title??'none',countryCode:team.country,isPlayer:member.id==='player',points:0,opponents:[],colors:[],predictionActor:actor};
    });
  });
  const format=teams.length<=12?'round-robin':'swiss';
  const rounds=format==='round-robin'?(teams.length%2?teams.length:teams.length-1):Math.min(spec.rounds,teams.length-1);
  const agenda=eventAgenda({details:{...reg.details!,rounds},fieldSize:teams.length});
  return {ok:true,tournament:{eventId:reg.eventId,name:reg.name,level:reg.level,year:reg.year,week:reg.week,round:1,rounds,status:'playing',entryFee:reg.entryFee,prizeFund:spec.prize,timeControl:reg.details!.timeControl,seed,players,pairings:[],finalRank:null,prize:0,startedOnDay:gameDay(save),details:{...reg.details!,rounds,agenda,end:dayStamp(gameDay(save)+agenda.days-1)},team:{info,country:home.country,format,teams}}};
}

/** One fixture per federation per round, with a separate game on every board. */
export function pairTeamRound(t: ActiveTournament): TournamentPairing[] {
  const state=t.team!, teams=state.teams, fixtures:Array<[NationalTeam,NationalTeam|null]>=[];
  if(state.format==='round-robin') {
    const circle:Array<NationalTeam|null>=[...teams];
    if(circle.length%2)circle.push(null);
    for(let i=0;i<t.round-1;i++)circle.splice(1,0,circle.pop()!);
    for(let i=0;i<circle.length/2;i++) {
      const a=circle[i], b=circle[circle.length-1-i];
      if(a||b)fixtures.push(a?[a,b]:[b!,null]);
    }
  } else {
    const indexes=new Map(teams.map((team,i)=>[team.country,i])), played=new Set<string>(), byes=new Set<number>();
    for(const p of t.pairings.flat())if(p.teamMatch){const a=indexes.get(p.teamMatch.a)!;if(p.teamMatch.b===null)byes.add(a);else{const b=indexes.get(p.teamMatch.b)!;played.add(a<b?`${a}-${b}`:`${b}-${a}`);}}
    const order=teamStandings(t).map(team=>indexes.get(team.country)!);
    const pairing=swissPairs(order,played,byes,t.round);
    for(const [a,b] of pairing.pairs)fixtures.push([teams[a],teams[b]]);
    if(pairing.bye!==null)fixtures.push([teams[pairing.bye],null]);
  }
  const rng=createRng(mixSeed(t.seed,0x2000+t.round));
  const lineup=(team:NationalTeam)=>{
    const members=team.players.slice(0,state.info.boards), reserve=team.reserves?.[0];
    // A selected human keeps their board. NPCs can rotate their reserve as before.
    if(reserve&&members.length&&members.at(-1)!.id!=='player'&&rng.next()<.2)members[members.length-1]=reserve;
    return Array.from({length:state.info.boards},(_,i)=>members[i]?.id??`unfilled:${team.country}:${i}`);
  };
  return fixtures.flatMap(([a,b])=>{
    const la=lineup(a), lb=b?lineup(b):[];
    return la.map((id,board):TournamentPairing=>{
      const metadata={a:a.country,b:b?.country??null,board:board+1};
      if(!b)return {white:id,black:'bye',result:state.format === 'swiss' ? 0.5 : 0,teamMatch:metadata};
      const flip=(t.round+board)%2===0, white=flip?lb[board]:id, black=flip?id:lb[board];
      const wEmpty=white.startsWith('unfilled:'), bEmpty=black.startsWith('unfilled:');
      return {white,black,result:wEmpty?(bEmpty ? .5 : 0):bEmpty?1:null,teamMatch:metadata};
    });
  });
}

/** Called once after all board results in this round have been resolved. */
export function scoreTeamRound(t: ActiveTournament): ActiveTournament {
  const state=t.team!, teams=state.teams.map(team=>({...team})), countries=new Map(t.players.map(p=>[p.id,p.countryCode]));
  const fixtures=new Map<string,TournamentPairing[]>();
  for(const p of t.pairings[t.round-1]??[])if(p.teamMatch){const key=`${p.teamMatch.a}:${p.teamMatch.b}`;fixtures.set(key,[...(fixtures.get(key)??[]),p]);}
  for(const boards of fixtures.values()) {
    if(boards.some(p=>p.result===null))continue;
    const meta=boards[0].teamMatch!, a=teams.find(team=>team.country===meta.a)!;
    if(meta.b===null){if(state.format==='swiss'){a.points+=2;a.boardPoints+=state.info.boards/2;}continue;}
    const b=teams.find(team=>team.country===meta.b)!, score=boards.reduce((sum,p)=>sum+(countries.get(p.white)===a.country?p.result!:1-p.result!),0), half=state.info.boards/2;
    a.boardPoints+=score;b.boardPoints+=state.info.boards-score;
    a.points+=score>half?2:score===half?1:0;b.points+=score<half?2:score===half?1:0;
  }
  return {...t,team:{...state,teams}};
}

export function finishTeamTournament(t: ActiveTournament): ActiveTournament {
  const ranked=teamStandings(t), rank=ranked.findIndex(team=>team.country===t.team!.country);
  return {...t,status:'finished',finalRank:rank+1,prize:t.withdrawn?0:teamPrize(teamSpec(t.team!.info.key)!,rank,ranked.length)};
}

/** Keeps the established national-team archive. Payment is made by recordTournament once. */
export function recordPlayableTeamCup(save:GameSave,t:ActiveTournament):GameSave {
  if(!t.team||t.status!=='finished')return save;
  const state=stateOf(save), info=t.team.info;
  if(state.cups.some(c=>c.year===t.year&&cupKey(c)===info.key&&c.represented))return save;
  const players=new Map(t.players.map(p=>[p.id,p]));
  const cup:TeamCup={playable:true,playedOnDay:t.startedOnDay,year:t.year,key:info.key,name:t.name,teams:teamStandings(t),boards:t.pairings.flatMap((round,index)=>round.filter(p=>p.result!==null&&p.black!=='bye'&&p.teamMatch&&(p.teamMatch.a===t.team!.country||p.teamMatch.b===t.team!.country)).map(p=>({round:index+1,white:players.get(p.white)!.name,black:players.get(p.black)!.name,whiteId:p.white,blackId:p.black,whiteElo:players.get(p.white)!.elo,blackElo:players.get(p.black)!.elo,score:p.result!,forfeit:p.white.startsWith('unfilled:')||p.black.startsWith('unfilled:'),prediction:p.prediction}))),represented:true,prize:t.prize,boardsPerTeam:info.boards,reserves:info.reserves,rounds:t.rounds,format:t.team.format,teamCount:t.team.teams.length};
  return {...save,expansion:{...state,cups:[...state.cups.filter(c=>!(c.year===t.year&&cupKey(c)===info.key)),cup].slice(-24)}};
}

export const teamName=(country:string)=>getCountry(country)?.name??country;
