import { acquireMatch, releaseMatch } from "@/store/matchLocks";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import "@/game/match/chessjs";
import { engineManager } from "@/game/engine/manager";
import {
  MatchSession,
  type MatchSetup,
  type MatchSnapshot,
} from "@/game/match/session";
import { useOpeningDb } from "@/store/openingStore";
import { useGameStore } from "@/store/gameStore";

/**
 * Creates the match session once for a setup, shows its snapshots, and wires it to the career: the result is
 * recorded when the game ends, the analysis is attached when it is ready, and a game left open is saved as a
 * checkpoint. Leaving the screen abandons a game played by hand (a simulation finishes in the background).
 */
export function useMatchSession(setup: MatchSetup): {
  session: MatchSession;
  snap: MatchSnapshot;
} {
  const db = useOpeningDb();
  const token = useRef(Symbol("match"));
  const careerId = useRef(useGameStore.getState().save?.career.id);
  const belongsToCareer = () =>
    useGameStore.getState().save?.career.id === careerId.current;
  const recordId = useRef<string | null>(null);
  const activeSession = useRef<MatchSession | null>(null);
  const session = useMemo(
    () =>
      new MatchSession({
        setup,
        engine: engineManager,
        db,
        onVoid: () => {
          if (careerId.current) releaseMatch(careerId.current, token.current);
          if (
            belongsToCareer() &&
            setup.social &&
            useGameStore.getState().save?.social?.pending?.id ===
              setup.social.requestId
          )
            useGameStore.getState().cancelFriendly();
        },
        onFinish: (finish) => {
          if (careerId.current) releaseMatch(careerId.current, token.current);
          if (!belongsToCareer()) return;
          recordId.current =
            useGameStore.getState().finishMatch(finish, db)?.id ?? null;
        },
        onAnalysis: (report) => {
          if (belongsToCareer() && recordId.current)
            useGameStore
              .getState()
              .attachMatchAnalysis(recordId.current, report);
        },
        onCheckpoint: (pending) => {
          if (belongsToCareer())
            useGameStore.getState().checkpointMatch(pending);
        },
      }),
    // A session belongs to one setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setup],
  );
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot);
  // Clock display ticks live in ClockedPlayerPanel; snapshots only change for session events.

  useEffect(() => {
    activeSession.current = session;
    if (!careerId.current || !acquireMatch(careerId.current, token.current)) {
      session.dispose();
      return;
    }
    session.start();
    return () => {
      activeSession.current = null;
      // StrictMode immediately sets up this same session again. Let that setup cancel
      // cleanup; real unmounts and a replacement setup still release the old session.
      queueMicrotask(() => {
        if (activeSession.current === session) return;
        session.leave();
        // A simulation that carries on in the background keeps its session.
        if (session.getSnapshot().status === "over") session.dispose();
      });
    };
  }, [session]);

  return { session, snap };
}
