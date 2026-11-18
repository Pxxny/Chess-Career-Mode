import { DEFAULT_APPEARANCE } from "@/data/appearance";
import { GAME_CONFIG } from "@/data/config";
import {
  acknowledgeArticle,
  captureHighlights,
  highlightsOf,
} from "@/game/career/highlights";
import { coachedGame, news, weeklyCircuit } from "@/game/career/expansion";
import {
  newSeason,
  runSeason,
  seasonOf,
  updateSeason,
  type SeasonPort,
} from "@/game/career/seasonSimulation";
import { playSeasonGame } from "@/game/career/seasonGame";
import type { MatchFinish } from "@/game/match/session";
import { settleActivities } from "@/game/career/activities";
import { createCareerRecord } from "@/game/career/createCareer";
import { gameDay } from "@/game/competition/agenda";
import { expireCompetition } from "@/game/competition/calendar";
import { advanceCalendarTournaments } from "@/game/competition/worldCalendar";
import { createNewSave } from "@/game/createNewSave";
import { applyFinishedMatch } from "@/game/match/aftermath";
import { advanceEsports } from "@/game/esports/core";
import { buildCareerWorld } from "@/game/npc/buildCareerWorld";
import { applyNpcPlayerGame } from "@/game/npc/playerResults";
import { fictionalCountFor } from "@/game/npc/playerDatabase";
import { advancePopulation } from "@/game/npc/population";
import { getRankedNpcs, getWorldRank } from "@/game/npc/rankings";
import { reconcileTournamentHistory } from "@/game/npc/tournamentHistory";
import { applyWorldState, rerankNpcs } from "@/game/npc/worldState";
import { gameFromSans } from "@/game/chess/rules";
import { getBaseOpeningDatabase } from "@/game/openings/database";
import { plannedTrainingDay, settleTransfer } from "@/game/qol/career";
import { endDay } from "@/game/training/engine";
import { indexRowsFromEvent } from "@/game/history/matchLedger";
import { mergeMatches } from "@/store/matchArchive";
import { setSpanSink } from "@/diagnostics/spanSink";
import { clearScheduleCache } from "@/game/world/schedule";
import type { GameSave, Npc } from "@/types";

/**
 * Baseline for the fast-forward and season paths.
 * Counts the IndexedDB transactions those paths issue. Disk latency is not included:
 * there is no browser database here. Serialization time is included, because the live
 * persist path JSON.stringifies the save and IndexedDB structured-clones NPC records
 * before the transaction commits.
 *
 * Fast-forward matches Simulate until tournament with the dialog's default session
 * (tactics-puzzle), including the extra save write for the progress indicator.
 * A season matches Simulate season, including highlight pauses that are dismissed immediately.
 */

export interface WriteTotals {
  /** Zustand persist of the save (`keyval` store). */
  saveTransactions: number;
  saveJsonBytes: number;
  /** `putMany` of changed NPCs (`careerNpcs` store). */
  npcTransactions: number;
  npcRecords: number;
  /** Tournament archive flush (`tournamentArchive` store), one per day-boundary batch. */
  archiveTransactions: number;
  archiveRecords: number;
  /** Result-only NPC boards stored on archived events. No moves, so not replayable. */
  resultOnlyBoards: number;
  /** Reference rows derived from those boards. Two sides per board, not a second copy of the moves. */
  indexRows: number;
}

export interface SystemTiming {
  id: string;
  count: number;
  totalMs: number;
  maxMs: number;
}

export interface ScenarioReport {
  id: "fast-forward-1" | "fast-forward-30" | "season";
  label: string;
  wallMs: number;
  days: number;
  games: number;
  highlightPauses: number;
  writes: WriteTotals;
  systems: SystemTiming[];
  stopped: string | null;
  fingerprint: WorldFingerprint;
  history?: HistoryBench;
  replay?: ReplayAudit;
}

export interface ReplayAudit {
  storedMatches: number;
  replayed: number;
  replayFailures: number;
  ecoMismatches: number;
  withoutMoves: number;
  duplicateIds: number;
  hotList: number;
  archivePending: number;
}

