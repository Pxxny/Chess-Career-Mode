import type { StateStorage } from 'zustand/middleware';
import { GAME_CONFIG } from '@/data/config';
import type { Appearance, GameSave } from '@/types';
import { STORES, transact } from '@/utils/idb';

/** Where saved characters live. Values are the JSON strings that the game store persists. */
export interface SlotBackend {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const idbSlotBackend: SlotBackend = {
  get: async (key) => (await transact<string>([STORES.keyval], 'readonly', (tx) => tx.objectStore(STORES.keyval).get(key))) ?? undefined,
  set: async (key, value) => {
    await transact([STORES.keyval], 'readwrite', (tx) => tx.objectStore(STORES.keyval).put(value, key));
  },
  remove: async (key) => {
    await transact([STORES.keyval], 'readwrite', (tx) => tx.objectStore(STORES.keyval).delete(key));
  },
};

export function createMemorySlotBackend(): SlotBackend & { entries(): Record<string, string> } {
  const data = new Map<string, string>();
  return {
    get: async (key) => data.get(key),
    set: async (key, value) => void data.set(key, value),
    remove: async (key) => void data.delete(key),
    entries: () => Object.fromEntries(data),
  };
}

/** A short description of a saved character for the slot screen. */
export interface SlotSummary {
  gender?:string;
  slot: number;
  careerId: string;
  name: string;
  appearance: Partial<Appearance> | undefined;
  countryCode: string;
  cityName: string;
  age: number;
  rating: number;
  peakRating: number;
  startYear: number;
  year: number;
  week: number;
  money: number;
}

/** What a slot holds: a character, nothing, or data that cannot be read. */
export type SlotState = { slot: number; kind: 'empty' } | { slot: number; kind: 'broken' } | { slot: number; kind: 'character'; summary: SlotSummary };

interface Persisted {
  state?: { save?: Partial<GameSave> | null };
  version?: number;
}

const parse = (raw: string | undefined): Persisted | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Persisted;
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
};

/** Pulls the slot summary out of a stored value, or null when it holds no usable character. */
export function summarize(slot: number, raw: string | undefined): SlotSummary | null {
  const save = parse(raw)?.state?.save;
  if (!save || !save.player || !save.career || !save.world) return null;
  const { player, career, world } = save;
  return {
    slot,
    careerId: career.id ?? '',
    name: player.name ?? 'Unknown',
    appearance: player.appearance,
    gender:player.gender,
    countryCode: career.countryCode ?? player.country ?? '',
    cityName: career.city?.name ?? player.city?.name ?? '',
    age: player.age ?? 0,
    rating: player.rating ?? 0,
    peakRating: player.peakRating ?? player.rating ?? 0,
    startYear: career.startYear ?? 0,
    year: world.date?.year ?? career.startYear ?? 0,
    week: world.date?.week ?? 1,
    money: player.money ?? 0,
  };
}

interface Meta {
  active: number | null;
}

/** What the game store persists while no character is open. */
const CLOSED_GAME = /^\{"state":\{"save":null/;

/**
 * Keeps up to `GAME_CONFIG.saveSlots` characters side by side. Each slot stores the string the game store
 * persists (state and version), so a slot loads through exactly the same migration as a single save used to.
 * One slot is "active": it is the one the open game reads and writes. A save from before slots existed is
 * moved into slot 1 the first time the manager starts.
 */
export function createSlotManager(backend: SlotBackend, slotCount: number = GAME_CONFIG.saveSlots) {
  const baseKey = GAME_CONFIG.saveKey;
  const metaKey = `${baseKey}-slots`;
  const slotKey = (slot: number): string => `${baseKey}-slot-${slot}`;
  let active: number | null = null;
  let ready: Promise<void> | null = null;

  const validSlot = (slot: number): boolean => Number.isInteger(slot) && slot >= 1 && slot <= slotCount;

  const saveMeta = (): Promise<void> => backend.set(metaKey, JSON.stringify({ active } satisfies Meta));

  const init = (): Promise<void> => {
    ready ??= (async () => {
      const meta = parse(await backend.get(metaKey)) as Meta | null;
      if (meta) {
        active = typeof meta.active === 'number' && validSlot(meta.active) ? meta.active : null;
        return;
      }
      // First start with slots: a single save from the earlier version becomes slot 1.
      const legacy = await backend.get(baseKey);
      if (legacy && summarize(1, legacy)) {
        await backend.set(slotKey(1), legacy);
        active = 1;
        await saveMeta();
        await backend.remove(baseKey);
      } else {
        active = null;
        await saveMeta();
      }
    })();
    return ready;
  };

  return {
    slotCount,
    init,
    /** The active slot, once `init` has finished. */
    getActive: (): number | null => active,

    /** Makes a slot (or none) the active one. The in-memory value changes at once, so writes that follow go to it. */
    setActive(slot: number | null): Promise<void> {
      if (slot !== null && !validSlot(slot)) return Promise.reject(new Error(`Invalid save slot ${slot}`));
      active = slot;
      return init().then(() => {
        active = slot;
        return saveMeta();
      });
    },

    readSlot: async (slot: number): Promise<string | undefined> => {
      await init();
      return validSlot(slot) ? backend.get(slotKey(slot)) : undefined;
    },

    /** Writes the value into the slot that is active right now. Does nothing while no character is open. */
    async writeActive(value: string): Promise<void> {
      const slot = active;
      if (slot === null) return;
      await backend.set(slotKey(slot), value);
    },

    deleteSlot(slot: number): Promise<void> {
      if (!validSlot(slot)) return Promise.resolve();
      const wasActive = active === slot;
      if (wasActive) active = null;
      return init().then(async () => {
        if (wasActive) {
          active = null;
          await saveMeta();
        }
        await backend.remove(slotKey(slot));
      });
    },

    async listSlots(): Promise<SlotState[]> {
      await init();
      const states: SlotState[] = [];
      for (let slot = 1; slot <= slotCount; slot++) {
        const raw = await backend.get(slotKey(slot));
        if (raw === undefined) states.push({ slot, kind: 'empty' });
        else {
          const summary = summarize(slot, raw);
          states.push(summary ? { slot, kind: 'character', summary } : { slot, kind: 'broken' });
        }
      }
      return states;
    },

    /** First empty slot, or null when all are used. */
    async firstFreeSlot(): Promise<number | null> {
      return (await this.listSlots()).find((s) => s.kind === 'empty')?.slot ?? null;
    },

    /** Zustand storage adapter: the game store reads and writes the active slot through it. */
    storage: {
      getItem: async () => {
        await init();
        if (active === null) return null;
        return (await backend.get(slotKey(active))) ?? null;
      },
      setItem: async (_name, value) => {
        // The slot is read before anything is awaited, so a write belongs to the character that was open when it was made.
        const slot = active;
        // A closed game persists `{ save: null }`; that must never overwrite a character.
        if (slot === null || CLOSED_GAME.test(value)) return;
        await backend.set(slotKey(slot), value);
      },
      removeItem: async () => undefined,
    } satisfies StateStorage,
  };
}

export const slotManager = createSlotManager(idbSlotBackend);
