import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { swissEvent } from "./fixtures";

describe("existing IndexedDB v7 database", () => {
  it("retains legacy rows and reads them alongside deduplicated compact rows", async () => {
    await new Promise<void>((res, rej) => {
      const q = indexedDB.open("chess-career-mode", 7);
      q.onupgradeneeded = () => {
        const db = q.result;
        for (const s of ["keyval", "meta", "openingData"]) db.createObjectStore(s);
        for (const s of ["npcs"]) db.createObjectStore(s, { keyPath: "id" });
        for (const s of ["tournamentArchive", "matchArchive", "careerNpcs"]) db.createObjectStore(s, { keyPath: "key" });
        const index = db.createObjectStore("matchIndex", { keyPath: "key" });
        index.createIndex("byCareer", "careerId");
        index.createIndex("byNpc", ["careerId", "npcId", "day", "key"]);
        index.createIndex("byEvent", ["careerId", "eventId", "round", "key"]);
        index.createIndex("byMatch", ["careerId", "matchId"]);
        index.createIndex("byH2H", ["careerId", "npcId", "opponentId", "day", "key"]);
        for (let i = 0; i < 100; i++)
          index.put({ key: `c|m${i}|n${i % 7}`, careerId: "c", matchId: `m${i}`, npcId: `n${i % 7}`, opponentId: "x", eventId: "e", round: 1, day: i });
      };
      q.onsuccess = () => { q.result.close(); res(); };
      q.onerror = () => rej(q.error);
    });
    const { openDb, STORES } = await import("@/utils/idb");
    const db = await openDb();
    expect(db.version).toBe(8);
    const tx = db.transaction(STORES.legacyMatchIndex);
    const store = tx.objectStore(STORES.legacyMatchIndex);
    expect([...store.indexNames].sort()).toEqual(["byCareer", "byEvent", "byH2H", "byMatch", "byNpc"]);
    const count = await new Promise<number>((res) => { const r = store.count(); r.onsuccess = () => res(r.result); });
    expect(count).toBe(100);
    const { countMatchIndex, readEventIndex, readNpcIndex } = await import("@/store/matchIndex");
    const { flushEventArchive } = await import("@/store/archiveFlush");
    const { indexRowsFromEvent } = await import("@/game/history/matchLedger");
    const { transact } = await import("@/utils/idb");
    const { idbNpcBackend } = await import("@/store/npcRepository");
    const legacy = await readNpcIndex("c", "n3");
    expect(legacy).toHaveLength(Math.ceil((100 - 3) / 7));
    await transact([STORES.matchIndex], "readwrite", (tx) => {
      tx.objectStore(STORES.matchIndex).put({ ...legacy[0], score: 0.5 });
    });
    expect(await readNpcIndex("c", "n3")).toEqual([{ ...legacy[0], score: 0.5 }, ...legacy.slice(1)]);
    const event = swissEvent("new", 2027, 4, 3);
    await flushEventArchive("c", [event]);
    expect(await readEventIndex("c", "new")).toHaveLength(indexRowsFromEvent("c", event).length);
    expect(await countMatchIndex("c")).toBe(100 + indexRowsFromEvent("c", event).length);
    const legacyCount = await transact<number>([STORES.legacyMatchIndex], "readonly",
      (tx) => tx.objectStore(STORES.legacyMatchIndex).count());
    expect(legacyCount).toBe(100);
    await idbNpcBackend.deleteAll("c");
    expect(await countMatchIndex("c")).toBe(0);
  });
});
