import { GAME_CONFIG } from "@/data/config";
import type { CareerRecord, Npc } from "@/types";
import { STORES, transact } from "@/utils/idb";

/** Describes which career an NPC database was built for; any mismatch triggers a rebuild. */
export interface NpcDatabaseMeta {
  databaseKey: string;
  careerId: string;
  startYear: number;
  schemaVersion: number;
  fictionalCount: number;
}

/** Key of the single database used before characters had their own (one career at a time). */
const LEGACY_META_KEY = "npc-db";
const metaKeyFor = (careerId: string): string => `npc-db:${careerId}`;
const npcKey = (careerId: string, npcId: string): string =>
  `${careerId}|${npcId}`;
const careerRange = (careerId: string): IDBKeyRange =>
  IDBKeyRange.bound(`${careerId}|`, `${careerId}|\uffff`);

export const metaFor = (career: CareerRecord): NpcDatabaseMeta => ({
  databaseKey: career.databaseKey,
  careerId: career.id,
  startYear: career.startYear,
  schemaVersion: GAME_CONFIG.world.npcDatabaseVersion,
  fictionalCount: GAME_CONFIG.world.fictionalNpcCount,
});

export const isMetaCurrent = (
  meta: NpcDatabaseMeta | undefined,
  career: CareerRecord,
): meta is NpcDatabaseMeta => {
  const expected = metaFor(career);
  return (
    !!meta &&
    meta.databaseKey === expected.databaseKey &&
    meta.schemaVersion === expected.schemaVersion &&
    meta.fictionalCount === expected.fictionalCount
  );
};

/** Where NPC worlds live. IndexedDB in the app; an in-memory copy in the tests. */
export interface NpcBackend {
  getMeta(careerId: string): Promise<NpcDatabaseMeta | undefined>;
  readAll(careerId: string): Promise<Npc[]>;
  /** Replaces the whole world of a career and its meta record. */
  replaceAll(
    careerId: string,
    npcs: Npc[],
    meta: NpcDatabaseMeta,
  ): Promise<void>;
  putMany(careerId: string, npcs: Npc[]): Promise<void>;
  deleteAll(careerId: string): Promise<void>;
  /** The single database of saves made before characters had their own worlds. */
  readLegacy(): Promise<{ meta?: NpcDatabaseMeta; npcs: Npc[] }>;
  clearLegacy(): Promise<void>;
}

export const idbNpcBackend: NpcBackend = {
  getMeta: (careerId) =>
    transact<NpcDatabaseMeta>([STORES.meta], "readonly", (tx) =>
      tx.objectStore(STORES.meta).get(metaKeyFor(careerId)),
    ),

  readAll: async (careerId) => {
    const records =
      (await transact<Array<{ key: string; npc: Npc }>>(
        [STORES.careerNpcs],
        "readonly",
        (tx) => tx.objectStore(STORES.careerNpcs).getAll(careerRange(careerId)),
      )) ?? [];
    return records.map((r) => r.npc);
  },

  replaceAll: async (careerId, npcs, meta) => {
    await transact([STORES.careerNpcs, STORES.meta], "readwrite", (tx) => {
      const store = tx.objectStore(STORES.careerNpcs);
      store.delete(careerRange(careerId));
      npcs.forEach((npc) => store.put({ key: npcKey(careerId, npc.id), npc }));
      tx.objectStore(STORES.meta).put(meta, metaKeyFor(careerId));
    });
  },

  putMany: async (careerId, npcs) => {
    await transact([STORES.careerNpcs], "readwrite", (tx) => {
      const store = tx.objectStore(STORES.careerNpcs);
      npcs.forEach((npc) => store.put({ key: npcKey(careerId, npc.id), npc }));
    });
  },

  deleteAll: async (careerId) => {
    await transact(
      [STORES.careerNpcs, STORES.meta, STORES.tournamentArchive],
      "readwrite",
      (tx) => {
        tx.objectStore(STORES.tournamentArchive).delete(careerRange(careerId));
        tx.objectStore(STORES.careerNpcs).delete(careerRange(careerId));
        tx.objectStore(STORES.meta).delete(metaKeyFor(careerId));
      },
    );
  },

  readLegacy: async () => {
    const meta = await transact<NpcDatabaseMeta>(
      [STORES.meta],
      "readonly",
      (tx) => tx.objectStore(STORES.meta).get(LEGACY_META_KEY),
    );
    const npcs = meta
      ? ((await transact<Npc[]>([STORES.npcs], "readonly", (tx) =>
          tx.objectStore(STORES.npcs).getAll(),
        )) ?? [])
      : [];
    return { meta, npcs };
  },

  clearLegacy: async () => {
    await transact([STORES.npcs, STORES.meta], "readwrite", (tx) => {
      tx.objectStore(STORES.npcs).clear();
      tx.objectStore(STORES.meta).delete(LEGACY_META_KEY);
    });
  },
};

