import type { ArchivedEvent } from "@/game/competition/archive";
import { putEventIndex } from "@/store/matchIndex";
import { STORES, transact } from "@/utils/idb";
import { archiveKey, flushEventArchive } from "./archiveFlush";
export { archiveKey } from "./archiveFlush";
const range = (careerId: string, year?: number) => {
  const prefix = `${careerId}|${year === undefined ? "" : `${year}|`}`;
  return IDBKeyRange.bound(prefix, prefix + "\uffff");
};
export async function readEventArchive(
  careerId: string,
  year?: number,
): Promise<ArchivedEvent[]> {
  if (typeof indexedDB === "undefined") return [];
  const rows = await transact<Array<{ key: string; event: ArchivedEvent }>>(
    [STORES.tournamentArchive],
    "readonly",
    (tx) =>
      tx.objectStore(STORES.tournamentArchive).getAll(range(careerId, year)),
  );
  return (rows ?? []).map((r) => r.event);
}
/**
 * Writes archived events and their index rows in verified chunks (see `archiveFlush.ts`).
 * Resolves only after the commit marker is stored; rejects (and leaves the outbox alone) otherwise.
 */
export async function writeEventArchive(
  careerId: string,
  records: ArchivedEvent[],
) {
  if (typeof indexedDB === "undefined" || !records.length) return;
  await flushEventArchive(careerId, records);
}
/** Legacy summaries may fill gaps, but must never replace an archive with full pairings. */
export async function writeMissingEventArchive(
  careerId: string,
  records: ArchivedEvent[],
) {
  if (typeof indexedDB === "undefined" || !records.length) return;
  await transact(
    [STORES.tournamentArchive, STORES.matchIndex],
    "readwrite",
    (tx) => {
      const store = tx.objectStore(STORES.tournamentArchive);
      const index = tx.objectStore(STORES.matchIndex);
      for (const event of records) {
        const key = archiveKey(careerId, event),
          request = store.getKey(key);
        request.onsuccess = () => {
          if (request.result !== undefined) return;
          store.put({ key, event });
          putEventIndex(index, careerId, [event]);
        };
      }
    },
  );
}

/** Read only the summary fields needed by the series history. */
export async function readSeriesArchive(careerId: string, key: string) {
  if (typeof indexedDB === "undefined") return [];
  const { eventSeriesKey } = await import("@/game/competition/eventSeries");
  const events: SeriesEdition[] = [];
  await transact([STORES.tournamentArchive], "readonly", tx => {
    const cursor = tx.objectStore(STORES.tournamentArchive).openCursor(range(careerId));
    cursor.onsuccess = () => {
      const row = cursor.result;
      if (!row) return;
      const event = row.value.event as ArchivedEvent;
      if (eventSeriesKey(event.name) === key) events.push(seriesEdition(event));
      row.continue();
    };
  });
  return events;
}

export function seriesEdition(event: ArchivedEvent) {
  return {
    id: event.id, year: event.year, week: event.week,
    city: event.location, country: event.country,
    fieldSize: event.fieldSize, rounds: event.rounds,
    winner: event.players.find(player => player.rank === 1)?.name,
    playerRank: event.players.find(player => player.id === "player")?.rank,
  };
}

type SeriesEdition = ReturnType<typeof seriesEdition>;