export interface HistoryBench {
  indexRows: number;
  indexBuildMs: number;
  duplicateIds: number;
  replayRows: number;
  resultOnlyRows: number;
  scanNpcMs: number;
  indexNpcMs: number;
  queryH2HMs: number;
  page50Ms: number;
  page100Ms: number;
  sampleNpcGames: number;
  fakeMoves: number;
}

export interface WorldFingerprint {
  playerRating: number;
  playerGames: number;
  tournamentCount: number;
  tournaments: string;
  qualifications: string;
  season: string;
  npcCount: number;
  npcState: string;
}

function fnv(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

/** Result identity for the baseline. Not a save hash: timestamps and progress text stay out. */
export function fingerprintWorld(save: GameSave, npcs: Npc[]): WorldFingerprint {
  const tournaments = save.history.tournaments
    .map((t) => `${t.year}:${t.tournamentId}:${t.rank}:${t.points}:${t.fieldSize}`)
    .join("|");
  const qualifications = (save.competition?.qualifications ?? [])
    .map((q) => `${q.year}:${q.kind}:${q.source}:${q.eventId ?? ""}`)
    .join("|");
  const season = seasonOf(save);
  const npcState = fnv(
    npcs
      .map(
        (n) =>
          `${n.id}:${n.currentElo}:${n.worldRank ?? ""}:${n.careerStatus}:${n.tournamentHistory
            .map(
              (h) =>
                `${h.eventId}:${h.rank}:${h.points}:${h.ratingAfter}:${h.qualificationTarget ?? ""}`,
            )
            .join(",")}`,
      )
      .sort()
      .join("\n"),
  );
  return {
    playerRating: save.player.rating,
    playerGames: save.history.games.length,
    tournamentCount: save.history.tournaments.length,
    tournaments: fnv(tournaments),
    qualifications: fnv(qualifications),
    season: season
      ? `${season.status}:${season.days}:${season.games}:${season.wins}:${season.draws}:${season.losses}:${season.registrations}`
      : "none",
    npcCount: npcs.length,
    npcState,
  };
}

export interface AdvanceProfile {
  generatedAt: string;
  career: {
    id: string;
    country: string;
    city: string;
    startYear: number;
    database: "large";
    npcs: number;
  };
  setup: { worldBuildMs: number; openingsBuildMs: number };
  note: string;
  scenarios: ScenarioReport[];
}

interface Bucket {
  count: number;
  total: number;
  max: number;
}

class Acc {
  private buckets = new Map<string, Bucket>();
  add(id: string, ms: number) {
    const b = this.buckets.get(id) ?? { count: 0, total: 0, max: 0 };
    b.count += 1;
    b.total += ms;
    b.max = Math.max(b.max, ms);
    this.buckets.set(id, b);
  }
  span<T>(id: string, fn: () => T): T {
    const at = performance.now();
    try {
      return fn();
    } finally {
      this.add(id, performance.now() - at);
    }
  }
  async spanAsync<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const at = performance.now();
    try {
      return await fn();
    } finally {
      this.add(id, performance.now() - at);
    }
  }
  systems(): SystemTiming[] {
    return [...this.buckets.entries()]
      .map(([id, b]) => ({
        id,
        count: b.count,
        totalMs: round(b.total),
        maxMs: round(b.max),
      }))
      .sort((a, b) => b.totalMs - a.totalMs);
  }
}

const round = (ms: number) => Math.round(ms * 10) / 10;

const emptyWrites = (): WriteTotals => ({
  saveTransactions: 0,
  saveJsonBytes: 0,
  npcTransactions: 0,
  npcRecords: 0,
  archiveTransactions: 0,
  archiveRecords: 0,
  resultOnlyBoards: 0,
  indexRows: 0,
});

interface World {
  save: GameSave;
  npcs: Npc[];
  acc: Acc;
  writes: WriteTotals;
  /** Mirrors simulationJournal: intermediate sets are not serialized. */
  holding: boolean;
  deferredNpcs: Map<string, Npc>;
  historyBench?: HistoryBench;
}