/**
 * Reads the stored NPC world of one career. A world saved by the single-career version of the game is moved
 * into the career it belongs to the first time that career loads, so existing saves keep their NPCs.
 */
export async function readNpcDatabase(
  career: CareerRecord,
  backend: NpcBackend = idbNpcBackend,
): Promise<{ meta?: NpcDatabaseMeta; npcs: Npc[] }> {
  const meta = await backend.getMeta(career.id);
  if (meta) return { meta, npcs: await backend.readAll(career.id) };

  const legacy = await backend.readLegacy();
  if (
    legacy.meta &&
    legacy.meta.careerId === career.id &&
    legacy.npcs.length > 0
  ) {
    await backend.replaceAll(career.id, legacy.npcs, legacy.meta);
    await backend.clearLegacy();
    return { meta: legacy.meta, npcs: legacy.npcs };
  }
  return { npcs: [] };
}

/** Replaces the stored world of `career` with `npcs`. Other careers are not touched. */
export function writeNpcDatabase(
  npcs: Npc[],
  career: CareerRecord,
  backend: NpcBackend = idbNpcBackend,
): Promise<void> {
  return backend.replaceAll(career.id, npcs, metaFor(career));
}

/** Persists changed NPCs of one career only. */
export async function putNpcs(
  npcs: Npc[],
  careerId: string,
  backend: NpcBackend = idbNpcBackend,
): Promise<void> {
  if (npcs.length === 0) return;
  await backend.putMany(careerId, npcs);
}

/** Removes the NPC world of a deleted character. */
export function deleteNpcDatabase(
  careerId: string,
  backend: NpcBackend = idbNpcBackend,
): Promise<void> {
  return backend.deleteAll(careerId);
}

export interface MemoryNpcBackend extends NpcBackend {
  /** Pretends the single-career version of the game wrote this database. */
  seedLegacy(meta: NpcDatabaseMeta, npcs: Npc[]): void;
  /** What is stored: one world per career id, and what is left of the legacy database. */
  dump(): { worlds: Record<string, Npc[]>; legacy: Npc[] };
}

/** A memory-backed backend with the same rules as IndexedDB, for tests. */
export function createMemoryNpcBackend(): MemoryNpcBackend {
  const worlds = new Map<string, Map<string, Npc>>();
  const metas = new Map<string, NpcDatabaseMeta>();
  let legacyMeta: NpcDatabaseMeta | undefined;
  let legacyNpcs: Npc[] = [];
  const clone = <T>(v: T): T => (v === undefined ? v : structuredClone(v));
  return {
    getMeta: async (id) => clone(metas.get(id)),
    readAll: async (id) => [...(worlds.get(id)?.values() ?? [])].map(clone),
    replaceAll: async (id, npcs, meta) => {
      worlds.set(id, new Map(npcs.map((n) => [n.id, clone(n)])));
      metas.set(id, clone(meta));
    },
    putMany: async (id, npcs) => {
      const world = worlds.get(id) ?? new Map<string, Npc>();
      npcs.forEach((n) => world.set(n.id, clone(n)));
      worlds.set(id, world);
    },
    deleteAll: async (id) => {
      worlds.delete(id);
      metas.delete(id);
    },
    readLegacy: async () => ({
      meta: clone(legacyMeta),
      npcs: legacyNpcs.map(clone),
    }),
    clearLegacy: async () => {
      legacyMeta = undefined;
      legacyNpcs = [];
    },
    seedLegacy: (meta, npcs) => {
      legacyMeta = meta;
      legacyNpcs = npcs;
    },
    dump: () => ({
      worlds: Object.fromEntries(
        [...worlds].map(([id, w]) => [id, [...w.values()]]),
      ),
      legacy: legacyNpcs,
    }),
  };
}
