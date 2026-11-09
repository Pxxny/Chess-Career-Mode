import { configurePredictions } from "@/game/prediction/statistics";
import { reconcileTournamentHistory } from "@/game/npc/tournamentHistory";
import {
  approachNpc,
  cancelSocialInvitation,
  recordSharedEvent,
  recordSharedContacts,
  socialMatchValid,
  type SocialAction,
  type SocialResult,
} from "@/game/social/relationships";
import { beginFriendly, type FriendlyOptions } from "@/game/social/friendly";
import type { MatchSetup } from "@/game/match/session";
import {
  predictionEnvironment,
  recordTournamentPredictions,
} from "@/game/prediction/adapters";
import type { PredictionConfig } from "@/game/prediction/types";
import {
  calendarBookings,
  gameDay,
  tournamentSlot,
  tournamentReady,
} from "@/game/competition/agenda";
import {
  advanceEsports,
  esportsCommand,
  esportsOf,
  esportsRoundDay,
  esportsContextValid,
} from "@/game/esports/core";
import type { EsportsCommand } from "@/game/esports/types";
import {
  workJob,
  requestTransfer,
  settleTransfer,
  plannedTrainingDay,
  type CalendarAdvanceReport,
} from "@/game/qol/career";
import { matchRunning } from "@/store/matchLocks";
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

