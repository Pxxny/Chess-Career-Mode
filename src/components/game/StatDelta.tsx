import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
export function StatDelta({value,format=(n:number)=>String(n)}:{value:number;format?:(n:number)=>string}) {
  const previous = useRef(value);
  const [delta,setDelta] = useState<{value:number;id:number}|null>(null);
  const running = useGameStore(s=>s.seasonRunning);
  const career = useGameStore(s=>s.save?.career.id);
  useEffect(()=>{previous.current=value;setDelta(null);},[career]);
  useEffect(()=>{
    const difference=value-previous.current;previous.current=value;
    if (!difference || running || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setDelta({value:difference,id:Date.now()});
    const timer=setTimeout(()=>setDelta(null),1600);
    return ()=>clearTimeout(timer);
  },[value,running]);
  return delta ? <span key={delta.id} aria-live="polite" className={`stat-delta ${delta.value>0?'text-emerald-300':'text-rose-300'}`}>{delta.value>0?'+':''}{format(delta.value)}</span> : null;
}
