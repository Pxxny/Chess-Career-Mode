import { registrationIssue } from "../src/game/competition/eligibility.ts";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { randomAppearance } from "../src/data/appearance.ts";
import { GAME_CONFIG } from "../src/data/config.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs.ts";
import {
  localCompetitors,
  mergeNpcAdditions,
} from "../src/game/npc/localPool.ts";
import { getSchedule } from "../src/game/world/schedule.ts";
import { pickEventField } from "../src/game/match/tournament.ts";
import {
  registerForEvent,
  cancelRegistration,
} from "../src/game/match/registration.ts";
import { createRng } from "../src/game/rng.ts";
import {
  CAREER_JOBS,
  workJob,
  requestTransfer,
  settleTransfer,
  qolOf,
  plannedTrainingDay,
  careerDay,
  calendarLabel,
  transferIssue,
} from "../src/game/qol/career.ts";
import { endDay } from "../src/game/training/engine.ts";
import { diverseOpeningChoices } from "../src/game/qol/openingChoices.ts";
import { getBaseOpeningDatabase } from "../src/game/openings/database.ts";
import { FIDE_RECORDS } from "../src/game/qol/schedule.ts";
import { tournamentGames, openingGames } from "../src/game/qol/history.ts";
import { upgradeSave } from "../src/game/training/migrate.ts";
import type {
  GameSave,
  ActiveTournament,
  MatchRecord,
} from "../src/types/index.ts";
const timings: Record<string, number> = {};
let at = performance.now();
const opts = {
  name: "QoL Test",
  gender: "undisclosed" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: randomAppearance(),
  startYear: 2026,
  alternateHistory: false,
};
const base = createNewSave(opts, createCareerRecord(opts));
const global = buildWorldNpcs(2026),
  locals = localCompetitors("TH", "Bangkok", 2026),
  npcs = [...global, ...locals];
timings.buildWorld = performance.now() - at;
assert.equal(global.filter((n) => n.kind === "fictional").length, 4000);
assert.equal(locals.length, 80);
assert(locals.every((n) => n.nationality === "TH"));
assert(new Set(locals.map((n) => n.city)).size > 10);
assert.deepEqual(localCompetitors("TH", "Bangkok", 2026), locals);
assert.equal(new Set(npcs.map((n) => n.id)).size, npcs.length);
const original = {
  ...global[100],
  name: "Preserve existing identity",
  currentElo: 1731,
};
const merged = mergeNpcAdditions([original], npcs);
assert.equal(
  merged.npcs.find((n) => n.id === original.id),
  original,
);
assert.equal(mergeNpcAdditions(merged.npcs, npcs).added.length, 0);
const region = {
  city: "Bangkok",
  countryCode: "TH",
  demonym: "Thai",
  continent: "Asia",
};
at = performance.now();
const events = getSchedule(base.world.date, region, base.career.id, 52);
timings.calendar = performance.now() - at;
assert(events.length >= 120);
assert(events.filter((e) => e.details?.country === "TH").length >= 25);
assert(events.filter((e) => e.details?.country !== "TH").length >= 35);
assert.equal(new Set(events.map((e) => e.id)).size, events.length);
assert.equal(FIDE_RECORDS.events.length, 60);
assert.equal(new Set(FIDE_RECORDS.events.map((r) => r.country)).size, 11);
assert(
  FIDE_RECORDS.events.every(
    (r) =>
      r.source ===
      `https://ratings.fide.com/tournament_information.phtml?event=${r.id}`,
  ),
);
const home = events.find((e) => e.id.startsWith("qol-circuit-home"))!;
const away = events.find(
  (e) =>
    e.id.startsWith("qol-circuit-away") &&
    e.weeksUntilDeadline >= 0 &&
    registrationIssue(base, e, npcs) === null,
)!;
assert.equal(home.details?.travelCost, 0);
assert((away.details?.travelCost ?? 0) > 0);
const field = pickEventField(
  npcs,
  1400,
  { ...home, fieldSize: 64 },
  createRng(4),
);
assert.equal(field.length, 63);
assert(field.filter((n) => n.nationality === "TH").length >= 41);
assert(new Set(field.map((n) => n.city)).size > 10);
const national = events.find((e) => e.id === "career-national-2026")!;
assert(
  pickEventField(npcs, 1800, national, createRng(1)).every(
    (n) => n.nationality === "TH",
  ),
);
const paid = registerForEvent(base, away, npcs);
assert(paid.ok);
assert.equal(
  paid.save.player.money,
  base.player.money - away.entryFee - (away.details?.travelCost ?? 0),
);
assert.equal(
  cancelRegistration(paid.save, away.id).player.money,
  base.player.money,
);
assert(
  !registerForEvent(
    base,
    { ...away, details: { ...away.details!, travelCost: -1 } },
    npcs,
  ).ok,
);
console.log(
  `PASS world/calendar: ${npcs.length} NPCs, 80 home competitors, ${events.length} events, 60 FIDE references / 11 countries, local quotas, travel/refunds`,
);