function persistSave(world: World, save: GameSave): GameSave {
  world.save = save;
  if (world.holding) return save;
  const at = performance.now();
  const json = JSON.stringify({
    state: { save },
    version: GAME_CONFIG.saveVersion,
  });
  world.acc.add("save.persist", performance.now() - at);
  world.writes.saveTransactions += 1;
  world.writes.saveJsonBytes += json.length;
  return save;
}

function persistNpcs(world: World, dirty: Npc[]) {
  if (!dirty.length) return;
  if (world.holding) {
    for (const npc of dirty) world.deferredNpcs.set(npc.id, npc);
    return;
  }
  const at = performance.now();
  structuredClone(dirty);
  world.acc.add("npc.persist", performance.now() - at);
  world.writes.npcTransactions += 1;
  world.writes.npcRecords += dirty.length;
}

/** Same shape as `npcStore.updateNpcs`: rerank, then one transaction for the records that changed. */
function updateNpcs(world: World, changed: Npc[]) {
  if (!changed.length) return;
  const byId = new Map(changed.map((n) => [n.id, n]));
  const previous = world.npcs;
  const npcs = world.acc.span("npc.rerank", () =>
    rerankNpcs(previous.map((n) => byId.get(n.id) ?? n)),
  );
  const dirty = npcs.filter((n, i) => n !== previous[i]);
  if (!dirty.length) return;
  persistNpcs(world, dirty);
  world.npcs = npcs;
}

function syncPlayerResults(world: World) {
  const games = world.save.history.games.filter(
    (g) => g.npcRatingTracked && g.opponentId,
  );
  if (!games.length) return;
  const at = performance.now();
  const byId = new Map(world.npcs.map((n) => [n.id, n]));
  const changed = new Map<string, Npc>();
  for (const game of games) {
    const npc = changed.get(game.opponentId!) ?? byId.get(game.opponentId!);
    if (!npc) continue;
    const next = applyNpcPlayerGame(
      npc,
      game,
      game.day ?? 1,
      world.save.player.name,
    );
    if (next !== npc) changed.set(npc.id, next);
  }
  world.acc.add("npc.playerResults", performance.now() - at);
  if (changed.size) updateNpcs(world, [...changed.values()]);
}

function populationNews(world: World, joined: number, retired: string[]) {
  let save = world.save;
  const year = save.world.date.year;
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
      retired.slice(0, 8).join(", ") + ". Fictional players retire at age 65.",
    );
  if (save !== world.save) persistSave(world, save);
}

/**
 * One call of `gameStore.endDay`, including the NPC writes it fires before returning.
 * `fastForward` adds the default planned session used by Simulate until tournament.
 */
