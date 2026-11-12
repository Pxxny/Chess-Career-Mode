import { createCareerRecord } from "@/game/career/createCareer";
import { useGameStore } from "@/store/gameStore";
import { useNpcStore } from "@/store/npcStore";
import { useSlotUi } from "@/store/slotUi";
import type { NewCareerOptions } from "@/types";
import { beginMeasurement } from "@/diagnostics/performance";

/**
 * Creates the permanent career: builds the NPC database for the chosen start year,
 * then saves the player linked to that country, city, period and database in a save slot.
 */
export async function startCareer(
  options: NewCareerOptions,
  slot: number,
): Promise<void> {
  const created = beginMeasurement("career.create");
  const career = createCareerRecord(options);
  await useNpcStore.getState().resetDatabase(career);
  useGameStore.getState().startNewGame(options, career, slot);
  useSlotUi.getState().cancel();
  created({ npcs: useNpcStore.getState().npcs.length });
}
