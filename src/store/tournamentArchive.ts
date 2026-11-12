import type { ArchivedEvent } from "@/game/competition/archive";
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
  if (typeof indexedDB === "undefined") return;
  await transact([STORES.tournamentArchive], "readwrite", (tx) => {
    for (const event of records)
      tx.objectStore(STORES.tournamentArchive).put({
        key: archiveKey(careerId, event),
        event,
      });
  });
}
/** Legacy summaries may fill gaps, but must never replace an archive with full pairings. */
export async function writeMissingEventArchive(
  careerId: string,
  records: ArchivedEvent[],
) {
  if (typeof indexedDB === "undefined" || !records.length) return;
  await transact([STORES.tournamentArchive], "readwrite", (tx) => {
    const store = tx.objectStore(STORES.tournamentArchive);
    for (const event of records) {
      const key = archiveKey(careerId, event),
        request = store.get(key);
      request.onsuccess = () => {
        if (request.result === undefined) store.put({ key, event });
      };
    }
  });
}