let calendarCancelled = false;
let calendarOwned = false;
let calendarDaySave: GameSave | null = null;
let calendarSync: Promise<unknown> = Promise.resolve();
interface GameStore {
  approachNpc: (
    npcId: string,
    action: SocialAction,
  ) =>
    | Omit<Extract<SocialResult, { ok: true }>, "save">
    | { ok: false; error: string };
  beginFriendly: (
    options: FriendlyOptions,
    db: OpeningDatabase,
  ) => { ok: true; setup: MatchSetup } | { ok: false; error: string };
  cancelFriendly: () => void;
  dismissYearReview: (year: number) => void;
  calendarProgress: { days: number; total: number; target: string } | null;
  cancelCalendar: () => void;
  simulateUntil: (
    eventId: string,
    sessions: string[],
  ) => Promise<
    { ok: true; report: CalendarAdvanceReport } | { ok: false; error: string }
  >;
  workCareerJob: (id: string) => { ok: true } | { ok: false; error: string };
  requestFederationTransfer: (
    country: string,
  ) => { ok: true } | { ok: false; error: string };
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
  configurePrediction: (config: Partial<PredictionConfig>) => void;
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
  esportsAction: (
    command: EsportsCommand,
  ) => { ok: true; message: string } | { ok: false; error: string };
  advanceCompetitionDay: (
    circuit: "traditional" | "esports",
  ) => { ok: true } | { ok: false; error: string };
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
  acceptShowcaseInvitation: (
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
      approachNpc: (npcId, action) => {
        const save = get().save,
          world = useNpcStore.getState();
        if (!save || world.careerId !== save.career.id)
          return { ok: false, error: "No matching career world is loaded." };
        if (get().calendarProgress || matchRunning(save.career.id))
          return { ok: false, error: "Finish the running activity first." };
        const npc = world.npcs.find((n) => n.id === npcId);
        if (!npc) return { ok: false, error: "This player is not available." };
        const r = approachNpc(save, npc, action);
        if (r.ok) {
          set({ save: r.save });
          return { ok: true, accepted: r.accepted, message: r.message };
        }
        return r;
      },
      beginFriendly: (options, db) => {
        const save = get().save,
          world = useNpcStore.getState();
        if (!save || world.careerId !== save.career.id)
          return { ok: false, error: "No matching career world is loaded." };
        if (get().calendarProgress || matchRunning(save.career.id))
          return { ok: false, error: "Finish the running activity first." };
        const npc = world.npcs.find(
          (n) => n.id === save.social?.pending?.npcId,
        );
        if (!npc) return { ok: false, error: "This player is not available." };
        const r = beginFriendly(save, npc, options, db);
        if (r.ok) {
          set({ save: r.save });
          return { ok: true, setup: r.setup };
        }
        return r;
      },
      cancelFriendly: () => {
        const save = get().save;
        if (save && !matchRunning(save.career.id))
          set({ save: cancelSocialInvitation(save) });
      },
      calendarProgress: null,
      cancelCalendar: () => {
        calendarCancelled = true;
      },
      workCareerJob: (id) => {
        const save = get().save;
        if (!save || get().calendarProgress || matchRunning(save.career.id))
          return { ok: false, error: "Finish the running activity first." };
        const r = workJob(save, id);
        if (r.ok) set({ save: r.save });
        return r.ok ? { ok: true } : r;
      },
      requestFederationTransfer: (country) => {
        const save = get().save;
        if (!save || get().calendarProgress || matchRunning(save.career.id))
          return { ok: false, error: "Finish the running activity first." };
        const r = requestTransfer(save, country);
        if (r.ok) set({ save: r.save });
        return r.ok ? { ok: true } : r;
      },
      simulateUntil: async (eventId, sessions) => {
        const start = get().save;
        if (!start || get().calendarProgress)
          return {
            ok: false,
            error: "A calendar simulation is already running.",
          };
        if (
          start.pendingMatch ||
          start.tournament?.status === "playing" ||
          start.esports?.active?.status === "playing" ||
          matchRunning(start.career.id)
        )
          return {
            ok: false,
            error: "Finish the running game and tournament before advancing.",
          };
        const bookings = calendarBookings(start),
          now = gameDay(start);
        const reg = bookings.find((r) => r.eventId === eventId);
        if (!reg)
          return { ok: false, error: "Register for this tournament first." };
        if (reg.day < now || reg.day - now > 370)
          return {
            ok: false,
            error: "Choose an upcoming registration within 52 weeks.",
          };
        const stop =
          bookings.find((r) => r.day >= now && r.day <= reg.day) ?? reg;
        const total = Math.max(0, stop.day - now);
        const report: CalendarAdvanceReport = {
          days: 0,
          trained: 0,
          skipped: 0,
          stoppedFor: stop.name,
          cancelled: false,
          notes: [],
        };
        calendarCancelled = false;
        set({ calendarProgress: { days: 0, total, target: stop.name } });
        try {
          for (let day = 0; day < total; day++) {
            const current = get().save;
            if (calendarCancelled || current?.career.id !== start.career.id) {
              report.cancelled = true;
              break;
            }
            const plan = plannedTrainingDay(current, sessions);
            report.trained += plan.completed.length;
            report.skipped += plan.skipped.length;
            for (const skip of plan.skipped) {
              const note = `${skip.name}: ${skip.reason}`;
              if (!report.notes.includes(note) && report.notes.length < 8)
                report.notes.push(note);
            }
            calendarOwned = true;
            calendarDaySave = plan.save;
            try {
              get().endDay();
            } finally {
              calendarOwned = false;
              calendarDaySave = null;
            }
            report.days++;
            set({
              calendarProgress: { days: report.days, total, target: stop.name },
            });
            await calendarSync;
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          }
          if (calendarCancelled || get().save?.career.id !== start.career.id)
            report.cancelled = true;
          return { ok: true, report };
        } catch (error) {
          return {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Calendar advance failed. Completed days remain saved.",
          };
        } finally {
          calendarOwned = false;
          calendarDaySave = null;
          set({ calendarProgress: null });
        }
      },
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
        calendarCancelled = true;
        // The slot becomes active first, so the persisted write that follows `set` goes into it.
        void slotManager.setActive(slot);
        set({ save: createNewSave(options, career) });
      },

      leaveSave: () => {
        calendarCancelled = true;
        void slotManager.setActive(null);
        set({ save: null });
      },

      selectSlot: async (slot) => {
        calendarCancelled = true;
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
        if (get().calendarProgress)
          return { ok: false, error: "Calendar simulation is running." };
        const { save } = get();
        if (!save) return { ok: false, error: "No career is loaded." };
        const result = performSession(save, sessionId, options);
        if (result.ok) set({ save: result.save });
        return result;
      },

