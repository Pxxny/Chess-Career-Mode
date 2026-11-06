import { create } from 'zustand';
import { buildWorldNpcs } from '@/game/npc/buildWorldNpcs';
import { applyWorldState, type WorldClock } from '@/game/npc/worldState';
import type { CareerRecord, Npc } from '@/types';
import { isMetaCurrent, putNpcs, readNpcDatabase, writeNpcDatabase } from './npcRepository';

interface NpcStore {
  status: 'idle' | 'loading' | 'ready';
  /** Career whose NPC database is currently loaded */
  careerId: string | null;
  npcs: Npc[];
  /** Loads the NPC database of a career. It is built and saved only when missing or outdated. */
  loadDatabase: (career: CareerRecord) => Promise<void>;
  /** Rebuilds every NPC from the seed for a new career. */
  resetDatabase: (career: CareerRecord) => Promise<void>;
  /** Re-applies era, age, ranking and league rules for the current game date and mode. */
  syncWorld: (clock: WorldClock) => Promise<void>;
  updateNpcs: (changed: Npc[]) => Promise<void>;
}

export const useNpcStore = create<NpcStore>()((set, get) => ({
  status: 'idle',
  careerId: null,
  npcs: [],

  loadDatabase: async (career) => {
    if (get().careerId === career.id && get().status !== 'idle') return;
    set({ status: 'loading', careerId: career.id });
    try {
      const stored = await readNpcDatabase();
      if (isMetaCurrent(stored.meta, career) && stored.npcs.length > 0) {
        set({ npcs: stored.npcs, status: 'ready' });
        return;
      }
    } catch {
      // Storage unavailable: fall through and keep an in-memory world.
    }
    const npcs = buildWorldNpcs(career.startYear);
    set({ npcs, status: 'ready' });
    await writeNpcDatabase(npcs, career).catch(() => undefined);
  },

  resetDatabase: async (career) => {
    const npcs = buildWorldNpcs(career.startYear);
    set({ npcs, status: 'ready', careerId: career.id });
    await writeNpcDatabase(npcs, career).catch(() => undefined);
  },

  syncWorld: async (clock) => {
    const previous = get().npcs;
    const next = applyWorldState(previous, clock);
    const changed = next.filter((npc, i) => npc !== previous[i]);
    if (changed.length === 0) return;
    set({ npcs: next });
    await putNpcs(changed).catch(() => undefined);
  },

  updateNpcs: async (changed) => {
    const byId = new Map(changed.map((n) => [n.id, n]));
    set({ npcs: get().npcs.map((n) => byId.get(n.id) ?? n) });
    await putNpcs(changed).catch(() => undefined);
  },
}));
