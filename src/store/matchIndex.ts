import type { ArchivedEvent } from "@/game/competition/archive";
import {
  indexRowsFromEvent,
  indexRowsFromMatch,
  type MatchIndexRow,
} from "@/game/history/matchLedger";
import type { MatchRecord } from "@/types";
import { STORES, transact } from "@/utils/idb";

const careerRange = (careerId: string) =>
  IDBKeyRange.bound(`${careerId}|`, `${careerId}|\uffff`);

export async function countMatchIndex(careerId: string): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  const count = await transact<number>([STORES.matchIndex], "readonly", (tx) =>
    tx.objectStore(STORES.matchIndex).index("byCareer").count(careerId),
  );
  return count ?? 0;
}

export async function readNpcIndex(
  careerId: string,
  npcId: string,
): Promise<MatchIndexRow[]> {
  if (typeof indexedDB === "undefined") return [];
  const rows = await transact<MatchIndexRow[]>(
    [STORES.matchIndex],
    "readonly",
    (tx) =>
      tx
        .objectStore(STORES.matchIndex)
        .index("byNpc")
        .getAll(
          IDBKeyRange.bound(
            [careerId, npcId, Number.NEGATIVE_INFINITY, ""],
            [careerId, npcId, Number.POSITIVE_INFINITY, "\uffff"],
          ),
        ),
  );
  return rows ?? [];
}

export async function readEventIndex(
  careerId: string,
  eventId: string,
): Promise<MatchIndexRow[]> {
  if (typeof indexedDB === "undefined") return [];
  const rows = await transact<MatchIndexRow[]>(
    [STORES.matchIndex],
    "readonly",
    (tx) =>
      tx
        .objectStore(STORES.matchIndex)
        .index("byEvent")
        .getAll(
          IDBKeyRange.bound(
            [careerId, eventId, 0, ""],
            [careerId, eventId, Number.MAX_SAFE_INTEGER, "\uffff"],
          ),
        ),
  );
  return rows ?? [];
}

function putRows(index: IDBObjectStore, rows: readonly MatchIndexRow[]) {
  for (const row of rows) index.put(row);
}

/** Writes index rows in the caller's transaction. Put is idempotent for a stable key. */
export function putEventIndex(
  index: IDBObjectStore,
  careerId: string,
  events: readonly ArchivedEvent[],
) {
  for (const event of events) putRows(index, indexRowsFromEvent(careerId, event));
}

export function putMatchIndex(
  index: IDBObjectStore,
  careerId: string,
  matches: readonly MatchRecord[],
) {
  for (const match of matches) putRows(index, indexRowsFromMatch(careerId, match));
}

/** Rebuilds the reference index from archives already stored. Does not invent games. */
export async function rebuildMatchIndex(
  careerId: string,
  events: readonly ArchivedEvent[],
  matches: readonly MatchRecord[] = [],
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await transact([STORES.matchIndex], "readwrite", (tx) => {
    const index = tx.objectStore(STORES.matchIndex);
    const existing = index.getAllKeys(careerRange(careerId));
    existing.onsuccess = () => {
      for (const key of existing.result ?? []) index.delete(key);
      putEventIndex(index, careerId, events);
      putMatchIndex(index, careerId, matches);
    };
  });
}

let rebuilding: Promise<void> | null = null;

/** Old saves have the tournament archive but no index until history is opened. */
export async function ensureMatchIndex(careerId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  if (rebuilding) return rebuilding;
  const stored = await countMatchIndex(careerId);
  if (stored > 0) return;
  const { readEventArchive } = await import("@/store/tournamentArchive");
  const { readMatchArchive } = await import("@/store/matchArchive");
  const events = await readEventArchive(careerId);
  const matches = await readMatchArchive(careerId);
  if (!events.length && !matches.length) return;
  rebuilding = rebuildMatchIndex(careerId, events, matches).finally(() => {
    rebuilding = null;
  });
  await rebuilding;
}
