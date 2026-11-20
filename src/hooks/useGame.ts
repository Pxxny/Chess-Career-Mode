import { useGameStore } from '@/store/gameStore';
import type { CareerHistory, GameSave, Player, World } from '@/types';

/** Only use below the app gate in App.tsx, where a save is guaranteed to exist. */
export function useSave(): GameSave {
  const save = useGameStore((s) => s.save);
  if (!save) throw new Error('useSave called before a game save exists.');
  return save;
}

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`${name} called before a game save exists.`);
  return value;
}

// Narrow selectors: these re-render only when their own slice changes (each slice is replaced
// immutably), not on every save update such as a day's training XP or news.
export const usePlayer = (): Player => required(useGameStore((s) => s.save?.player), 'usePlayer');
export const useWorld = (): World => required(useGameStore((s) => s.save?.world), 'useWorld');
export const useHistory = (): CareerHistory => required(useGameStore((s) => s.save?.history), 'useHistory');
/** Current calendar year only. */
export const useYear = (): number => required(useGameStore((s) => s.save?.world.date.year), 'useYear');
