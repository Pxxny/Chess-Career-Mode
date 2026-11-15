import { playerOpponentId } from "@/game/match/tournament";
import type { GameSave,Npc,SkillKey } from '@/types';
import { systemsOf, type TeamStrategy } from './systems';
import { gameDay } from '@/game/competition/agenda';
import { regionForSave } from '@/game/world/schedule';
import { getSchedule, preserveBookedVenues } from '@/game/world/schedule';
import { registrationWindow } from '@/game/competition/registrationWindow';
import { registrationIssue } from '@/game/competition/eligibility';
import { registerForEvent } from '@/game/match/registration';
import { buildEventTeams } from '@/game/competition/teamEvents';
import { teamSpec,resolveTeamEvent } from '@/data/chess/nationalTeamEvents';
import { emptyRelationship,socialOf } from '@/game/social/relationships';
import { news } from './expansion';
import { highlightsOf } from './highlights';
import { applyJetlag } from '@/game/competition/travel';
export type CareerCommand =
 | {type:'travel-class';value:'economy'|'business'}
 | {type:'queue';eventId:string} | {type:'unqueue';eventId:string}
 | {type:'found-academy';name:string} | {type:'enroll';npcId:string;focus:SkillKey} | {type:'mentor';npcId:string} | {type:'graduate';npcId:string}
 | {type:'captain';key:string;order:string[];strategy:TeamStrategy}
 | {type:'press';id:string;npcId:string;eventId:string;phase:'pre'|'post';answer:'respect'|'confident'|'challenge'};
