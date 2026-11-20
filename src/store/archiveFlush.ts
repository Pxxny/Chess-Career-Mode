import type { ArchivedEvent } from "@/game/competition/archive";
import { indexRowsFromEvent, type MatchIndexRow } from "@/game/history/matchLedger";
import { STORES, transact } from "@/utils/idb";

/**
 * Chunked, verifiable tournament-archive flush.
 *
 * Protocol (one career at a time; the caller serializes flushes per career):
 *  1. The save keeps every event in `tournamentArchivePending` (the outbox / journal) until step 4.
 *  2. A `writing` marker is stored in `meta` under `archive-flush:<career id>`.
 *  3. Events are written in chunks. Each chunk is ONE transaction that stores the chunk's events,
 *     all of their index rows and the marker's progress, so an event is never visible without its
 *     rows. Puts are keyed (`<career>|<year>|<event>` and `<career>|<match id>|<npc id>`), so a
 *     repeated chunk after a crash or retry overwrites the same records: no duplicate match ids.
 *  4. A verification transaction checks that every event key and the first index row of every
 *     event with played boards are present, and only then stores the marker as `committed`.
 *     The promise resolves only after that commit; only then does the caller drop the events
 *     from the save's outbox.
 * Recovery: closing the game during steps 2–4 leaves the marker at `writing` and the events still
 * in the saved outbox, so the next load writes them again (idempotent) and commits. A partial
 * flush is therefore never reported as complete.
 */
export const archiveFlushKey = (careerId: string) => `archive-flush:${careerId}`;

export interface ArchiveFlushMarker {
  state: "writing" | "committed";
  batch: string;
  events: number;
  chunksDone: number;
  rowsWritten: number;
  startedAt: number;
  committedAt?: number;
  verifiedEvents?: number;
  verifiedRowsEvents?: number;
}

/** Index rows per chunk transaction. About 0.4–0.8 s of IndexedDB work per chunk in Chromium. */
export const ARCHIVE_CHUNK_ROWS = 5000;

export const archiveKey = (careerId: string, e: Pick<ArchivedEvent, "year" | "id">) =>
  `${careerId}|${e.year}|${e.id}`;

type FlushHooks = {
  /** Test hook: runs after each committed chunk; throwing simulates closing the game mid-flush. */
  afterChunk?: (done: number) => void | Promise<void>;
};
let hooks: FlushHooks = {};
export function setArchiveFlushHooks(next: FlushHooks): void {
  hooks = next;
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function readArchiveFlushMarker(careerId: string): Promise<ArchiveFlushMarker | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  return transact<ArchiveFlushMarker | undefined>([STORES.meta], "readonly", (tx) =>
    tx.objectStore(STORES.meta).get(archiveFlushKey(careerId)),
  );
}

export class ArchiveVerificationError extends Error {}

export async function flushEventArchive(careerId: string, records: readonly ArchivedEvent[]): Promise<ArchiveFlushMarker | undefined> {
  if (typeof indexedDB === "undefined" || !records.length) return undefined;
  const marker: ArchiveFlushMarker = {
    state: "writing",
    batch: `${Date.now().toString(36)}-${records.length}`,
    events: records.length,
    chunksDone: 0,
    rowsWritten: 0,
    startedAt: Date.now(),
  };
  await transact([STORES.meta], "readwrite", (tx) => {
    tx.objectStore(STORES.meta).put(marker, archiveFlushKey(careerId));
  });
  /** Event id -> whether it has at least one played board (an index row). */
  const hasRows = new Map<string, boolean>();
  let events: ArchivedEvent[] = [];
  let rows: MatchIndexRow[] = [];
  const commit = async () => {
    if (!events.length) return;
    const chunkEvents = events, chunkRows = rows;
    events = [];
    rows = [];
    marker.chunksDone += 1;
    marker.rowsWritten += chunkRows.length;
    const progress = { ...marker };
    await transact([STORES.tournamentArchive, STORES.matchIndex, STORES.meta], "readwrite", (tx) => {
      const archive = tx.objectStore(STORES.tournamentArchive);
      for (const event of chunkEvents) archive.put({ key: archiveKey(careerId, event), event });
      const index = tx.objectStore(STORES.matchIndex);
      for (const row of chunkRows) index.put(row);
      tx.objectStore(STORES.meta).put(progress, archiveFlushKey(careerId));
    });
    await hooks.afterChunk?.(marker.chunksDone);
    await yieldToUi();
  };
  for (const event of records) {
    const eventRows = indexRowsFromEvent(careerId, event);
    hasRows.set(archiveKey(careerId, event), eventRows.length > 0);
    if (rows.length && rows.length + eventRows.length > ARCHIVE_CHUNK_ROWS) await commit();
    events.push(event);
    for (const row of eventRows) rows.push(row);
  }
  await commit();

  // Verify, then commit the marker in the same transaction.
  let present = 0, rowsPresent = 0, expectRows = 0;
  await transact([STORES.tournamentArchive, STORES.matchIndex, STORES.meta], "readwrite", (tx) => {
    const archive = tx.objectStore(STORES.tournamentArchive);
    const byEvent = tx.objectStore(STORES.matchIndex).index("byEvent");
    let waiting = 0;
    const done = () => {
      if (--waiting > 0) return;
      if (present === records.length && rowsPresent === expectRows) {
        marker.state = "committed";
        marker.committedAt = Date.now();
        marker.verifiedEvents = present;
        marker.verifiedRowsEvents = rowsPresent;
        tx.objectStore(STORES.meta).put({ ...marker }, archiveFlushKey(careerId));
      }
    };
    for (const event of records) {
      const key = archiveKey(careerId, event);
      waiting++;
      const found = archive.getKey(key);
      found.onsuccess = () => { if (found.result !== undefined) present++; done(); };
      if (hasRows.get(key)) {
        expectRows++;
        waiting++;
        const row = byEvent.getKey(IDBKeyRange.bound([careerId, event.id, 0, ""], [careerId, event.id, Number.MAX_SAFE_INTEGER, "\uffff"]));
        row.onsuccess = () => { if (row.result !== undefined) rowsPresent++; done(); };
      }
    }
  });
  if (marker.state !== "committed")
    throw new ArchiveVerificationError(
      `Tournament archive verification failed: ${present}/${records.length} events, ${rowsPresent}/${expectRows} indexed. The events stay queued in the save.`,
    );
  return { ...marker };
}
