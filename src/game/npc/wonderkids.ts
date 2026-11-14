import {ratedGameMoment} from "./playerResults";
import type {GameSave,Npc,NpcRecentGame} from '@/types';
import {npcActor,playerActor} from '@/game/prediction/adapters';
export const YOUTH_GROUPS=[10,12,14,16] as const;
export interface YouthEntry {id:string;name:string;age:number;country:string;elo:number;form:number;skills:number;recent:NpcRecentGame[];npc?:Npc;score:number;hot:'Hot Kid'|'Cold Kid'|null;}
export interface WonderkidModel {groups:Map<number,YouthEntry[]>;overall:YouthEntry[];candidates:YouthEntry[];tags:Map<string,{groups:Array<{age:number;rank:number}>;overall?:number;hot:YouthEntry['hot']}>;}
const scoreOf=(o:string)=>o==='win'?1:o==='draw'?.5:0;
const clamp=(v:number)=>Math.min(100,Math.max(0,v));
const mean=(values:number[])=>values.reduce((s,n)=>s+n,0)/Math.max(1,values.length);
const byElo=(a:YouthEntry,b:YouthEntry)=>b.elo-a.elo||a.id.localeCompare(b.id);
export function youthMetrics(elo:number,form:number,skills:number,recent:NpcRecentGame[]){
 const last=recent.slice(-5),points=last.reduce((s,g)=>s+scoreOf(g.outcome),0),complete=last.length===5;
 return {score:complete?Math.round((35*points/5+.25*clamp(form)+.25*clamp(skills)+.15*clamp((elo-400)/26))*100)/100:0,hot:complete&&points>=4&&form>=55?'Hot Kid' as const:complete&&points<=1&&form<=45?'Cold Kid' as const:null};
}
const cache=new WeakMap<Npc[],WeakMap<GameSave,WonderkidModel>>();
export function wonderkids(save:GameSave,npcs:Npc[]):WonderkidModel {
 let perSave=cache.get(npcs);if(!perSave){perSave=new WeakMap();cache.set(npcs,perSave);}const cached=perSave.get(save);if(cached)return cached;
 const playerGames=save.history.games.map(g=>({id:`player:${g.id}`,outcome:g.outcome,opponentElo:g.opponentElo,ratingBefore:g.ratingBefore,at:ratedGameMoment(g)}));
 const againstPlayer=new Map<string,NpcRecentGame[]>();for(const [i,g] of save.history.games.entries())if(g.opponentId){const rows=againstPlayer.get(g.opponentId)??[];rows.push({...playerGames[i],outcome:g.outcome==='win'?'loss':g.outcome==='loss'?'win':'draw',opponentElo:g.ratingBefore,ratingBefore:g.opponentElo});againstPlayer.set(g.opponentId,rows.slice(-5));}
 const candidates:YouthEntry[]=npcs.filter(n=>n.age>0&&n.age<16&&(n.careerStatus==='active'||n.careerStatus==='semi-retired')).map(n=>{
  const known=new Map<string,NpcRecentGame>();for(const [i,g] of [...(againstPlayer.get(n.id)??[]),...(n.recentGames??[])].entries())known.set(g.id??`untagged:${i}`,g);const recent=[...known.values()].sort((a,b)=>a.at-b.at).slice(-5),skills=recent.length===5?mean(Object.values(npcActor(n).skills??{})):0,metrics=youthMetrics(n.currentElo,n.form,skills,recent);
  return {id:n.id,name:n.name,age:n.age,country:n.nationality,elo:n.currentElo,form:n.form,skills,recent,npc:n,...metrics};
 });
 if(save.player.age>0&&save.player.age<16){const actor=playerActor(save),skills=mean(Object.values(actor.skills??{})),recent=playerGames.slice(-5),form=actor.form??50;candidates.push({id:'player',name:save.player.name,age:save.player.age,country:save.player.country,elo:save.player.rating,form,skills,recent,...youthMetrics(save.player.rating,form,skills,recent)});}
 const groups=new Map(YOUTH_GROUPS.map(age=>[age,candidates.filter(c=>c.age<age).sort(byElo).slice(0,100)])),overall=candidates.filter(c=>c.recent.length===5).sort((a,b)=>b.score-a.score||byElo(a,b)).slice(0,20);
 const tags:WonderkidModel['tags']=new Map();for(const c of candidates)tags.set(c.id,{groups:[],hot:c.hot});for(const [age,rows] of groups)rows.forEach((c,i)=>tags.get(c.id)!.groups.push({age,rank:i+1}));overall.forEach((c,i)=>tags.get(c.id)!.overall=i+1);
 const model={groups,overall,candidates,tags};perSave.set(save,model);return model;
}