function stepDay(world: World, mode: "fast-forward" | "season-day") {
  let save = world.save;
  if (mode === "fast-forward")
    save = world.acc.span("training.plan", () =>
      plannedTrainingDay(save, ["tactics-puzzle"]).save,
    );
  const advanced = world.acc.span("training.night", () => endDay(save));
  const expired = world.acc.span("competition.expire", () =>
    expireCompetition(advanced.save),
  );
  const transferred = world.acc.span("qol.transfer", () =>
    settleTransfer(expired),
  );
  let next = world.acc.span("esports.advance", () =>
    advanceEsports(transferred, world.npcs),
  );
  const report = advanced.report;
  let population: { joined: number; retired: string[] } | null = null;
  if (report.newWeek) {
    const previous = world.npcs;
    const clock = {
      year: next.world.date.year,
      week: next.world.date.week,
      alternateHistory: next.world.alternateHistory,
    };
    const expanded = world.acc.span("npc.population", () =>
      advancePopulation(
        previous,
        world.save.career.startYear,
        clock.year,
        fictionalCountFor({ playerDatabase: world.save.career.playerDatabase }),
      ),
    );
    const synced = world.acc.span("npc.sync", () =>
      applyWorldState(expanded, clock),
    );
    const oldById = new Map(previous.map((n) => [n.id, n]));
    const joined = synced.filter((n) => !oldById.has(n.id));
    const retired = synced.filter(
      (n) =>
        n.careerStatus === "retired" &&
        oldById.get(n.id)?.careerStatus !== "retired" &&
        oldById.has(n.id),
    );
    const changed = synced.filter((npc, i) => npc !== previous[i]);
    if (changed.length) {
      persistNpcs(world, changed);
      world.npcs = synced;
    }
    if (joined.length || retired.length)
      population = {
        joined: joined.length,
        retired: retired.map((n) => n.name),
      };
  }
  const completed = world.acc.span("npc.history", () =>
    reconcileTournamentHistory(next, world.npcs),
  );
  if (completed.length) updateNpcs(world, completed);
  const calendar = world.acc.span("calendar.events", () =>
    advanceCalendarTournaments(save, next, world.npcs),
  );
  if (calendar.changed.length) updateNpcs(world, calendar.changed);
  const bulletin = report.newWeek
    ? world.acc.span("calendar.circuit", () =>
        weeklyCircuit(calendar.save, world.npcs),
      )
    : { save: calendar.save, changed: [] as Npc[] };
  if (bulletin.changed.length) updateNpcs(world, bulletin.changed);
  const season = seasonOf(bulletin.save);
  const published =
    season?.status === "paused"
      ? world.acc.span("season.bookkeeping", () =>
          updateSeason(bulletin.save, {
            phase: "choose",
            days: gameDay(bulletin.save) - season.startDay,
          }),
        )
      : bulletin.save;
  const settled = world.acc.span("career.activities", () =>
    settleActivities(published, world.npcs),
  );
  persistSave(world, settled.save);
  if (population)
    populationNews(world, population.joined, population.retired);
  if (mode === "fast-forward") {
    const highlighted = world.acc.span("career.highlights", () =>
      captureHighlights(save, world.save, world.npcs),
    );
    if (highlighted !== world.save) persistSave(world, highlighted);
    // Progress indicator is a separate set(), so persist writes the save again.
    persistSave(world, world.save);
  }
  flushArchives(world);
}

/** Archive flushes start as soon as pending events exist and are not awaited by the day loop. */
function flushArchives(world: World) {
  if (world.holding) return;
  const pending = world.save.tournamentArchivePending;
  if (!pending?.length) return;
  const at = performance.now();
  structuredClone(pending);
  world.acc.add("archive.persist", performance.now() - at);
  world.writes.archiveTransactions += 1;
  world.writes.archiveRecords += pending.length;
  world.writes.resultOnlyBoards += pending.reduce(
    (sum, event) =>
      sum +
      event.pairings.reduce(
        (boards, round) =>
          boards +
          round.filter((p) => p.black !== "bye" && p.result !== null).length,
        0,
      ) +
      (event.teamBoards?.length ?? 0),
    0,
  );
  const indexStarted = performance.now();
  const rows = pending.flatMap((event) =>
    indexRowsFromEvent(world.save.career.id, event),
  );
  const byNpc = new Map<string, typeof rows>();
  let duplicateIds = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const id = `${row.matchId}|${row.npcId}`;
    if (seen.has(id)) duplicateIds++;
    seen.add(id);
    const list = byNpc.get(row.npcId);
    if (list) list.push(row);
    else byNpc.set(row.npcId, [row]);
  }
  let sampleId = "";
  let sampleNpcGames = 0;
  for (const [id, list] of byNpc)
    if (list.length > sampleNpcGames) {
      sampleId = id;
      sampleNpcGames = list.length;
    }
  const scanStarted = performance.now();
  rows.filter((row) => row.npcId === sampleId);
  const scanNpcMs = performance.now() - scanStarted;
  const indexStartedLookup = performance.now();
  const sample = byNpc.get(sampleId) ?? [];
  const indexNpcMs = performance.now() - indexStartedLookup;
  const opponentId = sample[0]?.opponentId;
  const h2hStarted = performance.now();
  sample.filter((row) => row.opponentId === opponentId);
  const queryH2HMs = performance.now() - h2hStarted;
  const page50Started = performance.now();
  sample.slice(0, 50);
  const page50Ms = performance.now() - page50Started;
  const page100Started = performance.now();
  sample.slice(0, 100);
  const page100Ms = performance.now() - page100Started;
  world.historyBench = {
    indexRows: rows.length,
    indexBuildMs: round(performance.now() - indexStarted),
    duplicateIds,
    replayRows: rows.filter((row) => row.replay).length,
    resultOnlyRows: rows.filter((row) => row.kind === "result-only").length,
    scanNpcMs: round(scanNpcMs),
    indexNpcMs: round(indexNpcMs),
    queryH2HMs: round(queryH2HMs),
    page50Ms: round(page50Ms),
    page100Ms: round(page100Ms),
    sampleNpcGames,
    fakeMoves: rows.some(
      (row) =>
        "moves" in row || "uci" in row || "eco" in row || "openingName" in row,
    )
      ? 1
      : 0,
  };
  world.writes.indexRows += rows.length;
  world.acc.add("history.index", world.historyBench.indexBuildMs);
  const save: GameSave = { ...world.save, tournamentArchivePending: [] };
  persistSave(world, save);
}

