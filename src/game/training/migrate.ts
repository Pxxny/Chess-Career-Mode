import { normalizePredictionState } from "@/game/prediction/statistics";
import { qolOf } from "@/game/qol/career";
import { esportsOf } from "@/game/esports/core";
import { competitionOf } from "@/game/competition/preparation";
import { emptyExpansion } from "@/game/career/expansion";
import { normalizeHistory } from "@/game/history/createHistory";
import { GAME_CONFIG } from "@/data/config";
import type { GameSave } from "@/types";
import {
  createPracticeState,
  createRepertoireState,
  createStartingAttributes,
  createTrainingState,
} from "./state";

/** Brings a save from any earlier version up to the current shape. Never discards existing data. */
export function upgradeSave(save: GameSave): GameSave {
  const raw = save as Partial<GameSave> & {
    player: GameSave["player"];
    world: GameSave["world"];
  };
  return {
    ...save,
    version: GAME_CONFIG.saveVersion,
    prediction: normalizePredictionState(raw.prediction),
    esports: esportsOf(save),
    qol: qolOf(save),
    competition: competitionOf(save),
    expansion: { ...emptyExpansion(), ...raw.expansion },
    world: { ...raw.world, day: raw.world.day ?? 1 },
    player: {
      ...raw.player,
      birthPlace: raw.player.birthPlace ?? {
        countryCode: save.career.countryCode,
        city: save.career.city.name,
        source: "legacy",
      },
      attributes:
        raw.player.attributes ?? createStartingAttributes(raw.player.skills),
    },
    history: normalizeHistory(raw.history),
    training: { ...createTrainingState(), ...(raw.training ?? {}) },
    practice: {
      ...createPracticeState(raw.player.rating),
      ...(raw.practice ?? {}),
    },
    repertoire: {
      ...createRepertoireState(),
      ...(raw.repertoire ?? {}),
      preferences: {
        ...createRepertoireState().preferences,
        ...(raw.repertoire?.preferences ?? {}),
      },
    },
    matches: raw.matches ?? [],
    tournament: raw.tournament ?? null,
    pendingMatch: raw.pendingMatch ?? null,
    registrations: raw.registrations ?? [],
  };
}
