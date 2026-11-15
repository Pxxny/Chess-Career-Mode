import { playerOpponentId } from "@/game/match/tournament";
import { useState } from 'react';
import { Button } from '@/components/ui';
import { ChoiceDialog } from '@/features/training/ChoiceDialog';
import { useSave } from '@/hooks/useGame';
import { useGameStore } from '@/store/gameStore';
import { systemsOf } from '@/game/career/systems';
export function PressConference({npcId,eventId,id,phase}:{npcId:string;eventId:string;id:string;phase:'pre'|'post'}) {
 const save=useSave(),act=useGameStore(s=>s.careerSystemAction),[open,setOpen]=useState(false),[message,setMessage]=useState('');
 const answered=systemsOf(save).press[`${phase}:${eventId}:${id}`];
 if(phase==='pre'&&(!save.tournament||playerOpponentId(save.tournament)?.id!==npcId))return null;
 if(!save.tournament||save.tournament.eventId!==eventId||!['international','elite'].includes(save.tournament.level))return null;
 return <div className="rounded-xl border border-white/10 p-3" data-testid="press-conference">{answered?<p className="text-sm text-gold-300">Interview recorded · {answered}</p>:<Button variant="secondary" onClick={()=>setOpen(true)}>Press conference</Button>}{message&&<p role="status" className="mt-2 text-sm">{message}</p>}<ChoiceDialog open={open} title={phase==='pre'?'Before the match':'After the match'} description="What would you like to say to the press?" emptyText="No questions" options={[{id:'respect',label:'Respect the opponent',detail:'Morale +2 · relationship +4'},{id:'confident',label:'Trust my preparation',detail:'Morale +4 · relationship unchanged'},{id:'challenge',label:'Raise the stakes',detail:'Morale +3 · relationship −6 · opponent morale +4'}]} onClose={()=>setOpen(false)} onPick={answer=>{const result=act({type:'press',id,eventId,npcId,phase,answer:answer as 'respect'|'confident'|'challenge'});setMessage(result.ok?'Your statement is saved in Career news.':result.error);if(result.ok)setOpen(false);}}/></div>;
}
