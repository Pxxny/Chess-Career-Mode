import { useLoadingStatus } from '@/store/loadingStatus';
import { useNpcStore } from '@/store/npcStore';
import { useOpeningStore } from '@/store/openingStore';
export function SplashScreen() {
 const progress=useLoadingStatus(),npc=useNpcStore(s=>s.status),openings=useOpeningStore(s=>s.status==='ready');
 const label=progress.busy?progress.phase:npc==='loading'?'Reading player database…':!openings?'Loading opening repertoire…':'Restoring your career…';
 return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6" role="status"><span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-500/10 text-4xl text-gold-400">♞</span><p className="font-display text-2xl font-bold text-gold-400">Chess Career Mode</p><p className="text-sm text-ink-muted">{label}</p>{progress.busy&&progress.total>0?<><progress className="h-1.5 w-64 accent-[var(--accent)]" max={progress.total} value={progress.done} aria-label="Player database progress"/><p className="text-xs tabular-nums text-ink-faint">{progress.done.toLocaleString()} / {progress.total.toLocaleString()}</p></>:<progress className="h-1.5 w-64 accent-[var(--accent)]" aria-label="Loading career"/>}</div>;
}
