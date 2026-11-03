import { createCareerRecord } from '@/game/career/createCareer';
import { useGameStore } from '@/store/gameStore';
import { useNpcStore } from '@/store/npcStore';
import type { NewCareerOptions } from '@/types';

/**
 * Creates the permanent career: builds the NPC database for the chosen start year,
 * then saves the player linked to that country, city, period and database.
 */
export async function startCareer(options: NewCareerOptions): Promise<void> {
  const career = createCareerRecord(options);
  await useNpcStore.getState().resetDatabase(career);
  useGameStore.getState().startNewGame(options, career);
}
