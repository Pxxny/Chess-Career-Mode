import { useEffect,useState } from 'react';
import { Button } from '@/components/ui';
import { useSave } from '@/hooks/useGame';
import { useNpcs } from '@/hooks/useNpcs';
import { useGameStore } from '@/store/gameStore';
import { isCaptain } from '@/game/career/activities';
import { systemsOf,type TeamStrategy } from '@/game/career/systems';
export function CaptainPanel({eventKey,players}:{eventKey:string;players:Array<{id:string;name:string;elo:number}>}) {
 const save=useSave(),npcs=useNpcs(),act=useGameStore(s=>s.careerSystemAction);
 const [order,setOrder]=useState<string[]>(players.map(p=>p.id)),[strategy,setStrategy]=useState<TeamStrategy>(systemsOf(save).captain[eventKey]?.strategy??'balanced'),[message,setMessage]=useState('');
 const ids=players.map(p=>p.id).join('|');
 useEffect(()=>{setOrder(players.map(p=>p.id));setStrategy(systemsOf(save).captain[eventKey]?.strategy??'balanced');setMessage('');},[eventKey,ids]);
 if(!isCaptain(save,npcs)||!players.some(p=>p.id==='player'))return null;
 return <details className="my-4 rounded-xl border border-gold-500/30 p-3" data-testid="captain-panel"><summary className="cursor-pointer font-semibold text-gold-300">Captain · board order & strategy</summary><ol className="mt-3 space-y-2">{order.map((id,i)=>{const p=players.find(p=>p.id===id);if(!p)return null;return <li key={id} className="flex min-w-0 items-center gap-2 text-sm"><span className="w-5">{i+1}</span><span className="min-w-0 flex-1 truncate" translate="no">{p.name} · {p.elo}</span><button className="h-10 w-10 rounded-lg bg-navy-900" aria-label={`Move ${p.name} up`} disabled={i===0} onClick={()=>setOrder(previous=>{const n=[...previous];[n[i-1],n[i]]=[n[i],n[i-1]];return n;})}>↑</button><button className="h-10 w-10 rounded-lg bg-navy-900" aria-label={`Move ${p.name} down`} disabled={i===order.length-1} onClick={()=>setOrder(previous=>{const n=[...previous];[n[i+1],n[i]]=[n[i],n[i+1]];return n;})}>↓</button></li>})}</ol><select aria-label="National team strategy" value={strategy} onChange={e=>setStrategy(e.target.value as TeamStrategy)} className="my-3 w-full rounded-lg bg-navy-900 p-3 text-sm"><option value="balanced">Balanced</option><option value="anchor">Solid play on board 1</option><option value="attack">Attack on the lower boards</option></select><Button onClick={()=>{const r=act({type:'captain',key:eventKey,order,strategy});setMessage(r.ok?'Team plan saved.':r.error);}}>Save team plan</Button>{message&&<p role="status" className="mt-2 text-sm">{message}</p>}</details>;
}
