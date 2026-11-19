import { temporaryCareer } from "@/utils/temporaryCareer";
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { useLoadingStatus } from "@/store/loadingStatus";
import { useNpcStore } from "@/store/npcStore";
import { useGameStore } from "@/store/gameStore";

export function SplashScreen({ phase, percent, showWorker = false }: {
  phase: string;
  percent: number;
  showWorker?: boolean;
}) {
  const { busy, phase: workerPhase, total, done, hydrationError } = useLoadingStatus();
  const npcError = useNpcStore(state => state.status === "error" ? state.error : null);
  const loadDatabase = useNpcStore(state => state.loadDatabase);
  const career = useGameStore(state => state.save?.career);
  const error = percent === 100 ? null : hydrationError ?? (showWorker ? npcError : null);
  const label = error ?? (showWorker && busy ? workerPhase : phase);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (percent === 100) return;
    const timer = window.setTimeout(() => setSlow(true), 20000);
    return () => window.clearTimeout(timer);
  }, [label, done, percent]);

  return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
    <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gold-500/10 text-4xl text-gold-400" aria-hidden>♞</span>
    <p className="font-display text-2xl font-bold text-gold-400">Chess Career Mode</p>
    <p role={error ? "alert" : "status"} className="max-w-md text-sm text-ink-muted">{label}</p>
    <div className="flex w-64 max-w-full flex-col items-center gap-2">
      <span data-testid="startup-percent" className="text-sm font-bold tabular-nums text-gold-300">{percent}%</span>
      <progress className="h-2 w-full accent-[var(--accent)]" max={100} value={percent} aria-label="Loading career" />
    </div>
    {!error && showWorker && busy && total > 0 && <p className="text-xs tabular-nums text-ink-faint">{done.toLocaleString()} / {total.toLocaleString()}</p>}
    {!error && slow && <p className="max-w-md text-sm text-ink-muted">This step is taking longer than expected. If the game is open in another tab or window, close that copy before reloading.</p>}
    {hydrationError && <p className="max-w-md text-sm text-ink-muted">Close other game windows before trying again. Your saved careers are kept.</p>}
    {percent !== 100 && !temporaryCareer && <a href="/recovery.html" className="inline-flex min-h-11 items-center px-4 text-sm underline">Startup recovery</a>}
    {(slow || error) && <div className="flex flex-wrap justify-center gap-2">
      {!temporaryCareer && (error || slow) && <a href="/?temporary=1" className="inline-flex min-h-11 items-center rounded-lg border border-navy-600 px-4 text-sm">Play a temporary career</a>}
      {hydrationError && <button type="button" className="min-h-11 rounded-lg bg-gold-500/20 px-4 text-sm text-gold-300" onClick={() => void useGameStore.persist.rehydrate()}>Retry reading saves</button>}
      {npcError && !hydrationError && career && <button type="button" className="min-h-11 rounded-lg bg-gold-500/20 px-4 text-sm text-gold-300" onClick={() => void loadDatabase(career)}>Try again</button>}
      <button type="button" className="min-h-11 rounded-lg border border-navy-600 px-4 text-sm" onClick={() => window.location.reload()}>Reload game</button>
    </div>}
  </div>;
}

// This mounts inside Suspense, so a missing screen chunk cannot complete the loader.
export function LoadingReveal({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    setVisible(false);
    const timer = window.setTimeout(() => setVisible(true), 420);
    return () => window.clearTimeout(timer);
  }, []);

  return <>
    {!visible && <div className="fixed inset-0 z-[1000] overflow-auto bg-navy-950" data-testid="startup-complete">
      <SplashScreen phase="Ready to play" percent={100} />
    </div>}
    <div className={!visible ? "invisible h-0 overflow-hidden" : undefined} aria-hidden={!visible || undefined}>
      {children}
    </div>
  </>;
}
