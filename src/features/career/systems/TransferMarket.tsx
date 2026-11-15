import { dayLabel } from "@/game/competition/agenda";
import { useMemo,useState } from 'react';
import { Button,Card,CardTitle } from '@/components/ui';
import { useSave } from '@/hooks/useGame';
import { useNpcs } from '@/hooks/useNpcs';
import { useGameStore } from '@/store/gameStore';
import { systemsOf } from '@/game/career/systems';
import { transferQuote,transferWindow } from '@/game/esports/market';
import { recruitmentChance } from '@/game/esports/core';
import { NpcAvatar } from '@/components/game/NpcAvatar';
export function TransferMarket() {
 const save=useSave(),npcs=useNpcs(),act=useGameStore(s=>s.esportsAction),[query,setQuery]=useState(''),[message,setMessage]=useState('');
 const team=save.esports?.team,open=transferWindow(save),systems=systemsOf(save);
 const candidates=useMemo(()=>npcs.filter(n=>n.careerStatus==='active'&&!team?.members.some(m=>m.id===n.id)&&n.name.toLowerCase().includes(query.toLowerCase())&&n.currentElo<=save.player.rating+600).sort((a,b)=>b.form-a.form||b.currentElo-a.currentElo).slice(0,12),[npcs,team,save.player.rating,query]);
 return <Card className="mt-4" data-testid="transfer-market"><CardTitle>Roster transfer market</CardTitle><p className={`mb-3 text-sm ${open?'text-gold-300':'text-ink-muted'}`}>{open?'Transfer window open':'Next windows: weeks 1–4 and 27–30'}</p>{!team?.owner?<p className="text-sm text-ink-muted">Create your own team to sign players.</p>:<details><summary className="cursor-pointer text-sm font-semibold">Free agents & contracts</summary><input aria-label="Search transfer market" className="my-3 w-full rounded-lg bg-navy-900 p-3 text-sm" placeholder="Search players" value={query} onChange={e=>setQuery(e.target.value)}/><div className="grid gap-2 sm:grid-cols-2">{candidates.map(n=>{const quote=transferQuote(save,n),chance=recruitmentChance(save,n);return <div key={n.id} className="rounded-xl bg-navy-900 p-3"><div className="flex gap-2"><NpcAvatar npc={n}/><div className="min-w-0"><p className="truncate text-sm font-semibold" translate="no">{n.name}</p><p className="text-xs text-ink-muted">Elo {n.currentElo} · Form {n.form.toFixed(0)}</p></div></div><p className="my-2 text-xs">Fee ${quote.fee} · ${quote.salary}/week · 26 weeks</p><Button variant="secondary" disabled={!open||save.player.money<quote.fee||!chance||team.members.length>=team.size||!!save.pendingMatch} onClick={()=>{const r=act({type:'recruit',npcId:n.id});setMessage(r.ok?r.message:r.error);}}>Offer contract · {Math.round(chance*100)}%</Button></div>})}</div></details>}{systems.contracts.length>0&&<p className="mt-3 text-sm">Weekly wages: ${systems.contracts.reduce((s,c)=>s+c.salary,0)}</p>}{systems.contracts.length>0&&<ul className="mt-3 space-y-2 text-xs text-ink-muted">{systems.contracts.map(c=><li key={c.npcId} className="flex flex-wrap justify-between gap-2 rounded-lg bg-navy-900 p-2"><span translate="no">{npcs.find(n=>n.id===c.npcId)?.name??c.npcId}</span><span>${c.salary}/week · {dayLabel(c.end).slice(0,10)}</span></li>)}</ul>}{message&&<p className="mt-3 text-sm" role="status">{message}</p>}</Card>;
}
