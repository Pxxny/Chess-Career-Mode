import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { GAME_CONFIG } from '@/data/config';
import { createNewSave } from '@/game/createNewSave';
import { upgradeSave } from '@/game/training/migrate';
import { endDay, performSession, takeRest, type NightReport, type RestKind, type SessionOptions, type SessionResult } from '@/game/training/engine';
import { recordGame, recordTournament, type GameInput, type TournamentInput } from '@/game/history/recordGame';
import { getRankedNpcs, getWorldRank } from '@/game/npc/rankings';
import { addMoney, spendActionPoints } from '@/game/player/resources';
import { attachAnalysis, recordOpeningStudy, recordPracticeGame, recoverInterruptedPracticeGame, type FinishedGame, type RecordResult } from '@/game/play/practice';
import type { OpeningDatabase } from '@/game/openings/database';
import { applyFinishedMatch, applyNpcResult, attachMatchAnalysis, outcomeFor, recoverPendingMatch } from '@/game/match/aftermath';
import type { MatchFinish } from '@/game/match/session';
import { withdraw } from '@/game/match/tournament';
import { cancelRegistration, registerForEvent, startRegisteredTournament } from '@/game/match/registration';
import type { ScheduledEvent } from '@/game/world/schedule';
import type { MatchAnalysisReport, MatchRecord, PendingMatch } from '@/types';
import type { CareerRecord, GameAnalysisSummary, GameSave, NewCareerOptions, SituationId } from '@/types';
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
  /** Records a finished Training, Online Blitz or Engine game (or a simulated one). Null without a career. */
  recordPracticeGame: (input: FinishedGame, db: OpeningDatabase) => RecordResult | null;
  checkpointPracticeGame: (input: FinishedGame | null) => void;
  recoverPracticeGame: (db: OpeningDatabase) => void;
  /** Stores the post-game analysis on a practice game. */
  attachAnalysis: (gameId: string, analysis: GameAnalysisSummary) => void;
  /** Records a finished match viewer game: rated result, fatigue and morale, the tournament round, the stored match. */
  finishMatch: (finish: MatchFinish, db: OpeningDatabase) => MatchRecord | null;
  /** Stores the engine analysis of a match and sets the accuracy of its rated game. */
  attachMatchAnalysis: (matchId: string, report: MatchAnalysisReport) => void;
  checkpointMatch: (pending: PendingMatch | null) => void;
  /** A game left open by a closed page is recorded as abandoned. */
  recoverMatch: (db: OpeningDatabase) => void;
  /** Registers for an upcoming event and pays the entry fee. */
  registerForEvent: (event: ScheduledEvent) => { ok: true } | { ok: false; error: string };
  /** Cancels a registration (refunded before the event week). */
  cancelRegistration: (eventId: string) => void;
  /** Starts the tournament of a registration once its week has come. */
  startTournament: (eventId: string) => { ok: true } | { ok: false; error: string };
  /** Leaves the running tournament: the remaining games are forfeited. */
  withdrawTournament: () => void;
  /** Closes the results of a finished tournament. */
  closeTournament: () => void;
  /** Replaces the ordered opening list of one repertoire situation. */
  setPreference: (situation: SituationId, openingIds: string[]) => void;
  /** Records a finished Thematic Games study of an opening. */
  recordOpeningStudy: (openingId: string, openingName: string, score: number) => void;
}

