import { useLoadingStatus } from '@/store/loadingStatus';
import { useNpcStore } from '@/store/npcStore';
import { useOpeningStore } from '@/store/openingStore';
import { useGameStore } from '@/store/gameStore';
export function SplashScreen() {
 const progress=useLoadingStatus(),npc=useNpcStore(s=>s.status),error=useNpcStore(s=>s.error),loadDatabase=useNpcStore(s=>s.loadDatabase),career=useGameStore(s=>s.save?.career),openings=useOpeningStore(s=>s.status==='ready');
 const label=progress.busy?progress.phase:npc==='error'?(error??'Could not generate players.'):npc==='loading'?'Reading player database…':!openings?'Loading opening repertoire…':'Restoring your career…';
 return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6" role="status"><span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-500/10 text-4xl text-gold-400">♞</span><p className="font-display text-2xl font-bold text-gold-400">Chess Career Mode</p><p className="text-sm text-ink-muted">{label}</p>{npc==='error'?career&&<button type="button" className="rounded-lg bg-gold-500/20 px-4 py-2 text-sm text-gold-400" onClick={()=>void loadDatabase(career)}>Try again</button>:progress.busy&&progress.total>0?<><progress className="h-1.5 w-64 accent-[var(--accent)]" max={progress.total} value={progress.done} aria-label="Player database progress"/><p className="text-xs tabular-nums text-ink-faint">{progress.done.toLocaleString()} / {progress.total.toLocaleString()}</p></>:<progress className="h-1.5 w-64 accent-[var(--accent)]" aria-label="Loading career"/>}</div>;
}