export type CareerCommandResult={ok:true;save:GameSave;changed:Npc[];message:string}|{ok:false;error:string};
export function isCaptain(save:GameSave,npcs:Npc[]) {
 return !npcs.some(n=>n.nationality===save.player.country&&['active','semi-retired'].includes(n.careerStatus)&&n.currentElo>save.player.rating);
}
export const academyUnlocked=(s:GameSave)=>s.player.rating>=1800||s.world.date.year-s.career.startYear>=3;
const cap=(n:number)=>Math.max(0,Math.min(100,n));
export function careerCommand(save:GameSave,npcs:Npc[],command:CareerCommand):CareerCommandResult {
 let state=systemsOf(save),next=save,changed:Npc[]=[];const day=gameDay(save);
 const fail=(error:string):CareerCommandResult=>({ok:false,error});
 if(save.pendingMatch&& !['queue','unqueue'].includes(command.type))return fail('Finish your current match first.');
 if(command.type==='travel-class')state={...state,travelClass:command.value};
 else if(command.type==='queue') {
  if(state.queue.some(q=>q.eventId===command.eventId))return fail('This event is already in your queue.');
  if(state.queue.filter(q=>q.status==='waiting'||q.status==='blocked').length>=10)return fail('Your queue holds up to 10 events.');
  const event=preserveBookedVenues(save,getSchedule(save.world.date,regionForSave(save),save.career.id,52)).find(e=>e.id===command.eventId);
  if(!event)return fail('This event is no longer on the calendar.');
  if(save.registrations.some(r=>r.eventId===event.id))return fail('Already registered.');
  state={...state,queue:[...state.queue,{eventId:event.id,name:event.name,status:'waiting' as const}].slice(-20)};
 } else if(command.type==='unqueue')state={...state,queue:state.queue.filter(q=>q.eventId!==command.eventId)};
 else if(command.type==='found-academy') {
  if(state.academy)return fail('Your academy is already open.');
  if(!academyUnlocked(save))return fail('Reach 1800 Elo or complete three career years.');
  if(save.player.money<3000)return fail('Opening an academy costs $3,000.');
  state={...state,academy:{name:command.name.trim().slice(0,60)||`${save.player.city.name} Chess Academy`,city:save.career.city.name,country:save.career.countryCode,founded:day,income:0,students:[]}};
  next={...next,player:{...next.player,money:next.player.money-3000}};
 } else if(command.type==='enroll') {
  const academy=state.academy,npc=npcs.find(n=>n.id===command.npcId);
  if(!academy||!npc||npc.age>=16||npc.age<7||npc.careerStatus!=='active')return fail('Choose an active wonderkid aged 7–15.');
  if(academy.students.length>=3||academy.students.some(s=>s.id===npc.id))return fail('Your academy has up to three students.');
  if(!Object.hasOwn(save.player.skills,command.focus))return fail('Unknown training focus.');
  const style: import('@/types').PlayStyle = save.player.tendencies.aggression>=65?'attacking':save.player.tendencies.aggression<=35?'solid':save.player.tendencies.complexity>=65?'dynamic':'universal';
  state={...state,academy:{...academy,students:[...academy.students,{id:npc.id,joined:day,lastLesson:day-7,focus:command.focus,style,seenPrizes:npc.tournamentHistory.map(t=>`${t.eventId??t.event}:${t.year}`)}]}};
  changed=[{...npc,training:{...npc.training,hasCoach:true,focus:command.focus}}];
 } else if(command.type==='mentor') {
  const academy=state.academy,student=academy?.students.find(s=>s.id===command.npcId),npc=npcs.find(n=>n.id===command.npcId);
  if(!academy||!student||!npc)return fail('Student not found.');
  if(day-student.lastLesson<7)return fail('One mentorship session per student each week.');
  if(save.player.ap.current<2||save.player.money<25)return fail('A lesson needs 2 AP and $25.');
  const lessons=(student.lessons??0)+1;
  changed=[{...npc,style:student.style,potentialRating:Math.min(3000,Math.max(npc.currentElo,npc.potentialRating)+4),morale:cap(npc.morale+3),training:{...npc.training,focus:student.focus,hasCoach:true,weeklyHours:Math.min(40,npc.training.weeklyHours+1)},strengths:lessons>=4&&!npc.strengths.includes(student.focus)?[...npc.strengths,student.focus]:npc.strengths,weaknesses:lessons>=4?npc.weaknesses.filter(k=>k!==student.focus):npc.weaknesses}];
  state={...state,academy:{...academy,students:academy.students.map(s=>s.id===student.id?{...s,lastLesson:day,lessons}:s)}};
  next={...next,player:{...next.player,money:next.player.money-25,ap:{...next.player.ap,current:next.player.ap.current-2}}};
 } else if(command.type==='graduate') {
  if(state.academy)state={...state,academy:{...state.academy,students:state.academy.students.filter(s=>s.id!==command.npcId)}};
 } else if(command.type==='captain') {
  if(!isCaptain(save,npcs))return fail('The highest-rated active player in your federation is captain.');
  const spec=teamSpec(command.key);if(!spec)return fail('Unknown national team event.');
  const home=buildEventTeams(save,npcs,resolveTeamEvent(spec,save.world.date.year)).find(t=>t.country===save.player.country);
  if(!home?.players.some(p=>p.id==='player'))return fail('You need a starting-board place.');
  if(command.order.length!==home.players.length||new Set(command.order).size!==command.order.length||command.order.some(id=>!home.players.some(p=>p.id===id)))return fail('Keep the selected starting roster and its board quotas.');
  if(!['balanced','anchor','attack'].includes(command.strategy))return fail('Unknown team strategy.');
  state={...state,captain:{...state.captain,[command.key]:{order:command.order,strategy:command.strategy}}};
 } else if(command.type==='press') {
  const id=`${command.phase}:${command.eventId}:${command.id}`,npc=npcs.find(n=>n.id===command.npcId),t=save.tournament;
  if(state.press[id])return fail('This interview is already recorded.');
  if(!npc||!t||t.eventId!==command.eventId||!['international','elite'].includes(t.level))return fail('Interviews are available at major tournaments.');
  const post=command.phase==='post';
  if(!post&&(t.status!=='playing'||command.id!==String(t.round)||playerOpponentId(t)?.id!==npc.id))return fail('Only the announced opponent can be interviewed before this round.');
  if(post&&command.id!==save.matches.at(-1)?.id)return fail('Choose the completed match for this interview.');
  if(post&&!(save.matches.at(-1)?.setup.tournament?.id===t.eventId))return fail('Finish the match before giving this interview.');
  const answer=command.answer;if(!['respect','confident','challenge'].includes(answer))return fail('Unknown interview answer.');
  const changes={respect:{morale:2,closeness:4,opponent:1,text:'shows respect for'},confident:{morale:4,closeness:0,opponent:0,text:'backs their preparation against'},challenge:{morale:3,closeness:-6,opponent:4,text:'raises the stakes against'}}[answer];
  const social=socialOf(save),rel=social.relationships[npc.id]??emptyRelationship(npc.id);
  next={...next,player:{...next.player,morale:cap(next.player.morale+changes.morale)},social:{...social,relationships:{...social.relationships,[npc.id]:{...rel,closeness:cap(rel.closeness+changes.closeness),familiarity:cap(rel.familiarity+2)}}}};
  changed=[{...npc,morale:cap(npc.morale+changes.opponent)}];
  const headline=`${save.player.name} ${changes.text} ${npc.name}`;
  next=news(next,`press:${id}`,headline,post?'Post-match interview':'Pre-match interview');
  const h=highlightsOf(next);next={...next,highlights:{...h,seen:[...h.seen,`press:${id}`],items:[...h.items,{id:`press:${id}`,kind:'press',event:t.name,eventId:t.eventId,headline,body:`${post?'After':'Before'} the match at ${t.name}, ${save.player.name} chose a ${answer} response. Morale ${changes.morale>=0?'+':''}${changes.morale}; relationship ${changes.closeness>=0?'+':''}${changes.closeness}.`,...save.world.date,day:save.world.day}]}};
  state={...state,press:{...state.press,[id]:answer}};
 }
 if(next.player.money!==save.player.money)next={...next,history:{...next.history,ledger:[...next.history.ledger,{...save.world.date,id:`activity:${command.type}:${day}:${save.history.ledger.length}`,kind:'expense' as const,label:`Career: ${command.type}`,amount:next.player.money-save.player.money}].slice(-200)}};
 const result={...next,careerSystems:state};
 return {ok:true,save:command.type==='queue'?settleActivities(result,npcs).save:result,changed,message:'Saved.'};
}
/** Settle only recorded new prize payments, never estimate past winnings. */
export function settleActivities(save:GameSave,npcs:Npc[]):{save:GameSave;changed:Npc[]} {
 let next=applyJetlag(save),state=systemsOf(next),changed=false;const day=gameDay(save);
 if(state.academy) {
  let income=0;const students=state.academy.students.map(student=>{
   const npc=npcs.find(n=>n.id===student.id);if(!npc)return student;
   const fresh=npc.tournamentHistory.filter(t=>t.prize!==undefined&&!student.seenPrizes.includes(`${t.eventId??t.event}:${t.year}`));
   if(!fresh.length)return student;
   income+=fresh.reduce((sum,t)=>sum+Math.floor((t.prize??0)*.1),0);changed=true;
   return {...student,seenPrizes:[...student.seenPrizes,...fresh.map(t=>`${t.eventId??t.event}:${t.year}`)].slice(-300)};
  });
  if(changed)state={...state,academy:{...state.academy,students,income:state.academy.income+income}};
  if(income)next=news(activityFunds(next,income,'Academy prize income'),`academy:${day}`,'Academy prize income',`Your students earned a recorded prize. Academy share: $${income}.`);
 }
 const rosterIds=new Set(next.esports?.team?.members.map(m=>m.id)??[]);
 const expired=new Set(state.contracts.filter(c=>c.end<=day).map(c=>c.npcId));
 if(expired.size&&next.esports?.team){next={...next,esports:{...next.esports,team:{...next.esports.team,members:next.esports.team.members.filter(m=>!expired.has(m.id))}}};changed=true;}
 const contracts=state.contracts.filter(c=>rosterIds.has(c.npcId));
 let wages=0;const paid=contracts.map(c=>{const week=Math.floor(Math.min(day,c.end)/7),due=Math.max(0,week-c.paidWeek)*c.salary;if(!due)return c;wages+=due;changed=true;return {...c,paidWeek:week};});
 if(wages) {
  if(next.player.money>=wages)next=activityFunds(next,-wages,"Roster weekly salaries");
  else {next=news(next,`wages:${day}`,'Roster salaries unpaid','Paid recruits left after their weekly salaries could not be paid. Existing tournament bookings retain their submitted rosters.');const ids=new Set(paid.map(c=>c.npcId));if(next.esports?.team)next={...next,esports:{...next.esports,team:{...next.esports.team,members:next.esports.team.members.filter(m=>!ids.has(m.id))}}};paid.length=0;}
 }
 const activeContracts=paid.filter(c=>c.end>day);
 if(activeContracts.length!==state.contracts.length)changed=true;
 if(changed)state={...state,contracts:activeContracts};
 if(state.queue.some(q=>q.status==='waiting'||q.status==='blocked')) {
  const events=new Map(preserveBookedVenues(next,getSchedule(next.world.date,regionForSave(next),next.career.id,52)).map(e=>[e.id,e]));
  const queue=state.queue.map(q=>{
   if(q.status==='registered'||q.status==='expired')return q;
   if(next.registrations.some(r=>r.eventId===q.eventId)){changed=true;return {...q,status:'registered' as const,reason:undefined};}
   const event=events.get(q.eventId);if(!event||registrationWindow(next,event).status==='closed'){changed=true;return {...q,status:'expired' as const,reason:'Registration closed'};}
   if(registrationWindow(next,event).status==='upcoming')return q;
   const issue=registrationIssue(next,event,npcs);
   if(issue){if(q.status!=='blocked'||q.reason!==issue)changed=true;return {...q,status:'blocked' as const,reason:issue};}
   const result=registerForEvent(next,event,npcs);if(result.ok){next=result.save;changed=true;return {...q,status:'registered' as const,reason:undefined};}changed=true;return {...q,status:'blocked' as const,reason:result.error};
  });state={...state,queue};
 }
 return {save:changed?{...next,careerSystems:state}:next,changed:[]};
}

function activityFunds(save:GameSave,amount:number,label:string):GameSave {return {...save,player:{...save.player,money:save.player.money+amount},history:{...save.history,ledger:[...save.history.ledger,{...save.world.date,id:`activity:${gameDay(save)}:${save.history.ledger.length}`,kind:amount<0?'expense' as const:'other' as const,amount,label}].slice(-200)}};}
