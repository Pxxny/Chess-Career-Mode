import type {GameResult,Npc} from '@/types';
import {applyNpcResult} from './results';
/** Used for every newly committed rated player game. Loading old saves never replays old ratings. */
export function applyNpcPlayerGame(npc:Npc,game:GameResult,day=1,playerName='Career player'):Npc {
 const id=`player:${game.id}`;
 if(game.opponentId!==npc.id||npc.appliedPlayerGames?.includes(id))return npc;
 const next=applyNpcResult(npc,game.outcome==='win'?'loss':game.outcome==='loss'?'win':'draw',game.ratingBefore,{ratingBefore:game.opponentElo});
 return {...next,appliedPlayerGames:[...(npc.appliedPlayerGames??[]),id].slice(-4096),ratingHistory:[...(npc.ratingHistory??[]),{id,year:game.year,week:game.week,day:game.day??day,before:npc.currentElo,elo:next.currentElo,...(game.tournamentId?{eventId:game.tournamentId}:{}),event:game.tournamentName??'Rated match',opponent:playerName}].slice(-1000)};
}
