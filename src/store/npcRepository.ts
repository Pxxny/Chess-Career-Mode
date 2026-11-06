import { GAME_CONFIG } from '@/data/config';
import type { CareerRecord, Npc } from '@/types';
import { STORES, transact } from '@/utils/idb';

/** Describes which career an NPC database was built for; any mismatch triggers a rebuild. */
export interface NpcDatabaseMeta {
  databaseKey: string;
  careerId: string;
  startYear: number;
  schemaVersion: number;
  fictionalCount: number;
}

const META_KEY = 'npc-db';

export const metaFor = (career: CareerRecord): NpcDatabaseMeta => ({
  databaseKey: career.databaseKey,
  careerId: career.id,
  startYear: career.startYear,
  schemaVersion: GAME_CONFIG.world.npcDatabaseVersion,
  fictionalCount: GAME_CONFIG.world.fictionalNpcCount,
});

export const isMetaCurrent = (meta: NpcDatabaseMeta | undefined, career: CareerRecord): meta is NpcDatabaseMeta => {
  const expected = metaFor(career);
  return !!meta && meta.databaseKey === expected.databaseKey && meta.schemaVersion === expected.schemaVersion &&
    meta.fictionalCount === expected.fictionalCount;
};

export async function readNpcDatabase(): Promise<{ meta?: NpcDatabaseMeta; npcs: Npc[] }> {
  const meta = await transact<NpcDatabaseMeta>([STORES.meta], 'readonly', (tx) => tx.objectStore(STORES.meta).get(META_KEY));
  const npcs = (await transact<Npc[]>([STORES.npcs], 'readonly', (tx) => tx.objectStore(STORES.npcs).getAll())) ?? [];
  return { meta, npcs };
}

/** Replaces the whole stored database with the one built for `career`. */
export async function writeNpcDatabase(npcs: Npc[], career: CareerRecord): Promise<void> {
  await transact([STORES.npcs, STORES.meta], 'readwrite', (tx) => {
    const store = tx.objectStore(STORES.npcs);
    store.clear();
    npcs.forEach((npc) => store.put(npc));
    tx.objectStore(STORES.meta).put(metaFor(career), META_KEY);
  });
}

/** Persists changed NPCs only. */
export async function putNpcs(npcs: Npc[]): Promise<void> {
  if (npcs.length === 0) return;
  await transact([STORES.npcs], 'readwrite', (tx) => {
    const store = tx.objectStore(STORES.npcs);
    npcs.forEach((npc) => store.put(npc));
  });
}
