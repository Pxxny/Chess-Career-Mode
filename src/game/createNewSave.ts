import { emptyPredictionState } from "./prediction/statistics";
import { emptyQol } from "./qol/career";
import { emptyEsports } from "./esports/core";
import { emptyCompetition } from "./competition/preparation";
import { emptyExpansion } from "./career/expansion";
import { GAME_CONFIG } from "@/data/config";
import type { CareerRecord, GameSave, NewCareerOptions } from "@/types";
import { createEmptyHistory } from "./history/createHistory";
import { createPlayer } from "./player/createPlayer";
import {
  createPracticeState,
  createRepertoireState,
  createTrainingState,
} from "./training/state";

/** NPCs live in their own persistent database, so a save holds the player, the career record and world settings. */
export function createNewSave(
  options: NewCareerOptions,
  career: CareerRecord,
): GameSave {
  return {
    version: GAME_CONFIG.saveVersion,
    prediction: emptyPredictionState(),
    esports: emptyEsports(career.startYear * 364),
    npcNameVersion: 1,
    qol: emptyQol(career.countryCode),
    expansion: emptyExpansion(),
    competition: emptyCompetition(),
    career,
    player: createPlayer(
      { ...options, countryCode: career.countryCode, city: career.city },
      career.startYear,
    ),
    world: {
      seed: GAME_CONFIG.world.seed,
      date: { year: career.startYear, week: 1 },
      day: 1,
      alternateHistory: options.alternateHistory,
    },
    history: createEmptyHistory(),
    training: createTrainingState(),
    practice: createPracticeState(GAME_CONFIG.player.startingRating),
    repertoire: createRepertoireState(),
    matches: [],
    tournament: null,
    pendingMatch: null,
    registrations: [],
  };
}
