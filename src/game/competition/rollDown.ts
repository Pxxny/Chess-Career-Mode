import type { ActiveTournament, GameSave } from '@/types';
import { standings } from '@/game/match/tournament';
export function allocatePlaces(order:string[],quota:number,already:Iterable<string>,excluded:Iterable<string>=[]) {
 const seen=new Set(already), blocked=new Set(excluded), awards:string[]=[];
 for(const id of order) if(!seen.has(id)&&!blocked.has(id)){awards.push(id);seen.add(id);if(awards.length>=quota)break;}
 return quota>0?awards:[];
}
export function circuitAllocation(save:GameSave,t:ActiveTournament) {
 const c=t.details?.qualificationCircuit,target=c?.targetEventId;
 const ledger={...(save.competition?.circuitAwards??{})};
 if(!target||!c?.advanceTop)return {ledger,awards:[] as string[]};
 const previous=new Set(ledger[target]??[]);
 if((save.competition?.qualifications??[]).some(q=>q.eventId===target))previous.add('player');
 // Migrate retained old results as earned places; do not fabricate new legacy awards.
 for(const old of save.competition?.archive??[]) if(old.details?.qualificationCircuit?.targetEventId===target)
  standings(old).filter(r=>r.rank<=(old.details!.qualificationCircuit!.advanceTop??0)&&!(old.withdrawn&&r.player.id==='player')).forEach(r=>previous.add(r.player.id));
 let order=standings(t).map(r=>r.player.id);
 if(!t.withdrawn&&t.finalRank&&order.includes('player')){order=order.filter(id=>id!=='player');order.splice(t.finalRank-1,0,'player');}
 const awards=allocatePlaces(order,c.advanceTop,previous,t.withdrawn?['player']:[]);
 ledger[target]=[...previous,...awards];
 return {ledger:Object.fromEntries(Object.entries(ledger).slice(-60)),awards};
}
