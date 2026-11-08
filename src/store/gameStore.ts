import { expireCompetition } from "@/game/competition/calendar";
import {
  prepareEvent,
  scoutOpponent,
  setCompetitionConfig,
  archiveCompetition,
} from "@/game/competition/preparation";
import type { CompetitionState } from "@/game/competition/types";
import {
  hireCoach,
  joinFederation,
  playTeamCup,
  stateOf,
  coachedGame,
  weeklyCircuit,
  news,
  type CoachTerm,
} from "@/game/career/expansion";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { GAME_CONFIG } from "@/data/config";
import { createNewSave } from "@/game/createNewSave";
import { upgradeSave } from "@/game/training/migrate";
import {
  endDay,
  performSession,
  takeRest,
  type NightReport,
  type RestKind,
  type SessionOptions,
  type SessionResult,
} from "@/game/training/engine";
import {
  recordGame,
  recordTournament,
  type GameInput,
  type TournamentInput,
} from "@/game/history/recordGame";
import { getRankedNpcs, getWorldRank } from "@/game/npc/rankings";
import { addMoney, spendActionPoints } from "@/game/player/resources";
import {
  attachAnalysis,
  recordOpeningStudy,
  recordPracticeGame,
  recoverInterruptedPracticeGame,
  type FinishedGame,
  type RecordResult,
} from "@/game/play/practice";
import type { OpeningDatabase } from "@/game/openings/database";
import {
  applyFinishedMatch,
  applyNpcResult,
  attachMatchAnalysis,
  outcomeFor,
  recoverPendingMatch,
} from "@/game/match/aftermath";
import type { MatchFinish } from "@/game/match/session";
import { withdraw } from "@/game/match/tournament";
import {
  cancelRegistration,
  registerForEvent,
  startRegisteredTournament,
} from "@/game/match/registration";
import type { ScheduledEvent } from "@/game/world/schedule";
import type { MatchAnalysisReport, MatchRecord, PendingMatch } from "@/types";
import type {
  CareerRecord,
  GameAnalysisSummary,
  GameSave,
  NewCareerOptions,
  SituationId,
} from "@/types";
import { slotManager, summarize } from "./saveSlots";
import { useNpcStore } from "./npcStore";

interface GameStore {
  configureCompetition: (
    patch: Partial<Pick<CompetitionState, "target" | "plan" | "repertoire">>,
  ) => void;
  prepareCompetition: (
    db: OpeningDatabase,
  ) => { ok: true } | { ok: false; error: string };
  scoutCompetitionOpponent: (
    id: string,
    eventId: string,
  ) => { ok: true } | { ok: false; error: string };
  save: GameSave | null;
  clearSave: () => Promise<void>;
  hireCoach: (
    id: string,
    term: CoachTerm,
  ) => { ok: true } | { ok: false; error: string };
  cancelCoach: () => void;
  joinFederation: () => { ok: true } | { ok: false; error: string };
  playTeamCup: () => { ok: true } | { ok: false; error: string };
  populationNews: (
    careerId: string,
    year: number,
    joined: number,
    retired: string[],
  ) => void;
  /** Starts a new character in a save slot (1 to GAME_CONFIG.saveSlots) and opens it. */
  startNewGame: (
    options: NewCareerOptions,
    career: CareerRecord,
    slot: number,
  ) => void;
  /** Closes the open character without deleting it, so the character slots screen opens. */
  leaveSave: () => void;
  /** Opens the character saved in a slot. False when the slot is empty or cannot be read. */
  selectSlot: (slot: number) => Promise<boolean>;
  /** Deletes the character in a slot together with its NPC world. */
  deleteSlot: (slot: number) => Promise<void>;
  renamePlayer: (name: string) => void;
  setAlternateHistory: (enabled: boolean) => void;
  spendActionPoints: (amount: number) => boolean;
  addMoney: (amount: number) => void;
  /** Spends AP to raise a skill. Returns false when the skill is maxed or AP is too low. */
  /** Runs a training session. The result says what changed, or why it was blocked. */
  train: (sessionId: string, options?: SessionOptions) => SessionResult;
  /** Spends training hours on a break or nap to recover fatigue. */
  rest: (
    kind: RestKind,
  ) => { ok: true; recovered: number } | { ok: false; error: string };
  /** Sleeps and starts the next day. */
  endDay: () => NightReport | null;
  /** Entry point for the match engine: records a finished rated game. */
  recordGame: (input: GameInput) => void;
  /** Entry point for the match engine: records a finished tournament. */
  recordTournament: (input: TournamentInput) => void;
  /** Records a finished Training, Online Blitz or Engine game (or a simulated one). Null without a career. */
  recordPracticeGame: (
    input: FinishedGame,
    db: OpeningDatabase,
  ) => RecordResult | null;
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
  registerForEvent: (
    event: ScheduledEvent,
  ) => { ok: true } | { ok: false; error: string };
  /** Cancels a registration (refunded before the event week). */
  cancelRegistration: (eventId: string) => void;
  /** Starts the tournament of a registration once its week has come. */
  startTournament: (
    eventId: string,
  ) => { ok: true } | { ok: false; error: string };
  /** Leaves the running tournament: the remaining games are forfeited. */
  withdrawTournament: () => void;
  /** Closes the results of a finished tournament. */
  closeTournament: () => void;
  /** Replaces the ordered opening list of one repertoire situation. */
  setPreference: (situation: SituationId, openingIds: string[]) => void;
  /** Records a finished Thematic Games study of an opening. */
  recordOpeningStudy: (
    openingId: string,
    openingName: string,
    score: number,
  ) => void;
}

