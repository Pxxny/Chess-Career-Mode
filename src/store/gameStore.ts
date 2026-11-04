import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { GAME_CONFIG } from '@/data/config';
import { createNewSave } from '@/game/createNewSave';
import { upgradeSave } from '@/game/training/migrate';
import { endDay, performSession, takeRest, type NightReport, type RestKind, type SessionOptions, type SessionResult } from '@/game/training/engine';
import { recordGame, recordTournament, type GameInput, type TournamentInput } from '@/game/history/recordGame';
import { getRankedNpcs, getWorldRank } from '@/game/npc/rankings';
import { applySkillUpgrade } from '@/game/player/training';
import { addMoney, spendActionPoints } from '@/game/player/resources';
import type { CareerRecord, GameSave, NewCareerOptions, SkillKey } from '@/types';
import { idbStorage } from '@/utils/idbStorage';
import { useNpcStore } from './npcStore';

interface GameStore {
  save: GameSave | null;
  startNewGame: (options: NewCareerOptions, career: CareerRecord) => void;
  /** Removes the current career so the character creation screen opens. */
  clearSave: () => void;
  renamePlayer: (name: string) => void;
  setAlternateHistory: (enabled: boolean) => void;
  spendActionPoints: (amount: number) => boolean;
  addMoney: (amount: number) => void;
  /** Spends AP to raise a skill. Returns false when the skill is maxed or AP is too low. */
  upgradeSkill: (skill: SkillKey) => boolean;
  /** Runs a training session. The result says what changed, or why it was blocked. */
  train: (sessionId: string, options?: SessionOptions) => SessionResult;
  /** Spends training hours on a break or nap to recover fatigue. */
  rest: (kind: RestKind) => { ok: true; recovered: number } | { ok: false; error: string };
  /** Sleeps and starts the next day. */
  endDay: () => NightReport | null;
  /** Entry point for the match engine: records a finished rated game. */
  recordGame: (input: GameInput) => void;
  /** Entry point for the match engine: records a finished tournament. */
  recordTournament: (input: TournamentInput) => void;
}

/** Save migrations: upgrade `persisted` when GAME_CONFIG.saveVersion changes. */
function migrateSave(persisted: unknown, fromVersion: number): { save: GameSave | null } {
  // Older saves lack archetype, appearance and a career record; the player creates a new career instead.
  if (fromVersion < 3) return { save: null };
  const state = persisted as { save: GameSave | null };
  // Version 4 added the career history, version 5 the training state and attributes.
  if (state.save) return { save: upgradeSave(state.save) };
  return state;
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

      upgradeSkill: (skill) => {
        const { save } = get();
        if (!save) return false;
        const next = applySkillUpgrade(save, skill);
        if (!next) return false;
        set({ save: next });
        return true;
      },

      train: (sessionId, options) => {
        const { save } = get();
        if (!save) return { ok: false, error: 'No career is loaded.' };
        const result = performSession(save, sessionId, options);
        if (result.ok) set({ save: result.save });
        return result;
      },

      rest: (kind) => {
        const { save } = get();
        if (!save) return { ok: false, error: 'No career is loaded.' };
        const result = takeRest(save, kind);
        if (!result.ok) return result;
        set({ save: result.save });
        return { ok: true, recovered: result.recovered };
      },

      endDay: () => {
        const { save } = get();
        if (!save) return null;
        const { save: next, report } = endDay(save);
        set({ save: next });
        return report;
      },

      recordGame: (input) => {
        const { save } = get();
        if (!save) return;
        const ranked = getRankedNpcs(useNpcStore.getState().npcs);
        const worldRankBefore = getWorldRank(save.player.rating, ranked);
        const provisional = recordGame(save, input);
        const worldRankAfter = getWorldRank(provisional.player.rating, ranked);
        // Run again with the ranks so ranking news is recorded exactly once.
        set({ save: recordGame(save, { ...input, worldRankBefore, worldRankAfter }) });
      },

      recordTournament: (input) => {
        const { save } = get();
        if (save) set({ save: recordTournament(save, input) });
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
