import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { GAME_CONFIG } from '@/data/config';
import { createNewSave } from '@/game/createNewSave';
import { addMoney, spendActionPoints } from '@/game/player/resources';
import type { CareerRecord, GameSave, NewCareerOptions } from '@/types';
import { idbStorage } from '@/utils/idbStorage';

interface GameStore {
  save: GameSave | null;
  startNewGame: (options: NewCareerOptions, career: CareerRecord) => void;
  /** Removes the current career so the character creation screen opens. */
  clearSave: () => void;
  renamePlayer: (name: string) => void;
  setAlternateHistory: (enabled: boolean) => void;
  spendActionPoints: (amount: number) => boolean;
  addMoney: (amount: number) => void;
}

/** Save migrations: upgrade `persisted` when GAME_CONFIG.saveVersion changes. */
function migrateSave(persisted: unknown, fromVersion: number): { save: GameSave | null } {
  // Older saves lack archetype, appearance and a career record; the player creates a new career instead.
  if (fromVersion < 3) return { save: null };
  return persisted as { save: GameSave | null };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      save: null,

      startNewGame: (options, career) => set({ save: createNewSave(options, career) }),

      clearSave: () => set({ save: null }),

      renamePlayer: (name) =>
        set((state) => {
          const trimmed = name.trim().slice(0, GAME_CONFIG.maxNameLength);
          if (!state.save || !trimmed) return state;
          return { save: { ...state.save, player: { ...state.save.player, name: trimmed } } };
        }),

      setAlternateHistory: (enabled) =>
        set((state) =>
          state.save ? { save: { ...state.save, world: { ...state.save.world, alternateHistory: enabled } } } : state,
        ),

      spendActionPoints: (amount) => {
        const { save } = get();
        if (!save) return false;
        const player = spendActionPoints(save.player, amount);
        if (!player) return false;
        set({ save: { ...save, player } });
        return true;
      },

      addMoney: (amount) => {
        const { save } = get();
        if (save) set({ save: { ...save, player: addMoney(save.player, amount) } });
      },
    }),
    {
      name: GAME_CONFIG.saveKey,
      version: GAME_CONFIG.saveVersion,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ save: state.save }),
      migrate: migrateSave,
    },
  ),
);