let save = {
  ...base,
  player: { ...base.player, rating: 2000, reputation: 10 },
};
const job = workJob(save, "club-assistant");
assert(job.ok);
assert.equal(job.save.player.money, save.player.money + 30);
assert.equal(job.save.training.hoursUsedToday, 2);
assert.equal(job.save.player.ap.current, 9);
assert(!workJob(job.save, "club-assistant").ok);
const second = workJob(job.save, "chess-writer");
assert(second.ok);
assert(!workJob(second.save, "private-lesson").ok);
assert.equal(second.save.history.ledger.length, 2);
assert(workJob(endDay(second.save).save, "club-assistant").ok);
assert(
  !workJob(
    { ...save, player: { ...save.player, ap: { current: 0, max: 10 } } },
    "club-assistant",
  ).ok,
);
assert(
  !workJob(
    { ...save, training: { ...save.training, hoursUsedToday: 7 } },
    "club-assistant",
  ).ok,
);
assert(!workJob(base, "private-lesson").ok);
assert(!requestTransfer(base, "VN").ok);
const eligible = {
  ...base,
  player: { ...base.player, rating: 1900, ratedGames: 25, money: 1000 },
};
const application = requestTransfer(eligible, "VN");
assert(application.ok);
assert.equal(application.save.player.money, 750);
assert(!requestTransfer(application.save, "SG").ok);
assert.equal(settleTransfer(application.save), application.save);
let waiting = application.save;
for (let i = 0; i < 30; i++) waiting = endDay(waiting).save;
const reg = {
  eventId: "national-old",
  name: "Old national entry",
  level: "national" as const,
  year: 2026,
  week: 20,
  fieldSize: 16,
  entryFee: 60,
  travelCost: 10,
  details: national.details,
};
waiting = {
  ...waiting,
  registrations: [reg],
  expansion: { ...waiting.expansion!, membershipYear: 2026 },
};
const moved = settleTransfer(waiting);
assert.equal(moved.player.country, "VN");
assert.equal(moved.player.city.name, "Hanoi");
assert.equal(moved.player.money, 820);
assert.equal(moved.registrations.length, 0);
assert.equal(moved.expansion?.membershipYear, null);
assert.equal(moved.career.countryCode, "TH");
assert.equal(qolOf(moved).birthCountry, "TH");
assert.equal(qolOf(moved).moves.length, 1);
assert.equal(settleTransfer(moved), moved);
assert(transferIssue(moved)?.includes("one game year"));
assert.equal(upgradeSave(moved).player.country, "VN");
assert.deepEqual(upgradeSave(base), base);
const training = plannedTrainingDay(base, [
  "tactics-puzzle",
  "tactics-puzzle",
  "calculation-drills",
  "not-real",
]);
assert.equal(training.completed.length, 3);
assert.equal(
  training.completed.filter((n) => !n.endsWith("(automatic)")).length,
  2,
);
assert(training.completed.includes("Power nap (automatic)"));
assert.equal(training.skipped.length, 1);
assert.equal(training.save.training.hoursUsedToday, 5);
assert.equal(training.save.player.ap.current, 7);
assert(training.save.training.xp.tactics! > 0);
assert.deepEqual(plannedTrainingDay(base, []).save, base);
assert(calendarLabel(base).includes("2026"));
console.log(
  "PASS jobs/transfers/training: daily caps, AP/hours/fatigue, once-only ledger and processing fee, eligibility, 30-day delay, refunds, birthplace, cooldown, migration",
);

