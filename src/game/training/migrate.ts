import { normalizeHistory } from '@/game/history/createHistory';
import { GAME_CONFIG } from '@/data/config';
import type { GameSave } from '@/types';
import { createPracticeState, createRepertoireState, createStartingAttributes, createTrainingState } from './state';

/** Brings a save from any earlier version up to the current shape. Never discards existing data. */
export function upgradeSave(save: GameSave): GameSave {
  const raw = save as Partial<GameSave> & { player: GameSave['player']; world: GameSave['world'] };
  return {
    ...save,
    version: GAME_CONFIG.saveVersion,
    world: { ...raw.world, day: raw.world.day ?? 1 },
    player: { ...raw.player, attributes: raw.player.attributes ?? createStartingAttributes(raw.player.skills) },
    history: normalizeHistory(raw.history),
    training: { ...createTrainingState(), ...(raw.training ?? {}) },
    practice: { ...createPracticeState(raw.player.rating), ...(raw.practice ?? {}) },
    repertoire: {
      ...createRepertoireState(),
      ...(raw.repertoire ?? {}),
      preferences: { ...createRepertoireState().preferences, ...(raw.repertoire?.preferences ?? {}) },
    },
    matches: raw.matches ?? [],
    tournament: raw.tournament ?? null,
    pendingMatch: raw.pendingMatch ?? null,
  };
}
