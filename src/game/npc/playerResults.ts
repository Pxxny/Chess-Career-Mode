import type {GameResult,Npc} from '@/types';
import {applyNpcResult} from './results';
export const ratedGameMoment=(game:GameResult,day=1)=>(game.year*364+(game.week-1)*7+(game.day??day)-1)*1440+(game.tournamentRound??(1000+Number(/^g(\d+)/.exec(game.id)?.[1]??0)/1e6));
/** Used for every newly committed rated player game. Loading old saves never replays old ratings. */
export function applyNpcPlayerGame(npc:Npc,game:GameResult,day=1,playerName='Career player'):Npc {
 const id=`player:${game.id}`;
 if(game.opponentId!==npc.id||npc.appliedPlayerGames?.includes(id))return npc;
 const next=applyNpcResult(npc,game.outcome==='win'?'loss':game.outcome==='loss'?'win':'draw',game.ratingBefore,{ratingBefore:game.opponentElo,id,at:ratedGameMoment(game,day)});
 return {...next,appliedPlayerGames:[...(npc.appliedPlayerGames??[]),id].slice(-4096),ratingHistory:[...(npc.ratingHistory??[]),{id,year:game.year,week:game.week,day:game.day??day,before:npc.currentElo,elo:next.currentElo,...(game.tournamentId?{eventId:game.tournamentId}:{}),event:game.tournamentName??'Rated match',opponent:playerName}].slice(-1000)};
}
