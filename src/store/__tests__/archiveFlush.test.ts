import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import { flushEventArchive, readArchiveFlushMarker, setArchiveFlushHooks, ARCHIVE_CHUNK_ROWS } from "@/store/archiveFlush";
import { readEventArchive } from "@/store/tournamentArchive";
import { countMatchIndex, readNpcIndex, readEventIndex } from "@/store/matchIndex";
import { indexRowsFromEvent, eventInvolves } from "@/game/history/matchLedger";
import { swissEvent, teamEvent } from "./fixtures";

const events = Array.from({ length: 30 }, (_, i) => swissEvent(`e${i}`, 2026, 40, 9, i * 3));
const expectedRows = events.reduce((n, e) => n + indexRowsFromEvent("c1", e).length, 0);

describe("chunked tournament archive flush", () => {
  beforeEach(() => setArchiveFlushHooks({}));

  it("writes every event and row in several chunks and commits a verified marker", async () => {
    expect(expectedRows).toBeGreaterThan(ARCHIVE_CHUNK_ROWS); // really chunked
    const marker = await flushEventArchive("c1", events);
    expect(marker?.state).toBe("committed");
    expect(marker!.chunksDone).toBeGreaterThan(1);
    expect(marker!.rowsWritten).toBe(expectedRows);
    expect(marker!.verifiedEvents).toBe(events.length);
    expect((await readEventArchive("c1")).length).toBe(events.length);
    expect(await countMatchIndex("c1")).toBe(expectedRows);
  });

  it("is idempotent: a repeated flush adds no duplicate rows or events", async () => {
    await flushEventArchive("c1", events);
    expect(await countMatchIndex("c1")).toBe(expectedRows);
    expect((await readEventArchive("c1")).length).toBe(events.length);
  });

  it("an interrupted flush stays 'writing' and a retry completes it", async () => {
    setArchiveFlushHooks({ afterChunk: (n) => { if (n === 2) throw new Error("tab closed"); } });
    await expect(flushEventArchive("c2", events)).rejects.toThrow("tab closed");
    const partial = await readArchiveFlushMarker("c2");
    expect(partial?.state).toBe("writing");
    expect(partial?.chunksDone).toBe(2);
    const rowsPartial = await countMatchIndex("c2");
    expect(rowsPartial).toBeGreaterThan(0);
    expect(rowsPartial).toBeLessThan(expectedRows);
    // every stored event already has all of its rows (event + rows share one transaction)
    for (const e of await readEventArchive("c2"))
      expect((await readEventIndex("c2", e.id)).length).toBe(indexRowsFromEvent("c2", e).length);
    setArchiveFlushHooks({});
    const marker = await flushEventArchive("c2", events);
    expect(marker?.state).toBe("committed");
    expect(await countMatchIndex("c2")).toBe(events.reduce((n, e) => n + indexRowsFromEvent("c2", e).length, 0));
  });

  it("team events index members and reserves; eventInvolves never misses a seated id", async () => {
    const team = teamEvent("t1", 2026);
    await flushEventArchive("c3", [team]);
    expect((await readNpcIndex("c3", "reserve-a")).length).toBe(1);
    expect((await readNpcIndex("c3", "m-b1")).length).toBe(2);
    for (const e of [...events.slice(0, 5), team])
      for (const row of indexRowsFromEvent("c3", e)) expect(eventInvolves(e, row.npcId)).toBe(true);
    expect(eventInvolves(team, "nobody")).toBe(false);
  });
});