/** One NPC transaction and one save transaction, matching the live journal flush. */
function commitJournal(world: World) {
  world.holding = false;
  const dirty = [...world.deferredNpcs.values()];
  world.deferredNpcs.clear();
  if (dirty.length) persistNpcs(world, dirty);
  persistSave(world, world.save);
  flushArchives(world);
}
async function fastForward(world: World, days: number) {
  world.holding = true;
  setSpanSink((id, ms) => world.acc.add(id, ms));
  try {
    persistSave(world, world.save);
    for (let day = 0; day < days; day++) {
      stepDay(world, "fast-forward");
      await world.acc.spanAsync(
        "scheduler.yield",
        () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
      );
    }
  } finally {
    setSpanSink(null);
    commitJournal(world);
  }
}

function auditReplays(
  save: GameSave,
  db: ReturnType<typeof getBaseOpeningDatabase>,
): ReplayAudit {
  const matches = mergeMatches(save.matches, save.matchArchivePending ?? []);
  const ids = new Set<string>();
  const audit: ReplayAudit = {
    storedMatches: matches.length,
    replayed: 0,
    replayFailures: 0,
    ecoMismatches: 0,
    withoutMoves: 0,
    duplicateIds: 0,
    hotList: save.matches.length,
    archivePending: save.matchArchivePending?.length ?? 0,
  };
  for (const match of matches) {
    if (ids.has(match.id)) audit.duplicateIds++;
    ids.add(match.id);
    if (!match.moves.length && !(match.recording?.ucis.length ?? 0)) {
      audit.withoutMoves++;
      continue;
    }
    try {
      const game = gameFromSans(match.moves);
      const recorded = match.recording?.ucis ?? [];
      if (recorded.length && game.ucis.join(" ") !== recorded.join(" ")) {
        audit.replayFailures++;
        continue;
      }
      if (game.sans.length !== match.moves.length) {
        audit.replayFailures++;
        continue;
      }
      audit.replayed++;
      const hit = db.classify(match.moves);
      if (
        (hit?.entry.eco ?? null) !== match.openingEco ||
        (hit?.entry.name ?? null) !== match.openingName
      )
        audit.ecoMismatches++;
    } catch {
      audit.replayFailures++;
    }
  }
  return audit;
}

function finishGame(
  world: World,
  finish: MatchFinish,
  db: ReturnType<typeof getBaseOpeningDatabase>,
): boolean {
  const ranked = world.acc.span("season.rank", () => getRankedNpcs(world.npcs));
  const applied = world.acc.span("season.record", () =>
    applyFinishedMatch(world.save, finish, db, {
      before: getWorldRank(world.save.player.rating, ranked),
      after: (rating) => getWorldRank(rating, ranked),
    }),
  );
  if (!applied.record) return false;
  const next =
    finish.moves.length >= 12 || finish.termination === "checkmate"
      ? coachedGame(applied.save)
      : applied.save;
  persistSave(world, next);
  syncPlayerResults(world);
  return true;
}

