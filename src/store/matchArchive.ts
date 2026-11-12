import type { GameSave, MatchRecord } from "@/types";
import { STORES, transact } from "@/utils/idb";
const listeners = new Set<() => void>();
export const subscribeMatchArchive = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const matchKey = (careerId: string, id: string) => `${careerId}|${id}`;
const range = (careerId: string) =>
  IDBKeyRange.bound(`${careerId}|`, `${careerId}|\uffff`);
export function mergeMatches(
  ...groups: readonly MatchRecord[][]
): MatchRecord[] {
  const map = new Map<string, MatchRecord>();
  for (const rows of groups)
    for (const m of rows) {
      const old = map.get(m.id);
      map.set(
        m.id,
        old
          ? {
              ...old,
              ...m,
              moves: m.moves.length ? m.moves : old.moves,
              analysis: m.analysis ?? old.analysis,
              recording: m.recording ?? old.recording,
            }
          : m,
      );
    }
  return [...map.values()].sort(
    (a, b) =>
      a.year - b.year ||
      a.week - b.week ||
      (a.day ?? 1) - (b.day ?? 1) ||
      a.id.localeCompare(b.id, undefined, { numeric: true }),
  );
}
export function queueMatchRecords(
  save: GameSave,
  records: MatchRecord[],
): GameSave {
  return {
    ...save,
    matchArchivePending: mergeMatches(save.matchArchivePending ?? [], records),
  };
}
export async function readMatchArchive(
  careerId: string,
): Promise<MatchRecord[]> {
  if (typeof indexedDB === "undefined") return [];
  const rows = await transact<Array<{ key: string; match: MatchRecord }>>(
    [STORES.matchArchive],
    "readonly",
    (tx) => tx.objectStore(STORES.matchArchive).getAll(range(careerId)),
  );
  return (rows ?? []).map((r) => r.match);
}
export async function writeMatchArchive(
  careerId: string,
  records: MatchRecord[],
) {
  if (typeof indexedDB === "undefined" || !records.length) return;
  await transact([STORES.matchArchive], "readwrite", (tx) => {
    for (const match of records) {
      const store = tx.objectStore(STORES.matchArchive),
        key = matchKey(careerId, match.id),
        read = store.get(key);
      read.onsuccess = () =>
        store.put({
          key,
          match: mergeMatches(read.result ? [read.result.match] : [], [
            match,
          ])[0],
        });
    }
  });
  listeners.forEach((fn) => fn());
}
