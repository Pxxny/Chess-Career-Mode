import type { Npc } from "@/types";
import { STORES, transact } from "@/utils/idb";
import { temporaryCareer } from "@/utils/temporaryCareer";
import { putNpcRows, putNpcs } from "./npcRepository";
import { saveSlotKey, slotManager } from "./saveSlots";

/**
 * While a fast-forward or a season is running, save JSON and NPC writes stay in memory.
 * One transaction at the end writes the latest NPC records and the save. A failed flush leaves
 * the previous database untouched and keeps the pending payload for another attempt.
 * A crash before flush reloads the last successful save.
 */
interface SavePayload {
  state: unknown;
  version: number;
}
type SaveWriter = (slot: number, json: string) => Promise<void>;
type NpcWriter = (npcs: Npc[], careerId: string) => Promise<void>;

let depth = 0;
let checkpointsQueued = 0;
let retryCheckpoint = false;
const pendingSaves = new Map<number, SavePayload>();
const dirty = new Map<string, { careerId: string; npc: Npc }>();
let writeSave: SaveWriter = (slot, json) => slotManager.writeSlot(slot, json);
let writeNpcs: NpcWriter = (npcs, careerId) => putNpcs(npcs, careerId);

async function persistCheckpoint(saves: Map<number, SavePayload>, groups: Map<string, Npc[]>): Promise<void> {
  const serializedSaves = [...saves].map(([slot, save]) => [slot, JSON.stringify(save)] as const);
  if (temporaryCareer) {
    for (const [slot, json] of serializedSaves) await writeSave(slot, json);
    return;
  }
  if (!serializedSaves.length && !groups.size) return;
  await transact([STORES.keyval, STORES.careerNpcs], "readwrite", (tx) => {
    const npcs = tx.objectStore(STORES.careerNpcs);
    const slots = tx.objectStore(STORES.keyval);
    for (const [careerId, list] of groups) putNpcRows(npcs, careerId, list);
    for (const [slot, json] of serializedSaves) slots.put(json, saveSlotKey(slot));
  });
}

export function simulationActive(): boolean {
  return depth > 0;
}

export function simulationPending(): boolean {
  return dirty.size > 0 || pendingSaves.size > 0;
}

/** Test hook. Production uses the real slot and NPC database. */
export function setSimulationWriters(writers: {
  save?: SaveWriter;
  npcs?: NpcWriter;
}): void {
  if (writers.save) writeSave = writers.save;
  if (writers.npcs) writeNpcs = writers.npcs;
}

export function holdSimulation(): void {
  depth += 1;
}

export async function releaseSimulation(): Promise<void> {
  depth = Math.max(0, depth - 1);
  if (depth === 0) await flushSimulation();
}

/**
 * Every flush runs through one chain, so an older save can never land after a newer one
 * (IndexedDB orders transactions by creation, but a flush awaits NPC writes before the save).
 */
let chain: Promise<unknown> = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const run = chain.then(work);
  chain = run.catch(() => undefined);
  return run;
}

/**
 * Outside a simulation, writes are coalesced: one End day used to serialize the whole save
 * about twice and start a separate NPC transaction per store update. Writes made within
 * `COALESCE_MS` of each other are written once, NPCs first and then the newest save, with the
 * same error behaviour as before (NPC write errors are ignored, save errors reach the caller).
 */
export const COALESCE_MS = 25;
let timer: ReturnType<typeof setTimeout> | null = null;
let waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }> = [];

function scheduleBackgroundFlush(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    waiters.push({ resolve, reject });
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const settled = waiters;
      waiters = [];
      void flushBackground().then(
        () => settled.forEach((w) => w.resolve()),
        (error) => settled.forEach((w) => w.reject(error)),
      );
    }, COALESCE_MS);
  });
}

/** Buffers NPC records (latest object wins). Inside a simulation they wait for its flush. */
export function queueNpcWrites(careerId: string, npcs: Npc[]): Promise<void> {
  for (const npc of npcs) dirty.set(`${careerId}\n${npc.id}`, { careerId, npc });
  return depth > 0 ? Promise.resolve() : scheduleBackgroundFlush();
}

/** Buffers the newest value for the slot that was active when the game changed. */
export function queueSave(slot: number, value: SavePayload): Promise<void> {
  pendingSaves.set(slot, value);
  return depth > 0 ? Promise.resolve() : scheduleBackgroundFlush();
}

/** Writes anything buffered now (page hide, tests). */
export function flushPendingWrites(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    const settled = waiters;
    waiters = [];
    const run = flushBackground();
    run.then(() => settled.forEach((w) => w.resolve()), (error) => settled.forEach((w) => w.reject(error)));
    return run;
  }
  return flushBackground();
}

function takePending() {
  const npcs = [...dirty.values()];
  const saves = new Map(pendingSaves);
  dirty.clear();
  pendingSaves.clear();
  const groups = new Map<string, Npc[]>();
  for (const row of npcs) {
    const list = groups.get(row.careerId) ?? [];
    list.push(row.npc);
    groups.set(row.careerId, list);
  }
  return { npcs, saves, groups };
}

function flushBackground(): Promise<void> {
  return serialized(async () => {
    if (depth > 0 || checkpointsQueued > 0 || !simulationPending()) return;
    if (retryCheckpoint) {
      await flushJournal();
      return;
    }
    const { saves, groups } = takePending();
    for (const [careerId, list] of groups) await writeNpcs(list, careerId).catch(() => undefined);
    const writes = await Promise.allSettled([...saves].map(async ([slot, save]) => {
      await writeSave(slot, JSON.stringify(save));
    }));
    const failure = writes.find((write) => write.status === "rejected");
    if (failure) throw failure.reason;
  });
}

export function flushSimulation(): Promise<void> {
  checkpointsQueued++;
  return serialized(async () => {
    try {
      await flushJournal();
    } finally {
      checkpointsQueued--;
    }
  });
}

async function flushJournal(): Promise<void> {
  if (depth > 0) return;
  const { npcs, saves, groups } = takePending();
  try {
    await persistCheckpoint(saves, groups);
    retryCheckpoint = false;
  } catch (error) {
    retryCheckpoint = true;
    for (const row of npcs) {
      const key = `${row.careerId}\n${row.npc.id}`;
      if (!dirty.has(key)) dirty.set(key, row);
    }
    for (const [slot, save] of saves)
      if (!pendingSaves.has(slot)) pendingSaves.set(slot, save);
    throw error;
  }
}