async function runSeasonScenario(world: World): Promise<{
  pauses: number;
  stopped: string | null;
}> {
  const focus = "balanced" as const;
  const state = newSeason(world.save, focus, []);
  state.timing = {
    games: 0,
    gameMs: 0,
    searchMs: 0,
    lastGameMs: 0,
    runMs: 0,
  };
  world.holding = true;
  persistSave(world, { ...world.save, seasonSimulation: state });
  const db = getBaseOpeningDatabase();
  const runStarted = performance.now();
  let pauses = 0;
  let stopped: string | null = null;
  const port: SeasonPort = {
    read: () => world.save,
    npcs: () => world.npcs,
    cancelled: () => false,
    commit: (save) => {
      persistSave(world, save);
    },
    play: async (input) => {
      const finish = await world.acc.spanAsync("season.game", () =>
        playSeasonGame(input),
      );
      const timing = seasonOf(world.save)?.timing;
      persistSave(
        world,
        updateSeason(world.save, {
          timing: {
            games: (timing?.games ?? 0) + 1,
            gameMs: (timing?.gameMs ?? 0) + finish.recording.wallMs,
            searchMs: (timing?.searchMs ?? 0) + finish.recording.searchMs,
            lastGameMs: finish.recording.wallMs,
            runMs: performance.now() - runStarted,
          },
        }),
      );
      return finish;
    },
    finish: (finish) => finishGame(world, finish, db),
    advanceDay: async () => {
      stepDay(world, "season-day");
    },
    yield: () =>
      world.acc.spanAsync(
        "scheduler.yield",
        () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
      ),
  };
  setSpanSink((id, ms) => world.acc.add(id, ms));
  try {
    for (let guard = 0; guard < 400; guard++) {
      await runSeason(port);
      const unread = highlightsOf(world.save).unread;
      if (!unread.length) break;
      pauses += 1;
      let save = world.save;
      for (const id of unread) save = acknowledgeArticle(save, id);
      persistSave(world, save);
      if (seasonOf(world.save)?.status === "completed") break;
    }
    if (seasonOf(world.save)?.status !== "completed")
      stopped = "Season stopped before the target day.";
  } catch (error) {
    stopped = error instanceof Error ? error.message : "Season failed.";
  } finally {
    setSpanSink(null);
    commitJournal(world);
  }
  return { pauses, stopped };
}

function blankWorld(npcs: Npc[]): World {
  clearScheduleCache();
  const career = createCareerRecord({
    name: "Bench",
    gender: "male",
    countryCode: "TH",
    city: { name: "Bangkok", custom: false },
    archetype: "balanced",
    appearance: DEFAULT_APPEARANCE,
    startYear: 2026,
    alternateHistory: false,
    playerDatabase: "large",
  });
  career.id = "bench-career";
  career.createdAt = 0;
  career.databaseKey = `${GAME_CONFIG.world.seed}:2026:bench-career`;
  return {
    save: createNewSave(
      {
        name: "Bench",
        gender: "male",
        countryCode: "TH",
        city: { name: "Bangkok", custom: false },
        archetype: "balanced",
        appearance: DEFAULT_APPEARANCE,
        startYear: 2026,
        alternateHistory: false,
        playerDatabase: "large",
      },
      career,
    ),
    npcs: structuredClone(npcs),
    acc: new Acc(),
    writes: emptyWrites(),
    holding: false,
    deferredNpcs: new Map(),
  };
}

