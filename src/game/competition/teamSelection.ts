import {buildEventTeams} from './teamEvents';
import {teamInfoOf,teamSpec} from '@/data/chess/nationalTeamEvents';
import type {GameSave,Npc} from '@/types';
import type {ScheduledEvent} from '@/game/world/schedule';
export interface TeamSelectionReport {status:'selected'|'reserve'|'not-selected'|'loading';boards:number;rules:string[];starters:Array<{id:string;name:string;elo:number}>;issue:string|null;}
const cache=new WeakMap<Npc[],WeakMap<GameSave,Map<string,TeamSelectionReport>>>();
export function teamSelection(save:GameSave,event:Pick<ScheduledEvent,'details'>,npcs?:Npc[]):TeamSelectionReport|null {
 if(event.details?.format!=='team')return null;
 const info=teamInfoOf(event.details),spec=teamSpec(info.key);
 if(!npcs?.length)return {status:'loading',boards:info.boards,rules:[],starters:[],issue:'Wait for the NPC world to finish loading.'};
 let saves=cache.get(npcs);if(!saves){saves=new WeakMap();cache.set(npcs,saves);}let reports=saves.get(save);if(!reports){reports=new Map();saves.set(save,reports);}const key=JSON.stringify(info),known=reports.get(key);if(known)return known;
 const home=buildEventTeams(save,npcs,info).find(t=>t.country===save.player.country),starters=home?.players??[];
 const status=starters.some(p=>p.id==='player')?'selected':home?.reserves?.some(p=>p.id==='player')?'reserve':'not-selected';
 const counts=new Map<string,number>(),labels:Record<string,string>={open:'Open',woman:'Women',man:'Men','boy-u20':'Boys U20','girl-u20':'Girls U20'};
 for(let i=0;i<info.boards;i++){const slot=spec?.slots?.[i]??'open';counts.set(slot,(counts.get(slot)??0)+1);}
 const report:TeamSelectionReport={status,boards:info.boards,starters,rules:[...(spec?.maxAge!==undefined?[`Age ${spec.maxAge} or younger`]:[]),...(spec?.minAge!==undefined?[`Age ${spec.minAge}+`]:[]),...[...counts].map(([slot,n])=>`${labels[slot]??slot}: ${n}`)],issue:status==='selected'?null:status==='reserve'?'Reserve only: a starting-board place is required for this event.':'National team starting-roster selection required.'};reports.set(key,report);return report;
}
