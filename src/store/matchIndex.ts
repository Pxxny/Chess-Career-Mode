import type { ArchivedEvent } from "@/game/competition/archive";
import {
  indexRowsFromEvent,
  indexRowsFromMatch,
  type MatchIndexRow,
} from "@/game/history/matchLedger";
import type { MatchRecord } from "@/types";
import { openDb, STORES, transact } from "@/utils/idb";

const careerRange = (careerId: string) =>
  IDBKeyRange.bound(`${careerId}|`, `${careerId}|\uffff`);

/** Meta record that says whether a career's index matches its archives. */
export const matchIndexStatusKey = (careerId: string) => `match-index:${careerId}`;
export type MatchIndexStatus = { state: "building" | "ready"; updatedAt: number };

/** Index rows written per rebuild transaction; readers can run between chunks. */
export const INDEX_CHUNK_ROWS = 5000;

/** Upgraded databases retain their historical rows. All new writes use the compact store. */
export async function matchIndexStores(): Promise<string[]> {
  const db = await openDb();
  return db.objectStoreNames.contains(STORES.legacyMatchIndex)
    ? [STORES.legacyMatchIndex, STORES.matchIndex]
    : [STORES.matchIndex];
}

/** Counts every row of a career. O(rows): diagnostics and tests only, never on a UI path. */
export async function countMatchIndex(careerId: string): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  const stores = await matchIndexStores();
  const range = careerRange(careerId);
  if (stores.length === 1)
    return (await transact<number>(stores, "readonly", (tx) =>
      tx.objectStore(STORES.matchIndex).count(range),
    )) ?? 0;
  const keys = new Set<IDBValidKey>();
  await transact(stores, "readonly", (tx) => {
    for (const name of stores) {
      const request = tx.objectStore(name).getAllKeys(range);
      request.onsuccess = () => {
        for (const key of request.result) keys.add(key);
      };
    }
  });
  return keys.size;
}

export async function hasMatchIndexRows(careerId: string): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  const stores = await matchIndexStores();
  let found = false;
  await transact(stores, "readonly", (tx) => {
    for (const name of stores) {
      const key = tx.objectStore(name).getKey(careerRange(careerId));
      key.onsuccess = () => { found ||= key.result !== undefined; };
    }
  });
  return found;
}

export async function readMatchIndexStatus(careerId: string): Promise<MatchIndexStatus | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  return transact<MatchIndexStatus | undefined>([STORES.meta], "readonly", (tx) =>
    tx.objectStore(STORES.meta).get(matchIndexStatusKey(careerId)),
  );
}

async function writeMatchIndexStatus(careerId: string, state: MatchIndexStatus["state"]) {
  await transact([STORES.meta], "readwrite", (tx) => {
    tx.objectStore(STORES.meta).put({ state, updatedAt: Date.now() } satisfies MatchIndexStatus, matchIndexStatusKey(careerId));
  });
}

/** Careers whose index is known to be complete in this tab. */
const readyCareers = new Set<string>();

/** Call when a career's index or archives are deleted, replaced or restored. */
export function invalidateMatchIndexStatus(careerId?: string): void {
  if (careerId === undefined) readyCareers.clear();
  else readyCareers.delete(careerId);
}

/** Test hook. */
export function matchIndexStatusCached(careerId: string): boolean {
  return readyCareers.has(careerId);
}

export function readNpcIndex(
  careerId: string,
  npcId: string,
): Promise<MatchIndexRow[]> {
  return readIndex("byNpc", careerId, npcId);
}

export function readEventIndex(
  careerId: string,
  eventId: string,
): Promise<MatchIndexRow[]> {
  return readIndex("byEvent", careerId, eventId);
}

