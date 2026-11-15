import { acquireMatch, releaseMatch } from '@/store/matchLocks';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import '@/game/match/chessjs';
import { engineManager } from '@/game/engine/manager';
import { MatchSession, type MatchSetup, type MatchSnapshot } from '@/game/match/session';
import { useOpeningDb } from '@/store/openingStore';
import { useGameStore } from '@/store/gameStore';

// Route changes never own or restart a live game. Its clocks keep running.
const sessions = new Map<string, {session: MatchSession; token: symbol}>();
export function useMatchSession(setup: MatchSetup): {session: MatchSession; snap: MatchSnapshot} {
  const db = useOpeningDb();
  const careerId = useGameStore.getState().save!.career.id;
  const key = `${careerId}:${setup.seed}`;
  const entry = useMemo(() => {
    const existing = sessions.get(key);
    if (existing) return existing;
    const token = Symbol('match');
    let recordId: string | null = null;
    const belongs = () => useGameStore.getState().save?.career.id === careerId;
    const pending = useGameStore.getState().save?.pendingMatch;
    let initialState;
    if (pending?.resume?.setup.seed === setup.seed) {
      const {clocks, rngState, at, controllers} = pending.resume;
      const restored = {...clocks};
      // Reloading cannot replenish the active clock, even before the first move.
      const turn = pending.ucis.length % 2 === 0 ? 'white' : 'black';
      if (setup.timeControl.category !== 'none') restored[turn] = Math.max(0,restored[turn] - Math.max(0,Date.now()-at));
      initialState = {ucis:pending.ucis, clocks:restored, rngState, playerMoved:pending.playerMoved, controllers};
    }
    const session = new MatchSession({setup,engine:engineManager,db,initialState,
      onVoid: () => {
        releaseMatch(careerId,token);
        if (belongs() && setup.social) useGameStore.getState().cancelFriendly();
      },
      onFinish: finish => {
        releaseMatch(careerId,token);
        if (belongs()) recordId = useGameStore.getState().finishMatch(finish,db)?.id ?? null;
      },
      onAnalysis: report => {if (belongs() && recordId) useGameStore.getState().attachMatchAnalysis(recordId,report);},
      onCheckpoint: checkpoint => {if (belongs()) useGameStore.getState().checkpointMatch(checkpoint);},
    });
    const next = {session,token};
    sessions.set(key,next);
    return next;
  },[key,setup,db,careerId]);
  const snap = useSyncExternalStore(entry.session.subscribe,entry.session.getSnapshot);
  useEffect(() => {
    // Clean up games from a different character; their persistent checkpoint stays intact.
    for (const [id,value] of sessions) if (!id.startsWith(`${careerId}:`)) {
      value.session.saveCheckpoint(); value.session.dispose(); releaseMatch(id.slice(0,id.lastIndexOf(":")),value.token); sessions.delete(id);
    }
    if (acquireMatch(careerId,entry.token)) entry.session.start();
    const persist = () => entry.session.saveCheckpoint();
    window.addEventListener('pagehide',persist);
    return () => {
      window.removeEventListener('pagehide',persist);
      // Explicit Leave / Resign still records a result. Navigation only detaches the view.
      if (entry.session.getSnapshot().status === 'over') {
        releaseMatch(careerId,entry.token); sessions.delete(key);
      }
    };
  },[entry,careerId,key]);
  return {session:entry.session,snap};
}
