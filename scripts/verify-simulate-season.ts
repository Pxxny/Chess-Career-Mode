import assert from "node:assert/strict";
import { randomAppearance } from "../src/data/appearance.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import { buildCareerWorld } from "../src/game/npc/buildCareerWorld.ts";
import {
  newSeason,
  runSeason,
  seasonOf,
  updateSeason,
  chooseSeasonEvent,
  seasonTraining,
  type SeasonPort,
} from "../src/game/career/seasonSimulation.ts";
import { getBaseOpeningDatabase } from "../src/game/openings/database.ts";
import {
  applyFinishedMatch,
  applyNpcResult,
} from "../src/game/match/aftermath.ts";
import { endDay } from "../src/game/training/engine.ts";
import { expireCompetition } from "../src/game/competition/calendar.ts";
import { gameDay } from "../src/game/competition/agenda.ts";
import { registerForEvent } from "../src/game/match/registration.ts";
import { yearReviewOf } from "../src/game/career/yearReview.ts";
import { createBackup, parseBackup } from "../src/store/backup.ts";
import { reconcileTournamentHistory } from "../src/game/npc/tournamentHistory.ts";
import { esportsCommand, advanceEsports } from "../src/game/esports/core.ts";
import { esportsEvents } from "../src/game/esports/catalog.ts";
import type { GameSave, Npc } from "../src/types/index.ts";
const opts = {
  name: "Season QA",
  gender: "undisclosed" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: randomAppearance(),
  startYear: 2026,
  alternateHistory: false,
  playerDatabase: "small" as const,
};
const base = createNewSave(opts, {
    ...createCareerRecord(opts),
    id: "season-qa",
    databaseKey: "season-qa:2026",
  }),
  world = buildCareerWorld(base.career),
  db = getBaseOpeningDatabase();
function harness(original = base, startingNpcs = world) {
  let save: GameSave | null = structuredClone(original),
    npcs = structuredClone(startingNpcs),
    stop = false,
    steps = 0;
  const commit = (value: GameSave) => {
    save = value;
    const changed = reconcileTournamentHistory(value, npcs),
      byId = new Map(changed.map((n) => [n.id, n]));
    npcs = npcs.map((n) => byId.get(n.id) ?? n);
  };
  const port: SeasonPort = {
    read: () => save,
    npcs: () => npcs,
    commit,
    cancelled: () => stop,
    advanceDay: async () => {
      commit(expireCompetition(endDay(save!).save));
    },
    yield: async () => {
      steps++;
    },
    finish: (finish) => {
      const before = save!;
      const result = applyFinishedMatch(before, finish, db);
      if (!result.record) return false;
      const opp =
        finish.setup.playerColor === "white"
          ? finish.setup.black
          : finish.setup.white;
      npcs = npcs.map((n) =>
        n.id === opp.id
          ? applyNpcResult(
              n,
              result.record!.outcome === "win"
                ? "loss"
                : result.record!.outcome === "loss"
                  ? "win"
                  : "draw",
              before.player.rating,
            )
          : n,
      );
      commit(result.save);
      return true;
    },
  };
  return {
    port,
    get save() {
      return save!;
    },
    get npcs() {
      return npcs;
    },
    get steps() {
      return steps;
    },
    cancel: () => {
      stop = true;
    },
    resume: () => {
      stop = false;
    },
    replace: (s: GameSave) => {
      save = s;
    },
  };
}
const seed = { ...base, seasonSimulation: newSeason(base, "competition") };
const event = chooseSeasonEvent(seed, world)!;
assert(event);
assert(
  event.entryFee + (event.details?.travelCost ?? 0) <= base.player.money - 50,
);
assert(!event.details?.showcase);
assert.notEqual(event.details?.format, "team");
const poor = structuredClone(seed);
poor.player.money = 0;
const trained = seasonTraining(poor);
assert(trained.player.money >= 0);
assert(trained.seasonSimulation!.workDays > 0);
assert(trained.player.ap.current >= 0);
assert(trained.training.hoursUsedToday <= 8);
assert.equal(trained.player.ap.max, poor.player.ap.max);
const exhausted = structuredClone(seed);
exhausted.training.fatigue = 100;
exhausted.player.ap.current = 0;
const rested = seasonTraining(exhausted);
assert(rested.training.fatigue <= 100);
assert.equal(
  rested.player.ap.current,
  0,
  "AP is only recovered by advancing a normal day",
);
const h = harness(seed);
await runSeason(h.port);
const result = seasonOf(h.save)!;
assert.equal(result.status, "completed");
assert.equal(gameDay(h.save), 2027 * 364);
assert.equal(result.days, 364);
assert(result.registrations >= 4);
assert(result.tournaments >= 4);
assert(result.games >= 20);
assert(result.sessions > 100);
assert(result.draws > 0);
assert.equal(result.games, result.wins + result.draws + result.losses);
assert.equal(result.games, h.save.player.ratedGames);
assert(h.save.player.money >= 0);
assert(h.save.training.fatigue >= 0 && h.save.training.fatigue <= 100);
assert.equal(h.save.player.ap.current, h.save.player.ap.max);
assert(
  h.save.matches.every(
    (m) =>
      m.setup.simulation === "season" &&
      m.termination === "simulation" &&
      !m.moves.length &&
      m.analysis === null,
  ),
);
assert(h.save.history.games.every((g) => g.analyzed === false));
assert.equal(
  h.save.training.unanalyzedGames,
  base.training.unanalyzedGames,
  "Abstract games never grant analysis credits",
);
assert.equal(
  new Set(h.save.matches.map((m) => m.setup.prediction!.id)).size,
  h.save.matches.length,
);
const review = h.save.yearReview!.reviews.find((r) => r.year === 2026)!;
assert(review);
assert.equal(review.rated.wins, result.wins);
assert.equal(review.tournaments, result.tournaments);
assert.equal(review.sessions, result.sessions);
assert(
  h.npcs.some((n) => n.tournamentHistory.some((r) => r.source === "career")),
);
assert(
  h.npcs.some(
    (n) => n.currentElo !== world.find((o) => o.id === n.id)!.currentElo,
  ),
);
assert(
  h.save
    .prediction!.recent.filter((o) => o.scope === "career")
    .every((o) => o.source === "abstract"),
);
assert.equal(result.endRating, h.save.player.rating);
assert.equal(result.endMoney, h.save.player.money);
const ids = h.save.matches.map((m) => m.id);
await runSeason(h.port);
assert.deepEqual(
  h.save.matches.map((m) => m.id),
  ids,
  "Repeated completion never creates results twice",
);
// Pause during an action boundary; serialise/reload and get exactly the same seeded season.
const paused = harness(seed);
let ticks = 0;
paused.port.yield = async () => {
  if (++ticks > 31 && paused.save.player.ratedGames >= 3) paused.cancel();
};
await runSeason(paused.port);
assert.equal(seasonOf(paused.save)!.status, "paused");
assert(gameDay(paused.save) < 2027 * 364);
const backup = await createBackup(paused.save, paused.npcs);
const parsed = await parseBackup(JSON.stringify(backup));
assert.equal(parsed.payload.save.seasonSimulation!.year, 2026);
const resumed = harness(JSON.parse(JSON.stringify(paused.save)), paused.npcs);
await runSeason(resumed.port);
assert.deepEqual(
  resumed.save.history.games.map((g) => g.outcome),
  h.save.history.games.map((g) => g.outcome),
);
assert.equal(resumed.save.player.rating, h.save.player.rating);
assert.equal(resumed.save.player.money, h.save.player.money);
// Switching careers aborts before another career can receive a write.
const switched = harness(seed);
switched.port.yield = async () =>
  switched.replace({
    ...base,
    career: { ...base.career, id: "different-career" },
  });
