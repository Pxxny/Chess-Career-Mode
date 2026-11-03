import { GAME_CONFIG } from '@/data/config';
import type { CareerRecord, GameSave, NewCareerOptions } from '@/types';
import { createPlayer } from './player/createPlayer';

/** NPCs live in their own persistent database, so a save holds the player, the career record and world settings. */
export function createNewSave(options: NewCareerOptions, career: CareerRecord): GameSave {
  return {
    version: GAME_CONFIG.saveVersion,
    career,
    player: createPlayer({ ...options, countryCode: career.countryCode, city: career.city }, career.startYear),
    world: {
      seed: GAME_CONFIG.world.seed,
      date: { year: career.startYear, week: 1 },
      alternateHistory: options.alternateHistory,
    },
  };
}