export async function profileAdvances(
  log: (line: string) => void = () => undefined,
  options: { season?: boolean; monthDays?: number } = {},
): Promise<AdvanceProfile> {
  const career = createCareerRecord({
    name: "Bench",
    gender: "male",
    countryCode: "TH",
    city: { name: "Bangkok", custom: false },
    archetype: "balanced",
    appearance: DEFAULT_APPEARANCE,
    startYear: 2026,
    alternateHistory: false,
    playerDatabase: "large",
  });
  const worldAt = performance.now();
  const npcs = buildCareerWorld({ ...career, playerDatabase: "large" });
  const worldBuildMs = performance.now() - worldAt;
  log(`world ${npcs.length} npcs in ${round(worldBuildMs)} ms`);
  const openAt = performance.now();
  getBaseOpeningDatabase();
  const openingsBuildMs = performance.now() - openAt;
  log(`openings in ${round(openingsBuildMs)} ms`);

  const dayWorld = blankWorld(npcs);
  const dayAt = performance.now();
  await fastForward(dayWorld, 1);
  const dayReport: ScenarioReport = {
    id: "fast-forward-1",
    label: "Fast-forward 1 day",
    wallMs: round(performance.now() - dayAt),
    days: 1,
    games: 0,
    highlightPauses: 0,
    writes: dayWorld.writes,
    systems: dayWorld.acc.systems(),
    stopped: null,
    fingerprint: fingerprintWorld(dayWorld.save, dayWorld.npcs),
    history: dayWorld.historyBench,
  };
  log(`1 day ${dayReport.wallMs} ms, save writes ${dayReport.writes.saveTransactions}`);

  const monthDays = options.monthDays ?? 30;
  const monthWorld = blankWorld(npcs);
  const monthAt = performance.now();
  await fastForward(monthWorld, monthDays);
  const monthReport: ScenarioReport = {
    id: "fast-forward-30",
    label: `Fast-forward ${monthDays} days`,
    wallMs: round(performance.now() - monthAt),
    days: monthDays,
    games: 0,
    highlightPauses: 0,
    writes: monthWorld.writes,
    systems: monthWorld.acc.systems(),
    stopped: null,
    fingerprint: fingerprintWorld(monthWorld.save, monthWorld.npcs),
    history: monthWorld.historyBench,
  };
  log(
    `30 days ${monthReport.wallMs} ms, save writes ${monthReport.writes.saveTransactions}, npc writes ${monthReport.writes.npcTransactions}`,
  );

  const scenarios = [dayReport, monthReport];
  if (options.season !== false) {
    const seasonWorld = blankWorld(npcs);
    const seasonAt = performance.now();
    const seasonRun = await runSeasonScenario(seasonWorld);
    const played = seasonOf(seasonWorld.save);
    const seasonReport: ScenarioReport = {
      id: "season",
      label: "Simulate 1 season",
      wallMs: round(performance.now() - seasonAt),
      days: played?.days ?? 0,
      games: played?.games ?? 0,
      highlightPauses: seasonRun.pauses,
      writes: seasonWorld.writes,
      systems: seasonWorld.acc.systems(),
      stopped: seasonRun.stopped,
      fingerprint: fingerprintWorld(seasonWorld.save, seasonWorld.npcs),
      history: seasonWorld.historyBench,
      replay: auditReplays(seasonWorld.save, getBaseOpeningDatabase()),
    };
    log(
      `season ${seasonReport.wallMs} ms, days ${seasonReport.days}, games ${seasonReport.games}, ${seasonRun.stopped ?? "completed"}`,
    );
    scenarios.push(seasonReport);
  }

  return {
    generatedAt: new Date().toISOString(),
    career: {
      id: "bench-career",
      country: "TH",
      city: "Bangkok",
      startYear: 2026,
      database: "large",
      npcs: npcs.length,
    },
    setup: {
      worldBuildMs: round(worldBuildMs),
      openingsBuildMs: round(openingsBuildMs),
    },
    note: "Fast-forward and season simulation keep one in-memory journal and flush NPCs, then the save, once at the end (and after an error). IndexedDB disk latency is not included. The qualifier cache key includes each history row, not the row count. Schedule cache is cleared before each scenario.",
    scenarios,
  };
}