await runSeason(switched.port);
assert.equal(switched.save.career.id, "different-career");
assert.equal(switched.save.player.ratedGames, 0);
// Existing bookings are honored and keep their original paid entry and field.
const registration = registerForEvent(base, event, world);
assert(registration.ok);
const withBooking = {
  ...registration.save,
  seasonSimulation: newSeason(registration.save),
};
const booked = harness(withBooking);
await runSeason(booked.port);
assert(
  booked.save.history.tournaments.some((t) => t.tournamentId === event.id),
);
// A partial final week ends at rollover, rather than simulating another complete year.
const late = structuredClone(base);
late.world.date = { year: 2026, week: 52 };
late.world.day = 5;
const tail = harness({ ...late, seasonSimulation: newSeason(late) });
await runSeason(tail.port);
assert.equal(seasonOf(tail.save)!.days, 3);
assert.equal(gameDay(tail.save), 2027 * 364);
console.log(
  "PASS full year: normal training/rest/AP/jobs/budget/eligibility, automatic entries, player/NPC Elo and histories, draws, annual review, abstract results without invented moves/accuracy, existing booking, pause/reload deterministic continuation, checksum backup, cross-career guard, exact rollover and no duplicate results.",
);
console.log(
  JSON.stringify(
    {
      days: result.days,
      games: result.games,
      wins: result.wins,
      draws: result.draws,
      losses: result.losses,
      tournaments: result.tournaments,
      sessions: result.sessions,
      entryCount: result.registrations,
      steps: h.steps,
      ratingBefore: result.startRating,
      ratingAfter: result.endRating,
      moneyAfter: result.endMoney,
    },
    null,
    2,
  ),
);

const esportEvent = esportsEvents(gameDay(base), base.career.id, 60).find(
  (e) =>
    e.tier === "D" && e.cadence === "Qualifier" && e.deadline >= gameDay(base),
)!;
const esportEntry = esportsCommand(base, world, {
  type: "register",
  eventId: esportEvent.id,
});
assert(esportEntry.ok);
const esportRun = harness({
  ...esportEntry.save,
  seasonSimulation: newSeason(esportEntry.save),
});
esportRun.port.advanceDay = async () =>
  esportRun.port.commit(
    advanceEsports(
      expireCompetition(endDay(esportRun.save).save),
      esportRun.npcs,
    ),
  );
esportRun.port.yield = async () => {
  if (
    esportRun.save.esports!.history.some((e) => e.event.id === esportEvent.id)
  )
    esportRun.cancel();
};
await runSeason(esportRun.port);
assert(
  esportRun.save.esports!.history.some(
    (e) => e.event.id === esportEvent.id && !e.withdrawn,
  ),
);
assert(
  esportRun.save.matches.some(
    (m) =>
      m.setup.esports?.eventId === esportEvent.id &&
      m.setup.simulation === "season",
  ),
);
console.log(
  "PASS pre-booked esports qualifier played through normal fixtures and saved results.",
);
