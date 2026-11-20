import { awaitingArmageddon } from "@/game/competition/bulgariaChess";
import { chooseCareer } from "@/utils/temporaryCareer";
import { useLoadingStatus } from "./loadingStatus";
import { competitionHealthIssue } from "@/game/career/health";
import { retirementIssue } from "@/game/career/retirement";
import { toggleWatchlist } from "@/game/social/directory";
import { careerCommand, settleActivities, type CareerCommand } from "@/game/career/activities";
import type { Npc } from "@/types";
import { applyNpcPlayerGame } from "@/game/npc/playerResults";
import { acknowledgeArticle, highlightsOf, captureHighlights } from "@/game/career/highlights";
import { createSeasonGameClient } from "./seasonGameClient";
import type { LearningFocus } from "@/game/career/learningFocus";
import { queueMatchRecords, writeMatchArchive } from "./matchArchive";
import {
  autoTrainAndRest,
  newSeason,
  runSeason,
  seasonOf,
  updateSeason,
} from "@/game/career/seasonSimulation";
import { getBaseOpeningDatabase } from "@/game/openings/database";
import { retainedArchives, type ArchivedEvent } from "@/game/competition/archive";
import {
  updateBroadcast,
  type BroadcastContext,
} from "@/game/competition/broadcast";
import type { BroadcastGame } from "@/types";
import { writeEventArchive, writeMissingEventArchive } from "./tournamentArchive";
import { waitForMatchIndex } from "./matchIndex";
import { beginMeasurement } from "@/diagnostics/performance";
import { advanceCalendarTournamentSteps } from "@/game/competition/worldCalendar";
import { drainSteps, runStepsSliced, type Steps } from "@/game/steps";
import { chooseAnnualFocus, type AnnualFocus } from "@/game/career/planning";
import {
  signSponsor,
  cancelSponsor,
  changeLegacyRole,
  legacyService,
  type LegacyRole,
} from "@/game/career/business";
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
import { chooseSelectReward as applySelectReward } from "@/game/competition/selectTours";
import {
  hireCoach,
  joinFederation,
  stateOf,
  coachedGame,
  weeklyCircuitSteps,
  news,
  type CoachTerm,
} from "@/game/career/expansion";
import { create } from "zustand";
import { persist, type StorageValue } from "zustand/middleware";
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
  attachMatchAnalysis,
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
import { queueSave, holdSimulation, releaseSimulation, simulationActive, flushPendingWrites } from "./simulationJournal";
import { useNpcStore } from "./npcStore";

