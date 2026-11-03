import { useMemo } from 'react';
import { getRankedNpcs } from '@/game/npc/rankings';
import { useNpcStore } from '@/store/npcStore';
import type { Npc } from '@/types';

export const useNpcs = (): Npc[] => useNpcStore((s) => s.npcs);

/** NPCs holding a world ranking in the current era, best first. */
export function useRankedNpcs(): Npc[] {
  const npcs = useNpcs();
  return useMemo(() => getRankedNpcs(npcs), [npcs]);
}
