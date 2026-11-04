import { normalizeHistory } from '@/game/history/createHistory';
import type { GameSave } from '@/types';
import { createStartingAttributes, createTrainingState } from './state';

/** Brings a save from any earlier version up to the current shape. Never discards existing data. */
export function upgradeSave(save: GameSave): GameSave {
  const raw = save as Partial<GameSave> & { player: GameSave['player']; world: GameSave['world'] };
  return {
    ...save,
    world: { ...raw.world, day: raw.world.day ?? 1 },
    player: { ...raw.player, attributes: raw.player.attributes ?? createStartingAttributes(raw.player.skills) },
    history: normalizeHistory(raw.history),
    training: { ...createTrainingState(), ...(raw.training ?? {}) },
  };
}
