import { createCareerRecord } from "@/game/career/createCareer";
import { useGameStore } from "@/store/gameStore";
import { useNpcStore } from "@/store/npcStore";
import { useSlotUi } from "@/store/slotUi";
import type { NewCareerOptions } from "@/types";
import { beginMeasurement } from "@/diagnostics/performance";
import {
  type CreationProgress,
  DEFAULT_PLAYER_DATABASE,
} from "@/game/npc/playerDatabase";
import { rememberCreationTime } from "./databaseEstimate";

/**
 * Creates the permanent career: builds the NPC database for the chosen start year,
 * then saves the player linked to that country, city, period and database in a save slot.
 */
export async function startCareer(
  options: NewCareerOptions,
  slot: number,
  progress?: (value: CreationProgress) => void,
): Promise<void> {
  const created = beginMeasurement("career.create");
  const started = performance.now();
  const career = createCareerRecord(options);
  await useNpcStore.getState().resetDatabase(career, progress);
  useGameStore.getState().startNewGame(options, career, slot);
  useSlotUi.getState().cancel();
  rememberCreationTime(
    options.playerDatabase ?? DEFAULT_PLAYER_DATABASE,
    career.startYear,
    performance.now() - started,
  );
  created({ npcs: useNpcStore.getState().npcs.length });
}