const db = getBaseOpeningDatabase();
const choices = diverseOpeningChoices(db.entries);
assert.equal(choices.length, db.entries.length);
assert.equal(new Set(choices.slice(0, 40).map((e) => e.family)).size, 40);
assert(new Set(choices.slice(0, 80).map((e) => e.eco[0])).size >= 4);
assert(choices.some((e) => e.eco === "E99"));
const t: ActiveTournament = {
  eventId: "history-one",
  name: "Recorded event",
  level: "local",
  year: 2026,
  week: 2,
  rounds: 3,
  round: 3,
  status: "finished",
  entryFee: 0,
  prizeFund: 0,
  timeControl: home.details!.timeControl,
  seed: 1,
  players: [
    {
      id: "player",
      name: "P",
      elo: 1000,
      title: "none",
      countryCode: "TH",
      isPlayer: true,
      points: 1.5,
      opponents: [],
      colors: [],
    },
    {
      id: "npc1",
      name: "N",
      elo: 1000,
      title: "none",
      countryCode: "TH",
      isPlayer: false,
      points: 1.5,
      opponents: [],
      colors: [],
    },
  ],
  pairings: [
    [{ white: "player", black: "npc1", result: 1 }],
    [{ white: "npc1", black: "player", result: 0.5 }],
    [{ white: "player", black: "npc1", result: 0 }],
  ],
  finalRank: 1,
  prize: 0,
};
assert.deepEqual(
  tournamentGames(t, "player").map((r) => r.outcome),
  ["win", "draw", "loss"],
);
assert.deepEqual(
  tournamentGames(t, "npc1").map((r) => r.outcome),
  ["loss", "draw", "win"],
);
const m = {
  id: "actual",
  gameResultId: "g1",
  setup: {
    tournament: { id: t.eventId, round: 1 },
    white: { isPlayer: true, id: null },
    black: { isPlayer: false, id: "npc1" },
  },
} as MatchRecord;
assert.equal(tournamentGames(t, "npc1", [m])[0].match, m);
const history = {
  ...base,
  history: {
    ...base.history,
    games: [
      { id: "g1", opening: "Sicilian Defense" },
      { id: "g2", opening: "French Defense" },
    ] as GameSave["history"]["games"],
  },
  matches: [m],
};
assert.equal(openingGames(history, "Sicilian Defense").length, 1);
assert.equal(openingGames(history, "Sicilian Defense")[0].match, m);
console.log(
  "PASS history/repertoire: scoped tournament outcomes for both sides, replay linkage, opening filter, all ECO letters and accessible variations",
);

// Real stores with memory I/O; no DOM, no UI shim, and no external engine is needed for calendar actions.
const { createMemorySlotBackend, idbSlotBackend } = await import(
  "../src/store/saveSlots.ts"
);
const { createMemoryNpcBackend, idbNpcBackend, writeNpcDatabase, metaFor } =
  await import("../src/store/npcRepository.ts");
const npcBackend = createMemoryNpcBackend();
Object.assign(idbSlotBackend, createMemorySlotBackend());
Object.assign(idbNpcBackend, npcBackend);
const { useGameStore } = await import("../src/store/gameStore.ts");
const { useNpcStore } = await import("../src/store/npcStore.ts");
await useGameStore.persist.rehydrate();
const legacy = global
  .slice(0, 1282)
  .map((n, i) =>
    i === 0 ? { ...n, name: "Keep evolved NPC", currentElo: 1703 } : n,
  );
