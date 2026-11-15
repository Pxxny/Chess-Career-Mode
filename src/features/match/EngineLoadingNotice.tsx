import { useEffect,useState,useSyncExternalStore } from 'react';
import { engineManager } from '@/game/engine/manager';
export function EngineLoadingNotice() {
 const info=useSyncExternalStore(engineManager.subscribe,engineManager.getInfo),[visible,setVisible]=useState(false);
 useEffect(()=>{setVisible(false);if(info.status!=='loading')return;const timer=setTimeout(()=>setVisible(true),700);return()=>clearTimeout(timer);},[info.status]);
 if(!visible||info.status!=='loading')return null;
 return <div role="status" className="rounded-xl bg-navy-800 p-3 text-xs text-ink-muted" data-testid="engine-loading"><p>{info.label}</p><progress aria-label="Engine initialization" className="mt-2 h-1 w-full accent-[var(--accent)]"/></div>;
}
