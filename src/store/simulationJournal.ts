import type { Npc } from "@/types";
import { putNpcs } from "./npcRepository";
import { slotManager } from "./saveSlots";

/**
 * While a fast-forward or a season is running, save JSON and NPC writes stay in memory.
 * One flush at the end writes the latest NPC records, then the save. A failed flush leaves
 * the previous database untouched and keeps the pending payload for another attempt.
 * A crash before flush reloads the last successful save.
 */
interface SavePayload {
  state: unknown;
  version: number;
}
interface PendingSave {
  name: string;
  value: SavePayload;
}
type SaveWriter = (name: string, json: string) => Promise<void>;
type NpcWriter = (npcs: Npc[], careerId: string) => Promise<void>;

let depth = 0;
let pendingSave: PendingSave | null = null;
const dirty = new Map<string, { careerId: string; npc: Npc }>();
let writeSave: SaveWriter = (name, json) =>
  slotManager.storage.setItem(name, json);
let writeNpcs: NpcWriter = (npcs, careerId) => putNpcs(npcs, careerId);

export function simulationActive(): boolean {
  return depth > 0;
}

export function simulationPending(): boolean {
  return dirty.size > 0 || pendingSave !== null;
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

/** Latest object wins. Returns true when the caller must not start its own transaction. */
export function rememberNpcWrites(careerId: string, npcs: Npc[]): boolean {
  if (depth === 0) return false;
  for (const npc of npcs)
    dirty.set(`${careerId}\n${npc.id}`, { careerId, npc });
  return true;
}

/** Keeps the newest partialized store value without serializing it. */
export function rememberSave(name: string, value: SavePayload): boolean {
  if (depth === 0) return false;
  pendingSave = { name, value };
  return true;
}

export async function releaseSimulation(): Promise<void> {
  depth = Math.max(0, depth - 1);
  if (depth === 0) await flushSimulation();
}

export async function flushSimulation(): Promise<void> {
  if (depth > 0) return;
  const npcs = [...dirty.values()];
  const save = pendingSave;
  dirty.clear();
  pendingSave = null;
  const groups = new Map<string, Npc[]>();
  for (const row of npcs) {
    const list = groups.get(row.careerId) ?? [];
    list.push(row.npc);
    groups.set(row.careerId, list);
  }
  try {
    for (const [careerId, list] of groups) await writeNpcs(list, careerId);
    if (save) await writeSave(save.name, JSON.stringify(save.value));
  } catch (error) {
    for (const row of npcs) dirty.set(`${row.careerId}\n${row.npc.id}`, row);
    if (save) pendingSave = save;
    throw error;
  }
}
