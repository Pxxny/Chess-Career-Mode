import { beforeEach, describe, expect, it } from "vitest";
import type { Npc } from "@/types";
import {
  flushSimulation,
  holdSimulation,
  rememberNpcWrites,
  rememberSave,
  releaseSimulation,
  setSimulationWriters,
  simulationActive,
} from "./simulationJournal";

const npc = (id: string, elo: number) => ({ id, currentElo: elo }) as Npc;

describe("simulation journal", () => {
  const saves: string[] = [];
  const npcBatches: string[][] = [];
  let npcFail = false;
  beforeEach(() => {
    saves.length = 0;
    npcBatches.length = 0;
    npcFail = false;
    setSimulationWriters({
      save: async (_name, json) => {
        saves.push(json);
      },
      npcs: async (rows) => {
        if (npcFail) throw new Error("npc disk full");
        npcBatches.push(rows.map((n) => `${n.id}:${n.currentElo}`));
      },
    });
  });

  it("keeps the latest NPC and writes it once, before the save", async () => {
    const order: string[] = [];
    setSimulationWriters({
      save: async (_name, json) => {
        order.push("save");
        saves.push(json);
      },
      npcs: async (rows) => {
        order.push("npcs");
        npcBatches.push(rows.map((n) => `${n.id}:${n.currentElo}`));
      },
    });
    holdSimulation();
    expect(simulationActive()).toBe(true);
    rememberSave("slot", { state: { n: 1 }, version: 1 });
    rememberNpcWrites("career", [npc("a", 1000), npc("b", 1100)]);
    rememberSave("slot", { state: { n: 2 }, version: 1 });
    rememberNpcWrites("career", [npc("a", 1200)]);
    expect(saves).toEqual([]);
    await releaseSimulation();
    expect(order).toEqual(["npcs", "save"]);
    expect(npcBatches).toEqual([["a:1200", "b:1100"]]);
    expect(JSON.parse(saves[0]).state.n).toBe(2);
    expect(simulationActive()).toBe(false);
  });

  it("does not write the save when the NPC flush fails, and retries the same payload", async () => {
    npcFail = true;
    holdSimulation();
    rememberSave("slot", { state: { ok: true }, version: 1 });
    rememberNpcWrites("career", [npc("a", 1500)]);
    await expect(releaseSimulation()).rejects.toThrow("npc disk full");
    expect(saves).toEqual([]);
    npcFail = false;
    await flushSimulation();
    expect(npcBatches).toEqual([["a:1500"]]);
    expect(saves).toHaveLength(1);
  });
});
