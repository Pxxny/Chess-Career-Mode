import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerRecord } from "@/types";

const createNpcPopulation = vi.fn();
const readNpcDatabase = vi.fn();
const writeNpcDatabase = vi.fn().mockResolvedValue(undefined);
const putNpcs = vi.fn().mockResolvedValue(undefined);
const deleteNpcDatabase = vi.fn().mockResolvedValue(undefined);
const isMetaCurrent = vi.fn().mockReturnValue(false);

vi.mock("./npcBuilder", () => ({
  createNpcPopulation: (...args: unknown[]) => createNpcPopulation(...args),
}));

vi.mock("./npcRepository", () => ({
  readNpcDatabase: (...args: unknown[]) => readNpcDatabase(...args),
  writeNpcDatabase: (...args: unknown[]) => writeNpcDatabase(...args),
  putNpcs: (...args: unknown[]) => putNpcs(...args),
  deleteNpcDatabase: (...args: unknown[]) => deleteNpcDatabase(...args),
  isMetaCurrent: (...args: unknown[]) => isMetaCurrent(...args),
}));

import { useNpcStore } from "./npcStore";

const career: CareerRecord = {
  id: "career-test",
  startYear: 2026,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  createdAt: 1,
  databaseKey: "seed:2026:career-test",
};

const sampleNpcs = [{ id: "npc-1" }] as unknown as import("@/types").Npc[];

describe("useNpcStore.loadDatabase", () => {
  beforeEach(() => {
    createNpcPopulation.mockReset();
    readNpcDatabase.mockReset();
    writeNpcDatabase.mockReset().mockResolvedValue(undefined);
    putNpcs.mockReset().mockResolvedValue(undefined);
    deleteNpcDatabase.mockReset().mockResolvedValue(undefined);
    isMetaCurrent.mockReset().mockReturnValue(false);
    useNpcStore.setState({
      status: "idle",
      careerId: null,
      startYear: 0,
      playerDatabase: undefined,
      npcs: [],
      error: null,
    });
    readNpcDatabase.mockRejectedValue(new Error("No stored world"));
  });

  it("does not stay stuck on loading when world generation fails, and a later call can reach ready", async () => {
    createNpcPopulation.mockRejectedValueOnce(
      new Error("Player database worker could not be loaded."),
    );

    await useNpcStore.getState().loadDatabase(career).then(
      () => undefined,
      () => undefined,
    );

    const failed = useNpcStore.getState();
    expect(failed.status).not.toBe("loading");
    expect(failed.status).toBe("error");
    expect(failed.error).toMatch(/could not be loaded/i);

    createNpcPopulation.mockResolvedValueOnce(sampleNpcs);
    await useNpcStore.getState().loadDatabase(career);

    const recovered = useNpcStore.getState();
    expect(recovered.status).toBe("ready");
    expect(recovered.error).toBeNull();
    expect(recovered.npcs).toEqual(sampleNpcs);
    expect(createNpcPopulation).toHaveBeenCalledTimes(2);
  });
});
