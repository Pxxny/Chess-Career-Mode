import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import '@/game/match/chessjs';
import { engineManager } from '@/game/engine/manager';
import { MatchSession, type MatchSetup, type MatchSnapshot } from '@/game/match/session';
import { useOpeningDb } from '@/store/openingStore';
import { useGameStore } from '@/store/gameStore';

/**
 * Creates the match session once for a setup, shows its snapshots, and wires it to the career: the result is
 * recorded when the game ends, the analysis is attached when it is ready, and a game left open is saved as a
 * checkpoint. Leaving the screen abandons a game played by hand (a simulation finishes in the background).
 */
export function useMatchSession(setup: MatchSetup): { session: MatchSession; snap: MatchSnapshot; tick: number } {
  const db = useOpeningDb();
  const recordId = useRef<string | null>(null);
  const session = useMemo(
    () =>
      new MatchSession({
        setup,
        engine: engineManager,
        db,
        onFinish: (finish) => {
          recordId.current = useGameStore.getState().finishMatch(finish, db)?.id ?? null;
        },
        onAnalysis: (report) => {
          if (recordId.current) useGameStore.getState().attachMatchAnalysis(recordId.current, report);
        },
        onCheckpoint: (pending) => useGameStore.getState().checkpointMatch(pending),
      }),
    // A session belongs to one setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setup],
  );
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [tick, setTick] = useState(0);

  // Redraws the clocks while the game runs.
  useEffect(() => {
    if (snap.status !== 'running') return;
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [snap.status]);

  useEffect(() => {
    session.start();
    return () => {
      session.leave();
      // A simulation that carries on in the background keeps its session; anything else can be released.
      if (session.getSnapshot().status === 'over') session.dispose();
    };
  }, [session]);

  return { session, snap, tick };
}
