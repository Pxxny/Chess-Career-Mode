import { useSave } from '@/hooks/useGame';
import { useGameStore } from '@/store/gameStore';
import { systemsOf } from '@/game/career/systems';
import { Button } from '@/components/ui';
export function RegistrationQueue() {
 const save=useSave(),act=useGameStore(s=>s.careerSystemAction),queue=systemsOf(save).queue;
 if(!queue.length)return null;
 return <details className="mt-4 rounded-xl border border-white/10 p-3" data-testid="registration-queue"><summary className="cursor-pointer text-sm font-semibold">Auto-register queue · {queue.filter(q=>q.status==='waiting'||q.status==='blocked').length}</summary><ul className="mt-3 space-y-2">{queue.map(q=><li key={q.eventId} className="flex items-start gap-2 rounded-lg bg-navy-900 p-3 text-sm"><div className="min-w-0 flex-1"><p className="break-words" translate="no">{q.name}</p><p className="mt-1 text-xs text-gold-300">{q.status}</p>{q.reason&&<p className="mt-1 text-xs text-ink-muted">{q.reason}</p>}</div><Button variant="secondary" onClick={()=>act({type:'unqueue',eventId:q.eventId})}>Remove</Button></li>)}</ul></details>;
}
