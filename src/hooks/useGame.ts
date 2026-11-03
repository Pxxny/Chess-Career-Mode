import { useGameStore } from '@/store/gameStore';
import type { CareerHistory, GameSave, Player, World } from '@/types';

/** Only use below the app gate in App.tsx, where a save is guaranteed to exist. */
export function useSave(): GameSave {
  const save = useGameStore((s) => s.save);
  if (!save) throw new Error('useSave called before a game save exists.');
  return save;
}

export const usePlayer = (): Player => useSave().player;
export const useWorld = (): World => useSave().world;
export const useHistory = (): CareerHistory => useSave().history;
