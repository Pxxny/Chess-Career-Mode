import type { GameSave,Npc } from '@/types';
import { gameDay } from '@/game/competition/agenda';
export function transferWindow(save:GameSave) {const day=gameDay(save)%364;return day<28||(day>=182&&day<210);}
export function transferQuote(save:GameSave,npc:Npc) {
 const recent=(npc.recentGames??[]).slice(-5),score=recent.length?recent.reduce((s,g)=>s+(g.outcome==='win'?1:g.outcome==='draw'?.5:0),0)/recent.length:.5;
 const fee=Math.round(Math.max(40,(npc.currentElo-800)*.45+npc.form*2+score*160+(save.player.reputation>60?100:0)));
 return {fee,salary:Math.round(Math.max(5,fee*.045)),days:182,form:Math.round(score*100)};
}
