import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { STORES, openDb } from "@/utils/idb";
import {
  ensureMatchIndex, countMatchIndex, readMatchIndexStatus, matchIndexStatusCached, invalidateMatchIndexStatus, readNpcIndex,
} from "@/store/matchIndex";
import { archiveKey } from "@/store/tournamentArchive";
import { flushEventArchive } from "@/store/archiveFlush";
import { indexRowsFromEvent } from "@/game/history/matchLedger";
import { swissEvent } from "./fixtures";

const events = Array.from({ length: 20 }, (_, i) => swissEvent(`e${i}`, 2026, 40, 9, i));
const total = (c: string) => events.reduce((n, e) => n + indexRowsFromEvent(c, e).length, 0);

/** Writes archive records only (an old save written before the index store existed). */
async function archiveOnly(careerId: string, list = events) {
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORES.tournamentArchive, "readwrite");
    for (const event of list) tx.objectStore(STORES.tournamentArchive).put({ key: archiveKey(careerId, event), event });
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
}

describe("ensureMatchIndex", () => {
  it("rebuilds an old save that has archives but no index, in chunks, then marks it ready", async () => {
    await archiveOnly("old");
    await ensureMatchIndex("old");
    expect(await countMatchIndex("old")).toBe(total("old"));
    expect((await readMatchIndexStatus("old"))?.state).toBe("ready");
    expect(matchIndexStatusCached("old")).toBe(true);
  });

  it("resumes an interrupted rebuild instead of trusting partial rows", async () => {
    await archiveOnly("int");
    const db = await openDb();
    await new Promise<void>((res) => {
      const tx = db.transaction([STORES.matchIndex, STORES.meta], "readwrite");
      for (const row of indexRowsFromEvent("int", events[0]).slice(0, 10)) tx.objectStore(STORES.matchIndex).put(row);
      tx.objectStore(STORES.meta).put({ state: "building", updatedAt: 1 }, "match-index:int");
      tx.oncomplete = () => res();
    });
    await ensureMatchIndex("int");
    expect(await countMatchIndex("int")).toBe(total("int"));
    expect((await readMatchIndexStatus("int"))?.state).toBe("ready");
  });

  it("rebuilds a legacy index whose oldest archived event was never indexed", async () => {
    await archiveOnly("gap");
    await flushEventArchive("gap", [swissEvent("new", 2027, 10, 3, 500)]); // newer rows only
    await ensureMatchIndex("gap");
    expect((await readNpcIndex("gap", "npc-0")).length).toBeGreaterThan(0);
    expect(await countMatchIndex("gap")).toBe(total("gap") + indexRowsFromEvent("gap", swissEvent("new", 2027, 10, 3, 500)).length);
  });

  it("uses an existence lookup + cache for an indexed career and honours invalidation", async () => {
    await flushEventArchive("fresh", events);
    invalidateMatchIndexStatus();
    await ensureMatchIndex("fresh");
    expect(matchIndexStatusCached("fresh")).toBe(true);
    expect((await readMatchIndexStatus("fresh"))?.state ?? "ready").toBe("ready");
    invalidateMatchIndexStatus("fresh");
    expect(matchIndexStatusCached("fresh")).toBe(false);
    await ensureMatchIndex("fresh");
    expect(matchIndexStatusCached("fresh")).toBe(true);
    expect(await countMatchIndex("fresh")).toBe(total("fresh")); // nothing rebuilt or duplicated
  });

  it("a new career with no archive is ready at once (nothing to rebuild; later writes are atomic)", async () => {
    await ensureMatchIndex("empty");
    expect(matchIndexStatusCached("empty")).toBe(true);
    await flushEventArchive("empty", events.slice(0, 2));
    expect((await readNpcIndex("empty", "npc-1")).length).toBeGreaterThan(0);
  });

  it("an oldest archived event without games does not force a rebuild during a flush", async () => {
    const noGames = { ...swissEvent("a-byes", 2026, 4, 1, 900), pairings: [[{ white: "npc-900", black: "bye", result: 1 }]] } as any;
    expect(indexRowsFromEvent("byes", noGames).length).toBe(0);
    await flushEventArchive("byes", [noGames, ...events.slice(0, 3)]);
    invalidateMatchIndexStatus("byes");
    const db = await openDb();
    await new Promise<void>((res) => { const tx = db.transaction(STORES.meta, "readwrite"); tx.objectStore(STORES.meta).delete("match-index:byes"); tx.oncomplete = () => res(); });
    // poison: if ensureMatchIndex rebuilt, it would re-put rows from archives; detect via a row we delete
    const victim = indexRowsFromEvent("byes", events[2])[0];
    await new Promise<void>((res) => { const tx = db.transaction(STORES.matchIndex, "readwrite"); tx.objectStore(STORES.matchIndex).delete(victim.key); tx.oncomplete = () => res(); });
    await ensureMatchIndex("byes");
    expect(matchIndexStatusCached("byes")).toBe(true);
    expect(await countMatchIndex("byes")).toBe(events.slice(0, 3).reduce((n, e) => n + indexRowsFromEvent("byes", e).length, 0) - 1);
  });
});