/** Save migrations: upgrade `persisted` when GAME_CONFIG.saveVersion changes. */
function migrateSave(persisted: unknown, fromVersion: number): { save: GameSave | null } {
  // Older saves lack archetype, appearance and a career record; the player creates a new career instead.
  if (fromVersion < 3) return { save: null };
  const state = persisted as { save: GameSave | null };
  // Version 4 added the career history, version 5 the training state and attributes, version 6 practice games and the repertoire.
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

      recordPracticeGame: (input, db) => {
        const { save } = get();
        if (!save) return null;
        const result = recordPracticeGame(save, input, db);
        set({ save: result.save });
        return result;
      },

      checkpointPracticeGame: (input) => {
        const { save } = get();
        if (save) set({ save: { ...save, practice: { ...save.practice, pendingGame: input } } });
      },

      recoverPracticeGame: (db) => {
        const { save } = get();
        if (!save?.practice.pendingGame) return;
        set({ save: recoverInterruptedPracticeGame(save, db) });
      },

      finishMatch: (finish, db) => {
        const { save } = get();
        if (!save) return null;
        const ranked = getRankedNpcs(useNpcStore.getState().npcs);
        const applied = applyFinishedMatch(save, finish, db, { before: getWorldRank(save.player.rating, ranked), after: (r) => getWorldRank(r, ranked) });
        set({ save: applied.save });
        const opponent = finish.setup.playerColor === 'white' ? finish.setup.black : finish.setup.white;
        if (finish.setup.rated && opponent.id) {
          const npc = useNpcStore.getState().npcs.find((n) => n.id === opponent.id);
          const outcome = outcomeFor(finish, finish.setup.playerColor);
          if (npc) void useNpcStore.getState().updateNpcs([applyNpcResult(npc, outcome === 'win' ? 'loss' : outcome === 'loss' ? 'win' : 'draw', save.player.rating)]);
        }
        return applied.record;
      },

      attachMatchAnalysis: (matchId, report) => {
        const { save } = get();
        if (save) set({ save: attachMatchAnalysis(save, matchId, report) });
      },

      checkpointMatch: (pending) => {
        const { save } = get();
        if (save) set({ save: { ...save, pendingMatch: pending } });
      },

      recoverMatch: (db) => {
        const { save } = get();
        if (!save?.pendingMatch) return;
        set({ save: recoverPendingMatch(save, db).save });
      },

      registerForEvent: (event) => {
        const { save } = get();
        if (!save) return { ok: false, error: 'No career.' };
        const r = registerForEvent(save, event);
        if (r.ok) set({ save: r.save });
        return r.ok ? { ok: true } : r;
      },

      cancelRegistration: (eventId) => {
        const { save } = get();
        if (save) set({ save: cancelRegistration(save, eventId) });
      },

      startTournament: (eventId) => {
        const { save } = get();
        if (!save) return { ok: false, error: 'No career.' };
        const seed = (save.world.seed ^ (save.world.date.year * 100 + save.world.date.week) ^ (eventId.length * 7919)) >>> 0;
        const r = startRegisteredTournament(save, eventId, useNpcStore.getState().npcs, seed);
        if (r.ok) set({ save: r.save });
        return r.ok ? { ok: true } : r;
      },

      withdrawTournament: () => {
        const { save } = get();
        if (!save?.tournament || save.tournament.status !== 'playing') return;
        const t = withdraw(save.tournament);
        const me = t.players.find((p) => p.isPlayer);
        let next: GameSave = { ...save, tournament: t };
        next = recordTournament(next, { tournamentId: t.eventId, name: t.name, level: t.level, rank: t.finalRank ?? t.players.length, fieldSize: t.players.length, points: me?.points ?? 0, prize: 0 });
        set({ save: next });
      },

      closeTournament: () => {
        const { save } = get();
        if (save?.tournament?.status === 'finished') set({ save: { ...save, tournament: null } });
      },

      attachAnalysis: (gameId, analysis) => {
        const { save } = get();
        if (save) set({ save: attachAnalysis(save, gameId, analysis) });
      },

      setPreference: (situation, openingIds) => {
        const { save } = get();
        if (!save) return;
        set({ save: { ...save, repertoire: { ...save.repertoire, preferences: { ...save.repertoire.preferences, [situation]: openingIds } } } });
      },

      recordOpeningStudy: (openingId, openingName, score) => {
        const { save } = get();
        if (save) set({ save: recordOpeningStudy(save, openingId, openingName, score) });
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
