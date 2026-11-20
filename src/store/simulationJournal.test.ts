import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import type { Npc } from "@/types";
import { STORES, transact } from "@/utils/idb";
import { saveSlotKey } from "./saveSlots";
import {
  flushSimulation,
  holdSimulation,
  queueNpcWrites,
  queueSave,
  releaseSimulation,
  simulationActive,
} from "./simulationJournal";

const npc = (id: string, elo: number) => ({ id, currentElo: elo }) as Npc;
const readSlot = (slot: number) => transact<string>([STORES.keyval], "readonly",
  (tx) => tx.objectStore(STORES.keyval).get(saveSlotKey(slot)));
const readNpc = (careerId: string, id: string) => transact<{ npc: Npc }>(
  [STORES.careerNpcs], "readonly",
  (tx) => tx.objectStore(STORES.careerNpcs).get(`${careerId}|${id}`),
);

describe("simulation journal", () => {
  it("persists each latest NPC and the latest save together", async () => {
    const writes: Array<{ store: string; tx: IDBTransaction }> = [];
    const put = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args) {
      writes.push({ store: this.name, tx: this.transaction });
      return put.apply(this, args);
    });
    try {
      holdSimulation();
      expect(simulationActive()).toBe(true);
      await queueSave(1, { state: { n: 1 }, version: 1 });
      await queueNpcWrites("career", [npc("a", 1000), npc("b", 1100)]);
      await queueSave(1, { state: { n: 2 }, version: 1 });
      await queueNpcWrites("career", [npc("a", 1200)]);
      expect(writes).toEqual([]);
      await releaseSimulation();
      expect(writes.map(({ store }) => store)).toEqual([STORES.careerNpcs, STORES.careerNpcs, STORES.keyval]);
      expect(new Set(writes.map(({ tx }) => tx)).size).toBe(1);
      expect(await readNpc("career", "a")).toEqual({ key: "career|a", npc: npc("a", 1200) });
      expect(await readNpc("career", "b")).toEqual({ key: "career|b", npc: npc("b", 1100) });
      expect(JSON.parse((await readSlot(1))!).state.n).toBe(2);
      expect(simulationActive()).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it("keeps the previous save and rolls back NPCs after a failed NPC write", async () => {
    const previous = JSON.stringify({ state: { ok: false }, version: 1 });
    await transact([STORES.keyval], "readwrite", (tx) => {
      tx.objectStore(STORES.keyval).put(previous, saveSlotKey(2));
    });
    holdSimulation();
    await queueSave(2, { state: { ok: true }, version: 1 });
    await queueNpcWrites("retry", [npc("a", 1500), npc("b", 1600)]);
    const put = IDBObjectStore.prototype.put;
    const fail = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === STORES.careerNpcs && args[0]?.key === "retry|b") throw new Error("npc disk full");
      return put.apply(this, args);
    });
    try {
      await expect(releaseSimulation()).rejects.toThrow("npc disk full");
    } finally {
      fail.mockRestore();
    }
    expect(await readSlot(2)).toBe(previous);
    expect(await readNpc("retry", "a")).toBeUndefined();
    await flushSimulation();
    expect((await readNpc("retry", "a"))?.npc).toEqual(npc("a", 1500));
    expect((await readNpc("retry", "b"))?.npc).toEqual(npc("b", 1600));
    expect(JSON.parse((await readSlot(2))!).state.ok).toBe(true);
  });
});