async function readIndex(
  index: "byNpc" | "byEvent",
  careerId: string,
  id: string,
): Promise<MatchIndexRow[]> {
  if (typeof indexedDB === "undefined") return [];
  const stores = await matchIndexStores();
  const range = IDBKeyRange.bound(
    [careerId, id, -Infinity, ""],
    [careerId, id, Infinity, "\uffff"],
  );
  const requests: IDBRequest<MatchIndexRow[]>[] = [];
  await transact(stores, "readonly", (tx) => {
    for (const name of stores) requests.push(tx.objectStore(name).index(index).getAll(range));
  });
  if (requests.length === 1 || !requests[0].result.length) return requests.at(-1)!.result;
  if (!requests[1].result.length) return requests[0].result;
  const rows = new Map(requests[0].result.map((row) => [row.key, row]));
  for (const row of requests[1].result) rows.set(row.key, row);
  const order = index === "byNpc" ? "day" : "round";
  return [...rows.values()].sort((a, b) => a[order] - b[order] || indexedDB.cmp(a.key, b.key));
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

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Repairs historical gaps in bounded transactions. Read each archive batch and generate
 * its rows inside the same transaction so a rebuild cannot overwrite a newer replay.
 * If interrupted, running the same puts again safely finishes the repair.
 */
async function rebuildMatchIndex(careerId: string): Promise<void> {
  await writeMatchIndexStatus(careerId, "building");
  await rebuildRows<{ key: string; event: ArchivedEvent }>(
    careerId, STORES.tournamentArchive, ({ event }) => indexRowsFromEvent(careerId, event),
  );
  await rebuildRows<{ key: string; match: MatchRecord }>(
    careerId, STORES.matchArchive, ({ match }) => indexRowsFromMatch(careerId, match),
  );
  await writeMatchIndexStatus(careerId, "ready");
  readyCareers.add(careerId);
}

async function rebuildRows<T extends { key: string }>(
  careerId: string,
  source: string,
  indexRows: (record: T) => MatchIndexRow[],
): Promise<void> {
  const range = careerRange(careerId);
  let lastKey: string | undefined;
  let done = false;
  while (!done) {
    await transact([source, STORES.matchIndex], "readwrite", (tx) => {
      const index = tx.objectStore(STORES.matchIndex);
      // Keep the number of deserialized archive entries bounded as well, including empty events.
      const limit = 24;
      const request: IDBRequest<T[]> = tx.objectStore(source).getAll(
        lastKey === undefined ? range : IDBKeyRange.bound(lastKey, range.upper, true),
        limit,
      );
      request.onsuccess = () => {
        let written = 0;
        for (const record of request.result) {
          const rows = indexRows(record);
          if (written && written + rows.length > INDEX_CHUNK_ROWS) return;
          putRows(index, rows);
          lastKey = record.key;
          written += rows.length;
        }
        done = request.result.length < limit;
      };
    });
    if (!done) await yieldToUi();
  }
}

/** Events scanned (in key order) to find the first archived event that has games. */
const PROBE_EVENTS = 200;

/**
 * True when the oldest archived event that actually has games is present in the index.
 * Archives written before the index store existed fail this check and get rebuilt; an event
 * with no playable boards (all byes / forfeits) has no rows and is skipped, so it can never
 * force a needless rebuild. Reads at most PROBE_EVENTS archive values.
 */
async function oldestEventIndexed(careerId: string): Promise<boolean> {
  let indexed = true;
  const stores = await matchIndexStores();
  await transact([STORES.tournamentArchive, ...stores], "readonly", (tx) => {
    let scanned = 0;
    const cursor = tx.objectStore(STORES.tournamentArchive).openCursor(careerRange(careerId));
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (!c) return;
      if (scanned++ >= PROBE_EVENTS) {
        indexed = false;
        return;
      }
      const event = (c.value as { event: ArchivedEvent }).event;
      if (!indexRowsFromEvent(careerId, event).length) {
        c.continue();
        return;
      }
      indexed = false;
      for (const name of stores) {
        const row = tx.objectStore(name).index("byEvent").getKey(
          IDBKeyRange.bound([careerId, event.id, 0, ""], [careerId, event.id, Number.MAX_SAFE_INTEGER, "\uffff"]),
        );
        row.onsuccess = () => { indexed ||= row.result !== undefined; };
      }
    };
  });
  return indexed;
}

/** True when the career has nothing archived yet (new career): there is nothing to rebuild. */
async function archivesEmpty(careerId: string): Promise<boolean> {
  let empty = true;
  await transact([STORES.tournamentArchive, STORES.matchArchive], "readonly", (tx) => {
    for (const name of [STORES.tournamentArchive, STORES.matchArchive]) {
      const key = tx.objectStore(name).getKey(careerRange(careerId));
      key.onsuccess = () => {
        if (key.result !== undefined) empty = false;
      };
    }
  });
  return empty;
}

const ensuring = new Map<string, Promise<void>>();

/**
 * Old saves have the tournament archive but no index until history is opened.
 * Fast path: an in-tab cache, then the status marker, then a one-key existence lookup.
 * Never counts the whole store.
 */
export function ensureMatchIndex(careerId: string): Promise<void> {
  if (typeof indexedDB === "undefined" || readyCareers.has(careerId)) return Promise.resolve();
  const existing = ensuring.get(careerId);
  if (existing) return existing;
  const load = prepareMatchIndex(careerId).finally(() => ensuring.delete(careerId));
  ensuring.set(careerId, load);
  return load;
}

export async function waitForMatchIndex(careerId: string): Promise<void> {
  await ensuring.get(careerId)?.catch(() => undefined);
}

async function prepareMatchIndex(careerId: string): Promise<void> {
  const status = await readMatchIndexStatus(careerId);
  if (status?.state === "ready") {
    readyCareers.add(careerId);
    return;
  }
  // No marker yet (saves from before it existed). Every archive write stores an event together
  // with its rows in one transaction, so the only gap is an archive written before the index
  // store existed: check that the oldest archived event has rows (two key lookups).
  // A `building` marker means an interrupted rebuild, which is resumed.
  if (
    status?.state !== "building" &&
    (((await hasMatchIndexRows(careerId)) && (await oldestEventIndexed(careerId))) ||
      (await archivesEmpty(careerId)))
  ) {
    await writeMatchIndexStatus(careerId, "ready");
    readyCareers.add(careerId);
    return;
  }
  await rebuildMatchIndex(careerId);
}
