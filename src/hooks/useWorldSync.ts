import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useNpcStore } from '@/store/npcStore';

/** Keeps NPC ages, eras, leagues and rankings in step with the game date and alternate-history mode. */
export function useWorldSync(): void {
  const ready = useNpcStore((s) => s.status === 'ready');
  const syncWorld = useNpcStore((s) => s.syncWorld);
  const year = useGameStore((s) => s.save?.world.date.year);
  const week = useGameStore((s) => s.save?.world.date.week);
  const alternateHistory = useGameStore((s) => s.save?.world.alternateHistory);

  useEffect(() => {
    if (!ready || year === undefined || week === undefined) return;
    void syncWorld({ year, week, alternateHistory: alternateHistory ?? false });
  }, [ready, year, week, alternateHistory, syncWorld]);
}
