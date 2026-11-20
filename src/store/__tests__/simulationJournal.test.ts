import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import {
  setSimulationWriters, queueSave, queueNpcWrites, flushPendingWrites, holdSimulation, releaseSimulation, simulationPending,
} from "@/store/simulationJournal";
import { saveSlotKey } from "@/store/saveSlots";
import { STORES, transact } from "@/utils/idb";
import type { Npc } from "@/types";

const npc = (id: string, elo: number) => ({ id, currentElo: elo }) as unknown as Npc;

describe("coalesced background writes", () => {
  it("writes NPCs then only the newest save once for a burst of updates", async () => {
    const log: string[] = [];
    setSimulationWriters({
      save: async (_n, json) => { log.push(`save:${JSON.parse(json).state.n}`); },
      npcs: async (list) => { log.push(`npcs:${list.map((n) => `${n.id}=${n.currentElo}`).join(",")}`); },
    });
    const a = queueSave(1, { state: { n: 1 }, version: 1 });
    const b = queueNpcWrites("c", [npc("x", 1), npc("y", 1)]);
    const c = queueSave(1, { state: { n: 2 }, version: 1 });
    const d = queueNpcWrites("c", [npc("x", 2)]);
    await Promise.all([a, b, c, d]);
    expect(log).toEqual(["npcs:x=2,y=1", "save:2"]);
    expect(simulationPending()).toBe(false);
  });

  it("keeps the newest queued save for each slot", async () => {
    const written = new Map<number, unknown>();
    setSimulationWriters({ save: async (slot, json) => { written.set(slot, JSON.parse(json).state); } });
    await Promise.all([
      queueSave(1, { state: "old", version: 1 }),
      queueSave(2, { state: "second character", version: 1 }),
      queueSave(1, { state: "first character", version: 1 }),
    ]);
    expect(written).toEqual(new Map([[1, "first character"], [2, "second character"]]));
  });

  it("keeps order across flushes (a newer save never lands before an older one)", async () => {
    const log: number[] = [];
    let slow = true;
    setSimulationWriters({
      save: async (_n, json) => { const n = JSON.parse(json).state.n; if (slow) { slow = false; await new Promise((r) => setTimeout(r, 60)); } log.push(n); },
      npcs: async () => {},
    });
    const first = queueSave(1, { state: { n: 1 }, version: 1 });
    await new Promise((r) => setTimeout(r, 40)); // first flush is now in flight
    const second = queueSave(1, { state: { n: 2 }, version: 1 });
    await Promise.all([first, second]);
    expect(log).toEqual([1, 2]);
  });

  it("save errors reach the caller; NPC write errors are ignored (as before)", async () => {
    setSimulationWriters({ save: async () => { throw new Error("quota"); }, npcs: async () => { throw new Error("npc"); } });
    await expect(queueSave(1, { state: { n: 3 }, version: 1 })).rejects.toThrow("quota");
    setSimulationWriters({ save: async () => {}, npcs: async () => { throw new Error("npc"); } });
    await expect(queueNpcWrites("c", [npc("z", 1)])).resolves.toBeUndefined();
  });

  it("commits the save and NPCs together, keeping the checkpoint queued after a failure", async () => {
    const readSave = () => transact<string>([STORES.keyval], "readonly",
      (tx) => tx.objectStore(STORES.keyval).get(saveSlotKey(3)));
    const readNpc = () => transact<{ npc: Npc }>([STORES.careerNpcs], "readonly",
      (tx) => tx.objectStore(STORES.careerNpcs).get("checkpoint|q"));
    holdSimulation();
    await flushPendingWrites();
    await queueSave(3, { state: { n: 4 }, version: 1 });
    await queueNpcWrites("checkpoint", [npc("q", 1)]);
    expect(await readSave()).toBeUndefined();
    const put = IDBObjectStore.prototype.put;
    const fail = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === STORES.keyval) throw new Error("quota");
      return put.apply(this, args);
    });
    try {
      await expect(releaseSimulation()).rejects.toThrow("quota");
    } finally {
      fail.mockRestore();
    }
    expect(await readSave()).toBeUndefined();
    expect(await readNpc()).toBeUndefined();
    expect(simulationPending()).toBe(true);
    await flushPendingWrites();
    expect(JSON.parse((await readSave())!).state).toEqual({ n: 4 });
    expect((await readNpc())?.npc).toEqual(npc("q", 1));
    expect(simulationPending()).toBe(false);
  });
});