      rest: (kind) => {
        if (get().calendarProgress)
          return { ok: false, error: "Calendar simulation is running." };
        const { save } = get();
        if (!save) return { ok: false, error: "No career is loaded." };
        const result = takeRest(save, kind);
        if (!result.ok) return result;
        set({ save: result.save });
        return { ok: true, recovered: result.recovered };
      },

      dismissYearReview: (year) => {
        const save = get().save;
        if (save?.yearReview)
          set({
            save: {
              ...save,
              yearReview: {
                ...save.yearReview,
                unread: save.yearReview.unread.filter((y) => y !== year),
              },
            },
          });
      },
      endDay: () => {
        if (get().calendarProgress && !calendarOwned) return null;
        const save =
          calendarOwned && calendarDaySave ? calendarDaySave : get().save;
        if (!save) return null;
        if (
          !calendarOwned &&
          (save.pendingMatch || matchRunning(save.career.id))
        )
          return null;
        const advanced = endDay(save);
        const next = advanceEsports(
            settleTransfer(expireCompetition(advanced.save)),
            useNpcStore.getState().npcs,
          ),
          report = advanced.report;
        calendarSync = Promise.resolve();
        // Apply the new date before selecting circuit entrants, so retiring players cannot compete
        // and this year's cohort is available immediately. Persistence continues asynchronously.
        if (
          report.newWeek &&
          useNpcStore.getState().careerId === save.career.id
        ) {
          calendarSync = useNpcStore
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
        if (next.player.country !== save.player.country) {
          calendarSync = Promise.all([
            calendarSync,
            useNpcStore
              .getState()
              .ensureLocalPool(
                save.career.id,
                next.player.country,
                next.player.city.name,
                next.world.date.year,
              ),
          ]);
        }
        // Settle newly expired tournaments before background fields use those same NPCs.
        if (useNpcStore.getState().careerId === save.career.id) {
          const completed = reconcileTournamentHistory(
            next,
            useNpcStore.getState().npcs,
          );
          if (completed.length)
            void useNpcStore.getState().updateNpcs(completed);
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

      configurePrediction: (config) => {
        const save = get().save;
        if (save) set({ save: configurePredictions(save, config) });
      },

      recordPracticeGame: (input, db) => {
        const { save } = get();
        if (!save) return null;
        if (
          input.prediction &&
          save.prediction?.seen.includes(input.prediction.id)
        )
          return null;
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

      esportsAction: (command) => {
        const save = get().save;
        if (!save) return { ok: false, error: "No career." };
        if (
          get().calendarProgress ||
          matchRunning(save.career.id) ||
          save.pendingMatch
        )
          return { ok: false, error: "Finish the running activity first." };
        const r = esportsCommand(save, useNpcStore.getState().npcs, command);
        if (r.ok) {
          const c = r.save.esports?.active;
          set({
            save:
              command.type === "start" && c
                ? recordSharedContacts(
                    r.save,
                    `esports:${c.event.id}`,
                    c.teams.flatMap((t) => t.members.map((m) => m.id)),
                  )
                : r.save,
          });
        }
        return r.ok ? { ok: true, message: r.message } : r;
      },
      advanceCompetitionDay: (circuit) => {
        const save = get().save;
        if (
          !save ||
          get().calendarProgress ||
          save.pendingMatch ||
          matchRunning(save.career.id)
        )
          return { ok: false, error: "Finish the running activity first." };
        const t = save.tournament,
          e = esportsOf(save).active;
        const target =
          circuit === "traditional" && t?.status === "playing"
            ? tournamentSlot(t).absoluteDay
            : circuit === "esports" && e?.status === "playing"
              ? esportsRoundDay(e)
              : null;
        if (target === null || target <= gameDay(save))
          return { ok: false, error: "Complete today’s games first." };
        for (
          let i = 0;
          i < 64 &&
          get().save?.career.id === save.career.id &&
          gameDay(get().save!) < target;
          i++
        )
          get().endDay();
        return { ok: true };
      },
      finishMatch: (finish, db) => {
        const { save } = get();
        if (!save) return null;
        if (finish.setup.social && !socialMatchValid(save, finish.setup.social))
          return null;
        if (
          !finish.setup.esports &&
          finish.setup.tournament &&
          (save.tournament?.eventId !== finish.setup.tournament.id ||
            save.tournament.status !== "playing" ||
            save.tournament.round !== finish.setup.tournament.round)
        )
          return null;
        if (
          finish.setup.esports &&
          !esportsContextValid(save, finish.setup.esports)
        )
          return null;
        if (
          !finish.setup.esports &&
          finish.setup.tournament &&
          !tournamentReady(save)
        )
          return null;
        if (
          finish.setup.prediction &&
          save.matches.some(
            (m) => m.setup.prediction?.id === finish.setup.prediction?.id,
          )
        )
          return null;
        const ranked = getRankedNpcs(useNpcStore.getState().npcs);
        const applied = applyFinishedMatch(save, finish, db, {
          before: getWorldRank(save.player.rating, ranked),
          after: (r) => getWorldRank(r, ranked),
        });
        if (!applied.record) return null;
        const nextSave =
          finish.moves.length >= 12 || finish.termination === "checkmate"
            ? coachedGame(applied.save)
            : applied.save;
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
        set({ save: nextSave });
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
        if (!save) return;
        if (!save.pendingMatch) {
          if (save.social?.pending?.started && !matchRunning(save.career.id))
            set({ save: cancelSocialInvitation(save) });
          return;
        }
        set({ save: recoverPendingMatch(save, db).save });
      },

      registerForEvent: (event) => {
        if (get().calendarProgress)
          return { ok: false, error: "Calendar simulation is running." };
        const { save } = get();
        if (!save) return { ok: false, error: "No career." };
        const r = registerForEvent(save, event, useNpcStore.getState().npcs);
        if (r.ok) set({ save: r.save });
        return r.ok ? { ok: true } : r;
      },

      acceptShowcaseInvitation: (event) => {
        if (get().calendarProgress)
          return { ok: false, error: "Calendar simulation is running." };
        const { save } = get();
        if (!save) return { ok: false, error: "No career." };
        if (!event.details?.showcase)
          return {
            ok: false,
            error: "This event does not issue showcase invitations.",
          };
        const r = registerForEvent(
          save,
          event,
          useNpcStore.getState().npcs,
          true,
        );
        if (r.ok) set({ save: r.save });
        return r.ok ? { ok: true } : r;
      },

      cancelRegistration: (eventId) => {
        const { save } = get();
        if (save) set({ save: cancelRegistration(save, eventId) });
      },

      startTournament: (eventId) => {
        if (get().calendarProgress)
          return { ok: false, error: "Calendar simulation is running." };
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
        if (r.ok)
          set({
            save: r.save.tournament
              ? recordSharedEvent(r.save, r.save.tournament)
              : r.save,
          });
        return r.ok ? { ok: true } : r;
      },

      withdrawTournament: () => {
        const { save } = get();
        if (!save?.tournament || save.tournament.status !== "playing") return;
        const t = withdraw(save.tournament, predictionEnvironment(save));
        const me = t.players.find((p) => p.isPlayer);
        let next: GameSave = recordTournamentPredictions(
          { ...save, tournament: t },
          t,
        );
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

// Both freshly finished tournaments and retained old archives repair NPC history once.
// The status guard also prevents one character's results leaking into another NPC world.
function syncFinishedNpcEvents() {
  const save = useGameStore.getState().save;
  const world = useNpcStore.getState();
  if (!save || world.status !== "ready" || world.careerId !== save.career.id)
    return;
  const changed = reconcileTournamentHistory(save, world.npcs);
  if (changed.length) void world.updateNpcs(changed);
}
useGameStore.subscribe((state, previous) => {
  if (
    state.save?.career.id !== previous.save?.career.id ||
    state.save?.tournament !== previous.save?.tournament ||
    state.save?.competition?.archive !== previous.save?.competition?.archive ||
    state.save?.esports?.active !== previous.save?.esports?.active ||
    state.save?.esports?.history !== previous.save?.esports?.history
  )
    syncFinishedNpcEvents();
});
useNpcStore.subscribe((state, previous) => {
  if (
    state.status === "ready" &&
    (previous.status !== "ready" || state.careerId !== previous.careerId)
  )
    syncFinishedNpcEvents();
});
