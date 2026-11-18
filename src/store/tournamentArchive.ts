import type { ArchivedEvent } from "@/game/competition/archive";
import { putEventIndex } from "@/store/matchIndex";
import { STORES, transact } from "@/utils/idb";
export const archiveKey = (
  careerId: string,
  e: Pick<ArchivedEvent, "year" | "id">,
) => `${careerId}|${e.year}|${e.id}`;
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
export async function writeEventArchive(
  careerId: string,
  records: ArchivedEvent[],
) {
  if (typeof indexedDB === "undefined" || !records.length) return;
  await transact([STORES.tournamentArchive, STORES.matchIndex], "readwrite", (tx) => {
    const events = tx.objectStore(STORES.tournamentArchive);
    const index = tx.objectStore(STORES.matchIndex);
    for (const event of records)
      events.put({ key: archiveKey(careerId, event), event });
    putEventIndex(index, careerId, records);
  });
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
          request = store.get(key);
        request.onsuccess = () => {
          if (request.result !== undefined) return;
          store.put({ key, event });
          putEventIndex(index, careerId, [event]);
        };
      }
    },
  );
}