let calendarCancelled = false;
let calendarOwned = false;
let calendarDaySave: GameSave | null = null;
let calendarSync: Promise<unknown> = Promise.resolve();
interface GameStore {
  retireCareer: () => { ok: true } | { ok: false; error: string };
  readArticle: (id: string) => void;
  seasonRunning: boolean;
  simulateSeason: (
    focus?: AnnualFocus,
    learningFocus?: LearningFocus[],
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  broadcastCheckpoint: (
    context: BroadcastContext,
    state: BroadcastGame,
  ) => boolean;
  careerAction: (
    command:
      | { type: "focus"; focus: AnnualFocus }
      | { type: "sponsor"; id: string }
      | { type: "cancel-sponsor" }
      | { type: "legacy-role"; role: LegacyRole }
      | { type: "legacy-service" },
  ) => { ok: true } | { ok: false; error: string };
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
  chooseSelectReward: (
    finalId: string,
    choice: "host" | "quota",
  ) => { ok: true } | { ok: false; error: string };
  scoutCompetitionOpponent: (
    id: string,
    eventId: string,
  ) => { ok: true } | { ok: false; error: string };
  toggleNpcWatchlist:(npcId:string)=>void;
  careerSystemAction:(command:CareerCommand)=>{ok:true;message:string}|{ok:false;error:string};
  save: GameSave | null;
  clearSave: () => Promise<void>;
  hireCoach: (
    id: string,
    term: CoachTerm,
  ) => { ok: true } | { ok: false; error: string };
  cancelCoach: () => void;
  joinFederation: () => { ok: true } | { ok: false; error: string };
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
  ) => { ok: true; ap: GameSave["player"]["ap"] } | { ok: false; error: string };
  finishMatch: (finish: MatchFinish, db: OpeningDatabase) => MatchRecord | null;
  /** Stores the engine analysis of a match and sets the accuracy of its rated game. */
  attachMatchAnalysis: (
    matchId: string,
    report: MatchAnalysisReport,
    archived?: MatchRecord,
  ) => void;
  checkpointMatch: (pending: PendingMatch | null) => void;
  /** Resume new match checkpoints; settle legacy checkpoints using the original abandonment rule. */
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

/** Longest synchronous stretch of a simulated day before the browser gets a frame (ms). */
let sliceBudgetMs = 8;
/** Tests: 0 yields after every step, Infinity never yields. Results must not depend on it. */
export function setDaySliceBudget(ms: number): void {
  sliceBudgetMs = ms;
}

/**
 * End day as resumable steps. `drainSteps(endDaySteps(get, set, false))` is the original blocking
 * End day. With `sliced`, the season runner resumes it across tasks: the steps are identical, and
 * the only asynchronous continuation (population news after the weekly world sync) is attached
 * after the day is committed, exactly where the blocking version runs it.
 */
function* endDaySteps(
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void,
  sliced: boolean,
): Steps<NightReport | null> {
        if (get().calendarProgress && !calendarOwned) return null;
        const save =
          calendarOwned && calendarDaySave ? calendarDaySave : get().save;
        if (!save) return null;
        if (
          !calendarOwned &&
          (save.pendingMatch || matchRunning(save.career.id) || awaitingArmageddon(save.tournament))
        )
          return null;
        const dayMeasured = beginMeasurement("calendar.day");
        const advanced = endDay(save);
        const next = advanceEsports(
            settleTransfer(expireCompetition(advanced.save)),
            useNpcStore.getState().npcs,
          ),
          report = advanced.report;
        calendarSync = Promise.resolve();
        const announce = (population: { joined: Npc[]; retired: Npc[] }) => {
          if (population.joined.length || population.retired.length)
            get().populationNews(
              save.career.id,
              next.world.date.year,
              population.joined.length,
              population.retired.map((n) => n.name),
            );
        };
        let synced: Promise<{ joined: Npc[]; retired: Npc[] }> | null = null;
        // Apply the new date before selecting circuit entrants, so retiring players cannot compete
        // and this year's cohort is available immediately. Persistence continues asynchronously.
        if (
          report.newWeek &&
          useNpcStore.getState().careerId === save.career.id
        ) {
          synced = useNpcStore
            .getState()
            .syncWorld({
              year: next.world.date.year,
              week: next.world.date.week,
              alternateHistory: next.world.alternateHistory,
            });
          if (sliced) synced.catch(() => undefined);
          else calendarSync = synced.then(announce);
        }
        let localPool: Promise<unknown> | null = null;
        if (next.player.country !== save.player.country) {
          localPool = useNpcStore
            .getState()
            .ensureLocalPool(
              save.career.id,
              next.player.country,
              next.player.city.name,
              next.world.date.year,
            );
          if (sliced) localPool.catch(() => undefined);
          else calendarSync = Promise.all([calendarSync, localPool]);
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
        yield;
        const eventsMeasured = beginMeasurement("calendar.events");
        const calendar =
          useNpcStore.getState().careerId === save.career.id
            ? yield* advanceCalendarTournamentSteps(
                save,
                next,
                useNpcStore.getState().npcs,
              )
            : { save: next, changed: [] };
        eventsMeasured({ npcs: calendar.changed.length });
        if (calendar.changed.length)
          void useNpcStore.getState().updateNpcs(calendar.changed);
        yield;
        const circuitMeasured = report.newWeek
          ? beginMeasurement("calendar.circuit")
          : null;
        const bulletin = report.newWeek
          ? yield* weeklyCircuitSteps(calendar.save, useNpcStore.getState().npcs)
          : { save: calendar.save, changed: [] };
        circuitMeasured?.({ npcs: bulletin.changed.length });
        yield;
        const season = seasonOf(bulletin.save);
        const published =
          season?.status === "paused"
            ? updateSeason(bulletin.save, {
                phase: "choose",
                days: gameDay(bulletin.save) - season.startDay,
              })
            : bulletin.save;
        const settled=settleActivities(published,useNpcStore.getState().npcs);
        set({ save: settled.save });
        if (
          bulletin.changed.length &&
          useNpcStore.getState().careerId === save.career.id
        )
          void useNpcStore.getState().updateNpcs(bulletin.changed);
        if (sliced) {
          // Attached only now, so population news lands after this day's save as before.
          if (synced) calendarSync = synced.then(announce);
          if (localPool) calendarSync = Promise.all([calendarSync, localPool]);
        }
        dayMeasured({ newWeek: report.newWeek, days: 1 });
        return report;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      retireCareer: () => {
        const save = get().save;
        if (!save || get().seasonRunning || get().calendarProgress || matchRunning(save.career.id))
          return { ok: false, error: "Finish the running activity first." };
        const issue = retirementIssue(save);
        if (issue) return { ok: false, error: issue };
        set({ save: { ...save, retirement: {
          ...save.world.date, day: save.world.day, peakElo: save.player.peakRating,
          wins: save.history.tournaments.filter(event => event.rank === 1).length,
          ratedGames: save.player.ratedGames,
        } } });
        return { ok: true };
      },
      readArticle: (id) => {
        const save = get().save;
        if (save && !get().seasonRunning) set({ save: acknowledgeArticle(save, id) });
      },
      save: null,
      seasonRunning: false,
      simulateSeason: async (focus, learningFocus) => {
        const start = get().save,
          world = useNpcStore.getState();
        if (
          !start ||
          get().calendarProgress ||
          get().seasonRunning ||
          start.pendingMatch ||
          start.practice.pendingGame ||
          start.social?.pending ||
          matchRunning(start.career.id)
        )
          return { ok: false, error: "Finish the running activity first." };
        const healthIssue = competitionHealthIssue(start);
        if (healthIssue) return { ok: false, error: healthIssue };
        if (world.status !== "ready" || world.careerId !== start.career.id)
          return {
            ok: false,
            error: "Wait for the NPC world to finish loading.",
          };
        if (highlightsOf(start).unread.length)
          return { ok: false, error: "Read the important career news before resuming." };
        const old = seasonOf(start),
          state =
            old?.status === "paused" && old.year === start.world.date.year
              ? { ...old, notes: [] }
              : newSeason(start, focus, learningFocus);
        state.timing ??= {
          games: 0,
          gameMs: 0,
          searchMs: 0,
          lastGameMs: 0,
          runMs: 0,
        };
        calendarCancelled = false;
        holdSimulation();
        const progress = (save: GameSave) => ({
          days: Math.max(0, gameDay(save) - state.startDay),
          total: state.targetDay - state.startDay,
          target: String(state.year),
        });
        set({
          save: { ...start, seasonSimulation: state },
          seasonRunning: true,
          calendarProgress: progress(start),
        });
        const client = createSeasonGameClient();
        const runStarted = performance.now();
        const pastRunMs = state.timing?.runMs ?? 0;
        let outcome: { ok: true } | { ok: false; error: string } = { ok: true };
        try {
          const db = getBaseOpeningDatabase();
          await runSeason({
            play: async (input) => {
              const finish = await client.play(input);
              const current = get().save;
              if (current?.career.id === start.career.id) {
                const timing = seasonOf(current)?.timing;
                set({
                  save: updateSeason(current, {
                    timing: {
                      games: (timing?.games ?? 0) + 1,
                      gameMs: (timing?.gameMs ?? 0) + finish.recording.wallMs,
                      searchMs:
                        (timing?.searchMs ?? 0) + finish.recording.searchMs,
                      lastGameMs: finish.recording.wallMs,
                      runMs: pastRunMs + performance.now() - runStarted,
                    },
                  }),
                });
              }
              return finish;
            },
            read: () => get().save,
            npcs: () => useNpcStore.getState().npcs,
            cancelled: () =>
              calendarCancelled ||
              useNpcStore.getState().careerId !== start.career.id,
            commit: (save) => {
              if (get().save?.career.id === start.career.id)
                set({ save, calendarProgress: progress(save) });
            },
            finish: (finish) => !!get().finishMatch(finish, db),
            advanceDay: async () => {
              calendarDaySave = null;
              // Same steps as End day, resumed across tasks so the browser can paint between NPC
              // events. The calendar is marked as owned only while a step runs.
              await runStepsSliced(endDaySteps(get, set, true), {
                budgetMs: sliceBudgetMs,
                around: (run) => {
                  calendarOwned = true;
                  try {
                    return run();
                  } finally {
                    calendarOwned = false;
                  }
                },
              });
              await calendarSync;
            },
            yield: () => new Promise<void>((r) => setTimeout(r, 0)),
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Season simulation stopped. Your completed progress is saved.";
          const current = get().save;
          if (current?.career.id === start.career.id)
            set({
              save: updateSeason(current, {
                action: "Simulation paused",
                notes: [message],
              }),
            });
          outcome = { ok: false, error: message };
        } finally {
          client.dispose();
          const current = get().save;
          if (current?.career.id === start.career.id) {
            const s = seasonOf(current);
            if (s?.timing)
              set({
                save: updateSeason(current, {
                  timing: {
                    ...s.timing,
                    runMs: pastRunMs + performance.now() - runStarted,
                  },
                }),
              });
          }
          let saved = false;
          try {
            await releaseSimulation();
            saved = true;
          } catch (error) {
            outcome = {
              ok: false,
              error:
                error instanceof Error
                  ? `${error.message} The previous save is unchanged.`
                  : "Could not save the season. The previous save is unchanged.",
            };
          }
          // Keep the dialog and action guards active until the pause or end-of-season checkpoint is durable.
          set({ seasonRunning: false, calendarProgress: null });
          if (saved) {
            flushTournamentArchive();
            flushMatches();
          }
        }
        return outcome;
      },
      broadcastCheckpoint: (context, state) => {
        const save = get().save;
        if (
          !save ||
          get().calendarProgress ||
          save.pendingMatch ||
          matchRunning(save.career.id)
        )
          return false;
        const next = updateBroadcast(save, context, state);
        if (next === save) return false;
        set({ save: next });
        return true;
      },
      careerAction: (command) => {
        const save = get().save;
        if (
          !save ||
          get().calendarProgress ||
          save.pendingMatch ||
          matchRunning(save.career.id)
        )
          return { ok: false, error: "Finish the running activity first." };
        const result =
          command.type === "focus"
            ? chooseAnnualFocus(save, command.focus)
            : command.type === "sponsor"
              ? signSponsor(save, command.id)
              : command.type === "cancel-sponsor"
                ? { ok: true as const, save: cancelSponsor(save) }
                : command.type === "legacy-role"
                  ? changeLegacyRole(save, command.role)
                  : legacyService(save);
        if (result.ok) {
          set({ save: result.save });
          return { ok: true };
        }
        return result;
      },
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
      simulateUntil: async (eventId) => {
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
        const advanceMeasured = beginMeasurement("calendar.advance");
        const report: CalendarAdvanceReport = {
          days: 0,
          trained: 0,
          sessions: [],
          gains: [],
          stoppedFor: stop.name,
          cancelled: false,
        };
        calendarCancelled = false;
        holdSimulation();
        set({ calendarProgress: { days: 0, total, target: stop.name } });
        try {
          for (let day = 0; day < total; day++) {
            const current = get().save;
            if (calendarCancelled || current?.career.id !== start.career.id) {
              report.cancelled = true;
              break;
            }
            const plan = autoTrainAndRest(current);
            calendarOwned = true;
            calendarDaySave = plan.save;
            try {
              if (!get().endDay()) throw new Error("Could not advance the calendar.");
            } finally {
              calendarOwned = false;
              calendarDaySave = null;
            }
            report.trained += plan.sessions.length;
            for (const session of plan.sessions) {
              const previous = report.sessions.find((item) => item.id === session.sessionId);
              if (previous) previous.count++;
              else report.sessions.push({ id: session.sessionId, name: session.name, count: 1 });
              for (const gain of session.gains) {
                const total = report.gains.find((item) => item.stat === gain.stat);
                if (total) {
                  total.xp += gain.xp;
                  total.levels += gain.levels;
                } else {
                  report.gains.push({ stat: gain.stat, xp: gain.xp, levels: gain.levels });
                }
              }
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
          advanceMeasured({
            days: report.days,
            status: report.cancelled
              ? "cancelled"
              : report.days === total
                ? "ok"
                : "interrupted",
          });
          calendarOwned = false;
          calendarDaySave = null;
          set({ calendarProgress: null });
          try {
            await releaseSimulation();
            flushTournamentArchive();
            flushMatches();
          } catch (error) {
            return {
              ok: false,
              error:
                error instanceof Error
                  ? `${error.message} Completed days stay in memory; the previous save is unchanged.`
                  : "Could not save the calendar. The previous save is unchanged.",
            };
          }
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
      chooseSelectReward: (finalId, choice) => {
        const save = get().save;
        if (!save?.competition) return { ok: false, error: "No pending reward." };
        const next = applySelectReward(save.competition, finalId, choice);
        if (!next) return { ok: false, error: "This reward was already chosen." };
        set({ save: { ...save, competition: next } });
        return { ok: true };
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
        void flushPendingWrites().catch(() => {});
      },

      selectSlot: async (slot) => {
        calendarCancelled = true;
        let persisted: { state?: unknown; version?: number } | null = null;
        try {
          await flushPendingWrites();
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
        await flushPendingWrites();
        const careerId = summarize(
          slot,
          await slotManager.readSlot(slot),
        )?.careerId;
        const wasOpen = slotManager.getActive() === slot;
        const deleting = slotManager.deleteSlot(slot);
        if (wasOpen) set({ save: null });
        await deleting;
        if (careerId) {
          await Promise.all([
            archiveFlushes.get(careerId),
            matchFlushes.get(careerId),
            waitForMatchIndex(careerId),
          ]);
          await useNpcStore.getState().forgetCareer(careerId);
        }
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

      toggleNpcWatchlist: (npcId) => {
        const save=get().save,world=useNpcStore.getState();
        if(!save||world.careerId!==save.career.id||!world.npcs.some(n=>n.id===npcId))return;
        set({save:toggleWatchlist(save,npcId)});
      },
      careerSystemAction: (command) => {
        const save=get().save;if(!save)return {ok:false,error:"No career."};
        if(get().calendarProgress)return {ok:false,error:"Pause calendar simulation first."};
        const result=careerCommand(save,useNpcStore.getState().npcs,command);
        if(!result.ok)return result;
        if(result.changed.length)void useNpcStore.getState().updateNpcs(result.changed);
        set({save:result.save});return {ok:true,message:result.message};
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
      endDay: () => drainSteps(endDaySteps(get, set, false)),

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
        // Use the same overnight recovery as Rest day, including any active jet lag.
        // Read AP from the settled save because calendar processing can apply its daily cap.
        let current = save;
        for (let i = 0; i < 64 && gameDay(current) < target; i++) {
          const previousDay = gameDay(current);
          const report = get().endDay();
          const next = get().save;
          if (!report || !next || next.career.id !== save.career.id || gameDay(next) <= previousDay) break;
          current = next;
        }
        if (gameDay(current) !== target)
          return { ok: false, error: "Could not reach the next match day." };
        return { ok: true, ap: current.player.ap };
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
            save.tournament.round !== finish.setup.tournament.round ||
            awaitingArmageddon(save.tournament) !== Boolean(finish.setup.tournament.armageddon))
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
        set({ save: nextSave });
        return applied.record;
      },

      attachMatchAnalysis: (matchId, report, archived) => {
        const { save } = get();
        if (save)
          set({ save: attachMatchAnalysis(save, matchId, report, archived) });
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
        if (!save.pendingMatch.resume) set({ save: recoverPendingMatch(save, db).save });
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
      storage: {
        getItem: async () => {
          if (chooseCareer) return null;
          const raw = await slotManager.storage.getItem();
          return raw ? (JSON.parse(raw) as StorageValue<Pick<GameStore, "save">>) : null;
        },
        setItem: async (_name, value: StorageValue<Pick<GameStore, "save">>) => {
          // Journaled during a simulation; otherwise coalesced with the NPC writes of the same
          // action and serialized once (see simulationJournal.queueSave).
          const slot = slotManager.getActive();
          if (slot === null || !value.state.save) return;
          return queueSave(slot, {
            state: value.state,
            version: value.version ?? 0,
          });
        },
        removeItem: () => slotManager.storage.removeItem(),
      },
      partialize: ({ save }) => {
        const world = useNpcStore.getState();
        return {
          save: save && world.status === "ready" && world.careerId === save.career.id
            ? { ...save, npcOrder: world.rosterOrder }
            : save,
        };
      },
      migrate: migrateSave,
      onRehydrateStorage: () => {
        useLoadingStatus.setState({ hydrationError: null });
        return (_state, error) => {
          if (error) useLoadingStatus.setState({
            hydrationError: error instanceof Error ? error.message : "Saved careers could not be read.",
          });
        };
      },
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

// The rated game is a durable retry record. Legacy games remain untouched on load.
function syncNpcPlayerResults(){
 const save=useGameStore.getState().save,world=useNpcStore.getState();
 if(!save||world.careerId!==save.career.id||world.status!=='ready')return;
 const games=save.history.games.filter(g=>g.npcRatingTracked&&g.opponentId);
 if(!games.length)return;
 const byId=new Map(world.npcs.map(n=>[n.id,n])),changed=new Map<string,Npc>();
 for(const game of games){
  const npc=changed.get(game.opponentId!)??byId.get(game.opponentId!);
  if(npc){const next=applyNpcPlayerGame(npc,game,game.day??1,save.player.name);if(next!==npc)changed.set(npc.id,next);}
 }
 if(changed.size)void world.updateNpcs([...changed.values()]);
}
useGameStore.subscribe((state,previous)=>{
 if(state.save?.career.id!==previous.save?.career.id||state.save?.history.games!==previous.save?.history.games)syncNpcPlayerResults();
});

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
    {syncNpcPlayerResults();syncFinishedNpcEvents();}
});

// A single flush per career. Outbox records remain in the save if storage fails.
const archiveFlushes = new Map<string, Promise<void>>();
const archiveAttempts = new Map<string, number>();
function flushTournamentArchive(backfill: ArchivedEvent[] = []) {
  if (simulationActive()) return;
  const save = useGameStore.getState().save;
  if (
    !save ||
    (!save.tournamentArchivePending?.length && !backfill.length) ||
    typeof indexedDB === "undefined" ||
    archiveFlushes.has(save.career.id)
  )
    return;
  const careerId = save.career.id,
    pending = save.tournamentArchivePending ?? [];
  const write = Promise.resolve()
    .then(async () => {
      // Zustand queues the save after notifying subscribers. Persist the outbox before archiving.
      await flushPendingWrites();
      await writeMissingEventArchive(careerId, backfill);
      await writeEventArchive(careerId, pending);
    })
    .then(() => {
      archiveAttempts.delete(careerId);
      const current = useGameStore.getState().save;
      if (current?.career.id !== careerId || !pending.length) return;
      const written = new Map(pending.map((e) => [e.id, e]));
      useGameStore.setState({
        save: {
          ...current,
          tournamentArchivePending: current.tournamentArchivePending?.filter(
            (e) => written.get(e.id) !== e,
          ),
        },
      });
    })
    .catch(() => {
      const attempt = (archiveAttempts.get(careerId) ?? 0) + 1;
      archiveAttempts.set(careerId, attempt);
    })
    .finally(() => {
      archiveFlushes.delete(careerId);
      const current = useGameStore.getState().save;
      const retry = (archiveAttempts.get(careerId) ?? 0) > 0 && (archiveAttempts.get(careerId) ?? 0) < 3;
      if (
        current?.career.id === careerId &&
        (retry || current.tournamentArchivePending?.some((e) => !pending.includes(e)))
      )
        flushTournamentArchive(retry ? backfill : []);
    });
  archiveFlushes.set(careerId, write);
}
useGameStore.subscribe((state, previous) => {
  if (
    typeof indexedDB !== "undefined" &&
    state.save &&
    state.save.career.id !== previous.save?.career.id
  ) {
    const pendingIds = new Set(state.save.tournamentArchivePending?.map((event) => event.id));
    flushTournamentArchive(retainedArchives(state.save).filter((event) => !pendingIds.has(event.id)));
    return;
  }
  if (
    state.save?.career.id !== previous.save?.career.id ||
    state.save?.tournamentArchivePending !==
      previous.save?.tournamentArchivePending
  )
    flushTournamentArchive();
});

const matchFlushes = new Map<string, Promise<void>>();
const matchAttempts = new Map<string, number>();
function flushMatches() {
  if (simulationActive()) return;
  const save = useGameStore.getState().save;
  if (
    !save ||
    !save.matchArchivePending?.length ||
    typeof indexedDB === "undefined" ||
    matchFlushes.has(save.career.id)
  )
    return;
  const id = save.career.id,
    pending = save.matchArchivePending;
  const write = Promise.resolve()
    .then(async () => {
      await flushPendingWrites();
      await writeMatchArchive(id, pending);
    })
    .then(() => {
      matchAttempts.delete(id);
      const current = useGameStore.getState().save;
      if (current?.career.id !== id) return;
      const written = new Map(pending.map((m) => [m.id, m]));
      useGameStore.setState({
        save: {
          ...current,
          matchArchivePending: current.matchArchivePending?.filter(
            (m) => written.get(m.id) !== m,
          ),
        },
      });
    })
    .catch(() => {
      matchAttempts.set(id, (matchAttempts.get(id) ?? 0) + 1);
    })
    .finally(() => {
      matchFlushes.delete(id);
      const current = useGameStore.getState().save;
      const retry = (matchAttempts.get(id) ?? 0) > 0 && (matchAttempts.get(id) ?? 0) < 3;
      if (
        current?.career.id === id &&
        (retry || current.matchArchivePending?.some((m) => !pending.includes(m)))
      )
        flushMatches();
    });
  matchFlushes.set(id, write);
}
useGameStore.subscribe((state, previous) => {
  if (typeof indexedDB === "undefined" || !state.save) return;
  if (
    state.save.career.id !== previous.save?.career.id &&
    state.save.matches.length
  ) {
    useGameStore.setState({
      save: queueMatchRecords(state.save, state.save.matches),
    });
    return;
  }
  if (state.save.matchArchivePending !== previous.save?.matchArchivePending)
    flushMatches();
});

// Manual play uses the same durable presentations as season simulation.
useGameStore.subscribe((state,previous)=>{
 if(!state.save||!previous.save||state.save===previous.save||state.seasonRunning||state.save.career.id!==previous.save.career.id)return;
 const next=captureHighlights(previous.save,state.save,useNpcStore.getState().npcs);
 if(next!==state.save)useGameStore.setState({save:next});
});

// Coalesced writes wait a few milliseconds; write them before the page is hidden or closed.
if (typeof window !== "undefined") {
  const flushNow = () => void flushPendingWrites().catch(() => {});
  window.addEventListener("pagehide", flushNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });
}
