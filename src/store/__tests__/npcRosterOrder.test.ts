import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { DEFAULT_APPEARANCE } from "@/data/appearance";
import { createCareerRecord } from "@/game/career/createCareer";
import { buildLegendNpcs } from "@/game/npc/legends";
import { pickField } from "@/game/match/tournament";
import { createRng } from "@/game/rng";
import type { NewCareerOptions } from "@/types";
import { useGameStore } from "@/store/gameStore";
import { useNpcStore } from "@/store/npcStore";
import { writeNpcDatabase } from "@/store/npcRepository";
import { slotManager } from "@/store/saveSlots";
import { flushPendingWrites } from "@/store/simulationJournal";

it("restores the NPC order used by seeded field selection after reopening a slot", async () => {
  const options: NewCareerOptions = {
    name: "Bench",
    gender: "male",
    countryCode: "TH",
    city: { name: "Bangkok", custom: false },
    archetype: "balanced",
    appearance: DEFAULT_APPEARANCE,
    startYear: 2026,
    alternateHistory: false,
    playerDatabase: "real",
  };
  const career = createCareerRecord(options);
  const npcs = buildLegendNpcs().slice(0, 8).map((npc) => ({
    ...npc,
    careerStatus: "active" as const,
  }));
  const rosterOrder = npcs.map((npc) => npc.id);
  const select = () => pickField(useNpcStore.getState().npcs, 1800, "national", 5, createRng(23))
    .map((npc) => npc.id);
  await slotManager.init();
  await writeNpcDatabase(npcs, career);
  useNpcStore.setState({ careerId: career.id, status: "ready", npcs, rosterOrder });
  useGameStore.getState().startNewGame(options, career, 1);
  const field = select();
  expect(field).toHaveLength(5);
  await flushPendingWrites();
  useGameStore.getState().leaveSave();
  useNpcStore.setState({ careerId: null, status: "idle", npcs: [], rosterOrder: [] });

  expect(await useGameStore.getState().selectSlot(1)).toBe(true);
  const saved = useGameStore.getState().save!;
  expect(saved.npcOrder).toEqual(rosterOrder);
  await useNpcStore.getState().loadDatabase(saved.career, saved.npcOrder);
  expect(useNpcStore.getState().npcs.map((npc) => npc.id)).toEqual(rosterOrder);
  expect(select()).toEqual(field);
});