await npcBackend.replaceAll(base.career.id, legacy, {
  ...metaFor(base.career),
  fictionalCount: 1200,
});
useNpcStore.setState({ careerId: null, status: "idle" });
await useNpcStore.getState().loadDatabase(base.career);
assert.equal(
  useNpcStore.getState().npcs.find((n) => n.id === legacy[0].id)?.name,
  "Keep evolved NPC",
);
assert.equal(
  useNpcStore.getState().npcs.find((n) => n.id === legacy[0].id)?.currentElo,
  1703,
);
assert(useNpcStore.getState().npcs.length >= 4082);
assert.equal((await npcBackend.getMeta(base.career.id))?.fictionalCount, 4000);
const before = useNpcStore.getState().npcs.length;
await useNpcStore
  .getState()
  .ensureLocalPool(base.career.id, "TH", "Bangkok", 2026);
assert.equal(useNpcStore.getState().npcs.length, before);
useNpcStore.setState({
  npcs: global.slice(0, 50),
  careerId: base.career.id,
  status: "ready",
  syncWorld: async () => ({ joined: [], retired: [] }),
  updateNpcs: async () => {},
});
const futureBase = {
  ...home,
  id: "next-event",
  year: 2026,
  week: 3,
  registrationDeadline: { year: 2026, week: 1 },
  weeksUntilDeadline: 0,
};
const future = Array.from({ length: 100 }, (_, i) => ({
  ...futureBase,
  id: `next-event-${i}`,
})).find((e) => registrationIssue(base, e, npcs) === null)!;
const entry = registerForEvent(base, future, npcs);
assert(entry.ok);
useGameStore.setState({ save: entry.save });
at = performance.now();
const advanced = await useGameStore
  .getState()
  .simulateUntil(future.id, ["tactics-puzzle"]);
timings.advance14Days = performance.now() - at;
assert(advanced.ok);
assert.equal(advanced.report.days, 14);
assert.equal(advanced.report.trained, 14);
assert.equal(useGameStore.getState().save?.world.date.week, 3);
assert.equal(useGameStore.getState().save?.world.day, 1);
assert.equal(useGameStore.getState().save?.player.ap.current, 10);
useGameStore.setState({ save: entry.save });
const run = useGameStore.getState().simulateUntil(future.id, []);
assert(!useGameStore.getState().workCareerJob("club-assistant").ok);
useGameStore.getState().cancelCalendar();
const cancelled = await run;
assert(cancelled.ok && cancelled.report.cancelled);
assert(cancelled.report.days <= 1);
assert.equal(useGameStore.getState().calendarProgress, null);
const nearer = {
  ...entry.save.registrations[0],
  eventId: "earlier",
  week: 2,
  name: "Earlier registered event",
};
useGameStore.setState({
  save: { ...entry.save, registrations: [...entry.save.registrations, nearer] },
});
const earliest = await useGameStore.getState().simulateUntil(future.id, []);
assert(earliest.ok);
assert.equal(earliest.report.days, 7);
assert.equal(useGameStore.getState().save?.world.date.week, 2);
useGameStore.setState({ save: entry.save });
const runA = useGameStore.getState().simulateUntil(future.id, []);
const other = createNewSave(
  { ...opts, name: "Other slot" },
  createCareerRecord(opts),
);
useGameStore.setState({ save: other });
const switched = await runA;
assert(switched.ok && switched.report.cancelled);
assert.equal(useGameStore.getState().save, other);
console.log(
  "PASS store integration: additive NPC upgrade, preserved evolved identities, idempotent local cohort, daily calendar simulation, cancellation, earlier-event stop and cross-career isolation",
);
console.log("Measured on Node/Cloud, not Termux:", JSON.stringify(timings));
console.log("QoL checks passed.");

const camp = plannedTrainingDay(base, ["training-camp"]);
assert.equal(camp.completed.length, 1);
assert.equal(camp.save.training.hoursUsedToday, 8);
assert.equal(camp.save.player.money, base.player.money - 150);
const analysis = plannedTrainingDay(
  { ...base, training: { ...base.training, unanalyzedGames: 1 } },
  ["analyze-game"],
);
assert.equal(analysis.completed.length, 1);
assert.equal(analysis.save.training.unanalyzedGames, 0);
console.log(
  "PASS optional full-day training camps and analysis of a retained game use normal requirements and costs",
);
