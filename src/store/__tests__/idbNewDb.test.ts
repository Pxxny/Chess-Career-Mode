import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { openDb, STORES } from "@/utils/idb";

describe("new IndexedDB database", () => {
  it("creates the match index with only the queried indexes", async () => {
    const db = await openDb();
    expect(db.version).toBe(8);
    expect(db.objectStoreNames.contains(STORES.legacyMatchIndex)).toBe(false);
    const names = [...db.transaction(STORES.matchIndex).objectStore(STORES.matchIndex).indexNames].sort();
    expect(names).toEqual(["byEvent", "byNpc"]);
  });
});