/** Save migrations: upgrade `persisted` when GAME_CONFIG.saveVersion changes. */
function migrateSave(
  persisted: unknown,
  fromVersion: number,
): { save: GameSave | null } {
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
      clearSave: async () => {
        const slot = slotManager.getActive();
        if (slot !== null) await get().deleteSlot(slot);
      },
      hireCoach: (id, term) => {
        const save = get().save;
        if (!save) return { ok: false, error: "No career." };
        const r = hireCoach(save, id, term);
        if (r.ok) set({ save: r.save });
        return r.ok ? { ok: true } : r;
      },
      cancelCoach: () => {
        const save = get().save;
        if (save)
          set({
            save: { ...save, expansion: { ...stateOf(save), coach: null } },
          });
      },
      joinFederation: () => {
        const save = get().save;
        if (!save) return { ok: false, error: "No career." };
        const r = joinFederation(save);
        if (r.ok) set({ save: r.save });
        return r.ok ? { ok: true } : r;
      },
      configureCompetition: (patch) => {
        const save = get().save;
        if (save) set({ save: setCompetitionConfig(save, patch) });
      },
      prepareCompetition: (db) => {
        const save = get().save;
        if (!save) return { ok: false, error: "No career." };
        const r = prepareEvent(save, db);
        if (r.ok) set({ save: r.save });
        return r.ok ? { ok: true } : r;
      },
      scoutCompetitionOpponent: (id, eventId) => {
        const save = get().save,
          npc = useNpcStore.getState().npcs.find((n) => n.id === id);
        if (!save || !npc) return { ok: false, error: "Opponent unavailable." };
        const r = scoutOpponent(save, npc, eventId);
        if (r.ok) set({ save: r.save });
        return r.ok ? { ok: true } : r;
      },
      playTeamCup: () => {
        const save = get().save;
        if (!save) return { ok: false, error: "No career." };
        const r = playTeamCup(save, useNpcStore.getState().npcs);
        if (r.ok) set({ save: r.save });
        return r.ok ? { ok: true } : r;
      },
      populationNews: (careerId, year, joined, retired) => {
        let save = get().save;
        if (!save || save.career.id !== careerId) return;
        if (joined)
          save = news(
            save,
            `recruits-${year}`,
            `${joined} new players enter the circuit`,
            "Annual cohorts are generated once per year and kept in this career’s NPC world.",
          );
        if (retired.length)
          save = news(
            save,
            `retire-${year}-${save.world.date.week}`,
            `${retired.length} players retire`,
            retired.slice(0, 8).join(", ") +
              ". Fictional players retire at age 65.",
          );
        set({ save });
      },

      startNewGame: (options, career, slot) => {
        // The slot becomes active first, so the persisted write that follows `set` goes into it.
        void slotManager.setActive(slot);
        set({ save: createNewSave(options, career) });
      },

      leaveSave: () => {
        void slotManager.setActive(null);
        set({ save: null });
      },

      selectSlot: async (slot) => {
        let persisted: { state?: unknown; version?: number } | null = null;
        try {
          const raw = await slotManager.readSlot(slot);
          persisted = raw
            ? (JSON.parse(raw) as { state?: unknown; version?: number })
            : null;
        } catch {
          return false;
        }
        const loaded = persisted?.state
          ? migrateSave(persisted.state, persisted.version ?? 0)
          : null;
        if (!loaded?.save) return false;
        await slotManager.setActive(slot);
        set({ save: loaded.save });
        return true;
      },

      deleteSlot: async (slot) => {
        const careerId = summarize(
          slot,
          await slotManager.readSlot(slot),
        )?.careerId;
        const wasOpen = slotManager.getActive() === slot;
        const deleting = slotManager.deleteSlot(slot);
        if (wasOpen) set({ save: null });
        await deleting;
        if (careerId) await useNpcStore.getState().forgetCareer(careerId);
      },

      renamePlayer: (name) =>
        set((state) => {
          const trimmed = name.trim().slice(0, GAME_CONFIG.maxNameLength);
          if (!state.save || !trimmed) return state;
          return {
            save: {
              ...state.save,
              player: { ...state.save.player, name: trimmed },
            },
          };
        }),

      setAlternateHistory: (enabled) =>
        set((state) =>
          state.save
            ? {
                save: {
                  ...state.save,
                  world: { ...state.save.world, alternateHistory: enabled },
                },
              }
            : state,
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
        if (save)
          set({ save: { ...save, player: addMoney(save.player, amount) } });
      },

      train: (sessionId, options) => {
        const { save } = get();
        if (!save) return { ok: false, error: "No career is loaded." };
        const result = performSession(save, sessionId, options);
        if (result.ok) set({ save: result.save });
        return result;
      },

      rest: (kind) => {
        const { save } = get();
        if (!save) return { ok: false, error: "No career is loaded." };
        const result = takeRest(save, kind);
        if (!result.ok) return result;
        set({ save: result.save });
        return { ok: true, recovered: result.recovered };
      },

      endDay: () => {
        const { save } = get();
        if (!save) return null;
        const advanced = endDay(save);
        const next = expireCompetition(advanced.save),
          report = advanced.report;
        // Apply the new date before selecting circuit entrants, so retiring players cannot compete
        // and this year's cohort is available immediately. Persistence continues asynchronously.
        if (
          report.newWeek &&
          useNpcStore.getState().careerId === save.career.id
        ) {
          void useNpcStore
            .getState()
            .syncWorld({
              year: next.world.date.year,
              week: next.world.date.week,
              alternateHistory: next.world.alternateHistory,
            })
            .then((population) => {
              if (population.joined.length || population.retired.length)
                get().populationNews(
                  save.career.id,
                  next.world.date.year,
                  population.joined.length,
                  population.retired.map((n) => n.name),
                );
            });
        }
        const bulletin = report.newWeek
          ? weeklyCircuit(next, useNpcStore.getState().npcs)
          : { save: next, changed: [] };
        set({ save: bulletin.save });
        if (
          bulletin.changed.length &&
          useNpcStore.getState().careerId === save.career.id
        )
          void useNpcStore.getState().updateNpcs(bulletin.changed);
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
        set({
          save: recordGame(save, { ...input, worldRankBefore, worldRankAfter }),
        });
      },

      recordTournament: (input) => {
        const { save } = get();
        if (save) set({ save: recordTournament(save, input) });
      },

      recordPracticeGame: (input, db) => {
        const { save } = get();
        if (!save) return null;
        const result = recordPracticeGame(save, input, db);
        set({
          save:
            input.moves.length >= 12 || input.termination === "checkmate"
              ? coachedGame(result.save)
              : result.save,
        });
        return result;
      },

      checkpointPracticeGame: (input) => {
        const { save } = get();
        if (save)
          set({
            save: {
              ...save,
              practice: { ...save.practice, pendingGame: input },
            },
          });
      },

      recoverPracticeGame: (db) => {
        const { save } = get();
        if (!save?.practice.pendingGame) return;
        set({ save: recoverInterruptedPracticeGame(save, db) });
      },

      finishMatch: (finish, db) => {
        const { save } = get();
        if (!save) return null;
        if (
          finish.setup.tournament &&
          (save.tournament?.eventId !== finish.setup.tournament.id ||
            save.tournament.status !== "playing" ||
            save.tournament.round !== finish.setup.tournament.round)
        )
          return null;
        const ranked = getRankedNpcs(useNpcStore.getState().npcs);
        const applied = applyFinishedMatch(save, finish, db, {
          before: getWorldRank(save.player.rating, ranked),
          after: (r) => getWorldRank(r, ranked),
        });
        set({
          save:
            finish.moves.length >= 12 || finish.termination === "checkmate"
              ? coachedGame(applied.save)
              : applied.save,
        });
        const opponent =
          finish.setup.playerColor === "white"
            ? finish.setup.black
            : finish.setup.white;
        if (finish.setup.rated && opponent.id) {
          const npc = useNpcStore
            .getState()
            .npcs.find((n) => n.id === opponent.id);
          const outcome = outcomeFor(finish, finish.setup.playerColor);
          if (npc)
            void useNpcStore
              .getState()
              .updateNpcs([
                applyNpcResult(
                  npc,
                  outcome === "win"
                    ? "loss"
                    : outcome === "loss"
                      ? "win"
                      : "draw",
                  save.player.rating,
                ),
              ]);
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
        if (!save) return { ok: false, error: "No career." };
        const r = registerForEvent(save, event, useNpcStore.getState().npcs);
        if (r.ok) set({ save: r.save });
        return r.ok ? { ok: true } : r;
      },

      cancelRegistration: (eventId) => {
        const { save } = get();
        if (save) set({ save: cancelRegistration(save, eventId) });
      },

      startTournament: (eventId) => {
        const { save } = get();
        if (!save) return { ok: false, error: "No career." };
        const seed =
          (save.world.seed ^
            (save.world.date.year * 100 + save.world.date.week) ^
            (eventId.length * 7919)) >>>
          0;
        const r = startRegisteredTournament(
          save,
          eventId,
          useNpcStore.getState().npcs,
          seed,
        );
        if (r.ok) set({ save: r.save });
        return r.ok ? { ok: true } : r;
      },

      withdrawTournament: () => {
        const { save } = get();
        if (!save?.tournament || save.tournament.status !== "playing") return;
        const t = withdraw(save.tournament);
        const me = t.players.find((p) => p.isPlayer);
        let next: GameSave = { ...save, tournament: t };
        next = recordTournament(next, {
          tournamentId: t.eventId,
          name: t.name,
          level: t.level,
          rank: t.finalRank ?? t.players.length,
          fieldSize: t.players.length,
          points: me?.points ?? 0,
          prize: 0,
        });
        set({ save: next });
      },

      closeTournament: () => {
        const { save } = get();
        if (save?.tournament?.status === "finished")
          set({ save: { ...archiveCompetition(save), tournament: null } });
      },

      attachAnalysis: (gameId, analysis) => {
        const { save } = get();
        if (save) set({ save: attachAnalysis(save, gameId, analysis) });
      },

      setPreference: (situation, openingIds) => {
        const { save } = get();
        if (!save) return;
        set({
          save: {
            ...save,
            repertoire: {
              ...save.repertoire,
              preferences: {
                ...save.repertoire.preferences,
                [situation]: openingIds,
              },
            },
          },
        });
      },

      recordOpeningStudy: (openingId, openingName, score) => {
        const { save } = get();
        if (save)
          set({
            save: recordOpeningStudy(save, openingId, openingName, score),
          });
      },
    }),
    {
      name: GAME_CONFIG.saveKey,
      version: GAME_CONFIG.saveVersion,
      storage: createJSONStorage(() => slotManager.storage),
      partialize: (state) => ({ save: state.save }),
      migrate: migrateSave,
      // `migrate` only runs when the stored version differs from the current one, so a save written by an earlier build of
      // the same version (for example one without `registrations`) would reach the screens incomplete. Bring every loaded save up to the current shape.
      merge: (persisted, current) => {
        const stored = (persisted as { save?: GameSave | null } | undefined)
          ?.save;
        return { ...current, save: stored ? upgradeSave(stored) : null };
      },
    },
  ),
);
