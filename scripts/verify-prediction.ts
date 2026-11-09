import { playSimulatedGame } from "../src/game/match/headless.ts";
import { GAME_CONFIG } from "../src/data/config.ts";
import { compactTournament } from "../src/game/prediction/adapters.ts";
import { tournamentGames } from "../src/game/qol/history.ts";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  predictMatch,
  distribution,
  eloExpected,
  displayPercentages,
  sampleOutcome,
  scoreOf,
  calibrationKeys,
} from "../src/game/prediction/model.ts";
import {
  DEFAULT_PREDICTION_CONFIG,
  normalizePredictionConfig,
} from "../src/game/prediction/config.ts";
import {
  conditionsFor,
  ratingActor,
  careerPrediction,
  npcActor,
  playerActor,
  predictionEnvironment,
  recordTournamentPredictions,
  playerView,
} from "../src/game/prediction/adapters.ts";
import {
  emptyPredictionState,
  observePredictions,
  normalizePredictionState,
  probabilityScores,
  reliabilityError,
  PREDICTION_LIMITS,
  mirrorPrediction,
} from "../src/game/prediction/statistics.ts";
import { createRng } from "../src/game/rng.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { randomAppearance } from "../src/data/appearance.ts";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs.ts";
import { getBaseOpeningDatabase } from "../src/game/openings/database.ts";
import {
  createTournament,
  reportPlayerResult,
  playerOpponentId,
  playerPairing,
} from "../src/game/match/tournament.ts";
import { buildMatchSetup } from "../src/game/match/setup.ts";
import {
  applyFinishedMatch,
  recoverPendingMatch,
} from "../src/game/match/aftermath.ts";
import { getSchedule } from "../src/game/world/schedule.ts";
import { weeklyCircuit } from "../src/game/career/expansion.ts";
import {
  recordPracticeGame,
  recoverInterruptedPracticeGame,
} from "../src/game/play/practice.ts";
import { findTimeControl } from "../src/game/play/timeControls.ts";
import { opponentFromNpc } from "../src/game/play/opponent.ts";
import { upgradeSave } from "../src/game/training/migrate.ts";
import { MatchSession } from "../src/game/match/session.ts";
import type {
  PredictionSnapshot,
  PredictionObservation,
  PredictionState,
  Probabilities,
} from "../src/game/prediction/types.ts";
import type { GameSave } from "../src/types/index.ts";

const started = performance.now();
const close = (a: number, b: number, message = "") =>
  assert(Math.abs(a - b) < 1e-10, `${message}: ${a} != ${b}`);
const make = (
  a: number,
  b: number,
  extra: Partial<Parameters<typeof predictMatch>[0]> = {},
) =>
  predictMatch({
    id: "test",
    player: ratingActor(a, "A"),
    opponent: ratingActor(b, "B"),
    conditions: conditionsFor(),
    ...extra,
  });
function consistent(p: Probabilities) {
  assert(
    [p.win, p.draw, p.loss, p.expected].every(
      (v) => Number.isFinite(v) && v >= 0 && v <= 1,
    ),
  );
  close(p.win + p.draw + p.loss, 1, "Total");
  close(p.win + p.draw / 2, p.expected, "E = W + D/2");
  close(
    displayPercentages(p).reduce((s, n) => s + Math.round(n * 100), 0),
    10000,
    "Displayed basis points",
  );
}
let grid = 0;
for (let a = 0; a <= 4000; a += 50)
  for (let b = 0; b <= 4000; b += 50)
    for (const time of [
      "classical",
      "rapid",
      "blitz",
      "bullet",
      "none",
    ] as const) {
      const p = make(a, b, { conditions: conditionsFor(time) });
      consistent(p.baseline);
      consistent(p.adjusted);
      close(
        p.baseline.expected,
        1 / (1 + 10 ** ((b - a) / 400)),
        "Standard Elo",
      );
      close(p.baseline.expected, p.adjusted.expected, "Neutral calculator");
      assert(p.adjusted.win > 0 && p.adjusted.loss > 0);
      grid++;
    }
for (const expected of [0, 1e-20, 0.00001, 0.02, 0.5, 0.98, 1, NaN, Infinity])
  for (const draw of [-2, 0, 0.2, 1, 1000, NaN])
    consistent(distribution(expected, draw));
for (const a of [-500, NaN, Infinity, 1000000])
  consistent(make(a, 1500).adjusted);
close(eloExpected(1850, 2050), 0.2402530733520421);
assert.equal(make(2000, 2000).classification, "Even Match");
assert.equal(make(1200, 2500).classification, "Heavy Underdog");
assert.equal(make(2500, 1200).classification, "Heavy Favorite");
assert.equal(make(1600, 1800).classification, "Underdog");
assert.equal(make(1600, 1700).classification, "Slight Underdog");
assert.equal(make(1800, 1600).classification, "Favorite");
assert.equal(make(1700, 1600).classification, "Slight Favorite");
assert(make(2700, 2700).adjusted.draw > make(1000, 1000).adjusted.draw);
assert(
  make(2000, 2000, { conditions: conditionsFor("classical") }).adjusted.draw >
    make(2000, 2000, { conditions: conditionsFor("blitz") }).adjusted.draw,
);
const white = make(2000, 2000, {
    conditions: conditionsFor("classical", "white"),
  }),
  black = make(2000, 2000, { conditions: conditionsFor("classical", "black") });
close(white.adjusted.win, black.adjusted.loss);
close(white.adjusted.draw, black.adjusted.draw);
assert.equal(white.classification, "Even Match");
assert(white.adjusted.expected > 0.5);
assert(
  make(2000, 2000, {
    player: { ...ratingActor(2000, "A"), style: "attacking" },
  }).adjusted.draw <
    make(2000, 2000, { player: { ...ratingActor(2000, "A"), style: "solid" } })
      .adjusted.draw,
);
const low = {
  ...ratingActor(1200, "Underdog"),
  data: "career" as const,
  skills: {
    tactics: 100,
    calculation: 100,
    opening: 100,
    positional: 100,
    endgame: 100,
    visualization: 100,
    timeManagement: 100,
    concentration: 100,
    mental: 100,
    preparation: 100,
  },
  form: 100,
  morale: 100,
  fatigue: 0,
  preparation: 100,
  peakElo: 2500,
  openingFamiliarity: 100,
};
const high = {
  ...low,
  elo: 2400,
  name: "Favorite",
  skills: Object.fromEntries(Object.keys(low.skills).map((k) => [k, 0])),
  form: 0,
  morale: 0,
  fatigue: 100,
  preparation: 0,
  openingFamiliarity: 0,
};
const extreme = make(1200, 2400, {
  player: low,
  opponent: high,
  conditions: {
    ...conditionsFor("classical", "white"),
    importance: 1,
    pressure: 1,
  },
});
assert(extreme.modifierElo <= 100 && extreme.adjusted.expected < 0.01);
assert(
  make(1800, 1800, { player: { ...ratingActor(1800, "A"), fatigue: 90 } })
    .adjusted.expected < 0.5,
);
assert(
  make(1800, 1800, { player: { ...ratingActor(1800, "A"), preparation: 100 } })
    .adjusted.expected > 0.5,
);
const originalActor = { ...low, skills: { ...low.skills } };
const detached = make(1200, 2400, { player: originalActor });
originalActor.skills.tactics = 0;
assert.equal(detached.player.skills?.tactics, 100);
assert(
  Object.isFrozen(detached) &&
    Object.isFrozen(detached.player.skills) &&
    Object.isFrozen(detached.adjusted),
);
assert.throws(() => {
  detached.adjusted.win = 0;
});
const cleanConfig = normalizePredictionConfig({
  maxAdjustment: Infinity,
  historyPrior: -1,
  drawBase: NaN,
  upsetGap: 0,
});
assert.equal(cleanConfig.maxAdjustment, 100);
assert.equal(cleanConfig.historyPrior, 80);
assert.equal(cleanConfig.drawBase, 0.29);
assert.equal(cleanConfig.upsetGap, 150);
console.log(
  `PASS mathematical invariants: ${grid} matchups, five controls, 0–4000 Elo, invalid/boundary inputs, exact rounded totals, colour symmetry, bounded context, immutable snapshots`,
);

const rng = createRng(772255),
  monteCarlo: { gap: number; win: number; draw: number; expected: number }[] =
    [];
for (const gap of [0, 200, 400, 800]) {
  const p = make(1800, 1800 + gap),
    n = 100000,
    counts = { win: 0, draw: 0, loss: 0 };
  for (let i = 0; i < n; i++) counts[sampleOutcome(p.adjusted, rng.next())]++;
  for (const o of ["win", "draw", "loss"] as const)
    assert(
      Math.abs(counts[o] / n - p.adjusted[o]) <
        6 * Math.sqrt((p.adjusted[o] * (1 - p.adjusted[o])) / n) + 1 / n,
      `${gap}: sampled ${o} disagrees with recorded probability`,
    );
  assert(
    Math.abs((counts.win + counts.draw / 2) / n - p.adjusted.expected) < 0.006,
  );
  if (gap >= 400)
    assert(counts.win > 0 && counts.win / n < 0.08, "Rare but possible upsets");
  monteCarlo.push({
    gap,
    win: counts.win / n,
    draw: counts.draw / n,
    expected: p.adjusted.expected,
  });
}
console.log(
  `PASS 400,000 seeded NPC results follow W/D/L without forced wins: ${JSON.stringify(monteCarlo)}`,
);

let state = emptyPredictionState();
const prior = make(1800, 1800, { state });
for (let i = 0; i < 1000; i++) {
  const prediction = make(1800, 1800, { state, id: `learning-${i}` });
  const result = i % 4 < 2 ? "draw" : i % 4 === 2 ? "win" : "loss";
  state = observePredictions(state, [
    { prediction, result, scope: "npc", source: "abstract", eligible: true },
  ]);
}
const posterior = make(1800, 1800, { state });
assert(
  posterior.adjusted.draw > prior.adjusted.draw &&
    posterior.adjusted.draw < 0.5,
);
assert(
  Math.abs(posterior.adjusted.draw - 0.5) < Math.abs(prior.adjusted.draw - 0.5),
);
assert.equal(posterior.support.games, 1000);
assert.equal(posterior.support.simulated, 1000);
assert.equal(posterior.confidence, "Moderate");
const averageScore = (p: Probabilities) =>
  ["win", "draw", "draw", "loss"].reduce(
    (t, o) => {
      const s = probabilityScores(p, o as "win");
      return {
        brier: t.brier + s.brier / 4,
        logLoss: t.logLoss + s.logLoss / 4,
      };
    },
    { brier: 0, logLoss: 0 },
  );
assert(
  averageScore(posterior.adjusted).brier < averageScore(prior.adjusted).brier,
);
assert(
  averageScore(posterior.adjusted).logLoss <
    averageScore(prior.adjusted).logLoss,
);
const sparse = observePredictions(emptyPredictionState(), [
  {
    prediction: prior,
    result: "draw",
    scope: "npc",
    source: "abstract",
    eligible: true,
  },
]);
close(make(1800, 1800, { state: sparse }).adjusted.draw, prior.adjusted.draw);
const unchanged = observePredictions(sparse, [
  {
    prediction: prior,
    result: "loss",
    scope: "npc",
    source: "abstract",
    eligible: true,
  },
]);
assert.equal(unchanged, sparse);
assert.equal(unchanged.metrics.npc.adjusted.games, 1);
const excluded = observePredictions(emptyPredictionState(), [
  {
    prediction: prior,
    result: "loss",
    scope: "career",
    source: "played",
    eligible: false,
  },
]);
assert.equal(excluded.learned, 0);
assert.equal(excluded.metrics.career.adjusted.games, 1);
const metrics = probabilityScores(
  { win: 0.4, draw: 0.2, loss: 0.4, expected: 0.5 },
  "draw",
);
close(metrics.brier, 0.96);
close(metrics.logLoss, -Math.log(0.2));
assert(Number.isFinite(reliabilityError(state.metrics.npc.adjusted)));
const initialMetrics = JSON.stringify(state.metrics);
const reloaded = normalizePredictionState(JSON.parse(JSON.stringify(state)));
assert.equal(JSON.stringify(reloaded.metrics), initialMetrics);
assert.deepEqual(
  make(1800, 1800, { state }).adjusted,
  make(1800, 1800, { state: reloaded }).adjusted,
);
const cells = calibrationKeys(prior.player, prior.opponent, prior.conditions);
for (const dimension of [
  "gap:",
  "rating:",
  "time:",
  "color:",
  "opening:",
  "archetype:",
  "event:",
])
  assert(cells.some((k) => k.startsWith(dimension)));
console.log(
  `PASS calibration: sparse prior, shrinkage, unique sample counts, seven grouping dimensions, held-out Brier/log-loss improvement (${JSON.stringify({ prior: averageScore(prior.adjusted), posterior: averageScore(posterior.adjusted) })}), no result leakage, reload and duplicate protection`,
);

const rare = make(1300, 2000, { id: "career-upset" });
const mild = make(1700, 2000, { id: "career-gap" });
const records = observePredictions(emptyPredictionState(), [
  {
    prediction: rare,
    result: "win",
    scope: "career",
    source: "played",
    eligible: true,
  },
  {
    prediction: mild,
    result: "win",
    scope: "career",
    source: "played",
    eligible: true,
  },
  {
    prediction: rare,
    result: "win",
    scope: "career",
    source: "played",
    eligible: true,
  },
]);
assert.equal(records.upsets.biggestCareer?.gap, 700);
assert.equal(records.upsets.unexpectedCareer?.id, rare.id);
assert.equal(records.upsets.records.length, 2);
const npcWin = make(2200, 1500, {
  id: "npc-beats-career-player",
  opponent: { ...ratingActor(1500, "NPC underdog"), data: "npc-estimate" },
});
const npcRecord = observePredictions(emptyPredictionState(), [
  {
    prediction: npcWin,
    result: "loss",
    scope: "career",
    source: "played",
    eligible: true,
  },
]);
assert.equal(npcRecord.upsets.biggestNpc?.gap, 700);
consistent(mirrorPrediction(rare).adjusted);
close(mirrorPrediction(rare).adjusted.expected, 1 - rare.adjusted.expected);

const options = {
  name: "Prediction QA",
  gender: "male" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: randomAppearance(),
  startYear: 2026,
  alternateHistory: false,
};
const base = createNewSave(options, {
  ...createCareerRecord(options),
  id: "prediction-qa",
});
const npcs = buildWorldNpcs(2026),
  db = getBaseOpeningDatabase(),
  npc = npcs.find((n) => n.careerStatus === "active")!;
const setup = buildMatchSetup({
  save: base,
  npc,
  playerColor: "black",
  timeControl: findTimeControl("5+3"),
  rated: true,
  tournament: null,
  seed: 1231,
  db,
  mode: "play",
  speed: "max",
});
assert(setup.prediction);
assert.equal(setup.prediction.conditions.tournamentType, "rated");
assert.equal(setup.prediction.player.elo, base.player.rating);
assert.equal(setup.prediction.opponent.data, "npc-estimate");
assert.equal(setup.prediction.conditions.color, "black");
const original = JSON.stringify(setup.prediction);
const applied = applyFinishedMatch(
  base,
  {
    setup,
    result: "black",
    termination: "checkmate",
    moves: ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"],
    ucis: [],
    controlLog: [],
    playerMoved: true,
  },
  db,
);
assert.equal(applied.save.prediction?.metrics.career.adjusted.games, 1);
const repeated = applyFinishedMatch(
  applied.save,
  {
    setup,
    result: "black",
    termination: "checkmate",
    moves: [],
    ucis: [],
    controlLog: [],
    playerMoved: true,
  },
  db,
);
assert.equal(repeated.save.prediction?.metrics.career.adjusted.games, 1);
assert.equal(repeated.save.player.rating, applied.save.player.rating);
assert.equal(
  JSON.stringify(applied.record.setup.prediction),
  original,
  "Finishing must not recompute the original forecast",
);
assert.notEqual(applied.save.player.rating, base.player.rating);
const pending = {
  ...base,
  pendingMatch: { setup, ucis: ["e2e4", "e7e5"], playerMoved: true },
};
const recovered = recoverPendingMatch(pending, db);
assert(recovered.record);
assert.equal(recovered.save.pendingMatch, null);
assert.equal(recovered.save.prediction?.metrics.career.adjusted.games, 1);
assert.equal(recovered.save.prediction?.learned, 0);
assert.equal(recoverPendingMatch(recovered.save, db).record, null);
assert.equal(
  recoverPendingMatch(recovered.save, db).save.prediction?.metrics.career
    .adjusted.games,
  1,
);
const played = recordPracticeGame(
  base,
  {
    prediction: setup.prediction,
    mode: "blitz",
    opponent: opponentFromNpc(npc),
    color: "black",
    outcome: "draw",
    termination: "agreement",
    timeControl: findTimeControl("5+3"),
    startFen: null,
    moves: [],
    objective: null,
    situation: null,
    rated: true,
  },
  db,
);
assert.equal(played.save.prediction?.metrics.practice.adjusted.games, 1);
assert.equal(played.save.prediction?.metrics.career.adjusted.games, 0);
assert.equal(played.game.prediction?.id, setup.prediction.id);
const practicePending = {
  ...base,
  practice: {
    ...base.practice,
    pendingGame: {
      prediction: setup.prediction,
      mode: "blitz" as const,
      opponent: opponentFromNpc(npc),
      color: "black" as const,
      outcome: "loss" as const,
      termination: "resignation" as const,
      timeControl: findTimeControl("5+3"),
      startFen: null,
      moves: ["e4", "e5"],
      objective: null,
      situation: null,
      rated: true,
    },
  },
};
const recoveredPractice = recoverInterruptedPracticeGame(practicePending, db);
assert.equal(recoveredPractice.prediction?.metrics.practice.adjusted.games, 1);
assert.equal(recoveredPractice.prediction?.learned, 0);
assert.equal(
  recoverInterruptedPracticeGame(recoveredPractice, db).prediction?.metrics
    .practice.adjusted.games,
  1,
);
const initialSetup = buildMatchSetup({
  save: base,
  npc,
  playerColor: "white",
  timeControl: findTimeControl("none"),
  rated: false,
  tournament: null,
  seed: 3211,
  db,
  mode: "play",
  speed: "max",
});
let firstCheckpoint: import("../src/types/index.ts").PendingMatch | null = null;
const session = new MatchSession({
  setup: initialSetup,
  engine: {
    search: async () => {
      throw new Error("must not be called before first human move");
    },
  },
  db,
  autoAnalyze: false,
  liveEval: false,
  onCheckpoint: (p) => {
    firstCheckpoint = p;
  },
});
session.start();
assert(firstCheckpoint);
assert.equal(
  (firstCheckpoint as import("../src/types/index.ts").PendingMatch).ucis.length,
  0,
);
assert.deepEqual(
  (firstCheckpoint as import("../src/types/index.ts").PendingMatch).setup
    .prediction,
  initialSetup.prediction,
);
session.dispose();
const blitzSave: GameSave = {
  ...base,
  player: { ...base.player, peakRating: 2900 },
  practice: { ...played.save.practice, blitzRating: 1400, blitzPeak: 1550 },
};
const blitzForecast = careerPrediction(blitzSave, opponentFromNpc(npc), {
  id: "blitz-pool",
  color: "white",
  timeControl: "blitz",
  tournamentType: "practice-blitz",
  playerElo: blitzSave.practice.blitzRating,
});
assert.equal(blitzForecast.player.elo, 1400);
assert.equal(blitzForecast.player.peakElo, 1550);
assert.equal(blitzForecast.conditions.headToHead?.games, 1);
const old = { ...base, prediction: undefined, version: 12 };
assert.equal(upgradeSave(old).prediction?.metrics.career.adjusted.games, 0);
assert.equal(upgradeSave(old).version, GAME_CONFIG.saveVersion);
const weekly = weeklyCircuit(base, npcs);
const circuitBoards =
  weekly.changed.reduce(
    (sum, n) => sum + (n.tournamentHistory.at(-1)?.games ?? 0),
    0,
  ) / 2;
assert(circuitBoards > 0);
assert.equal(weekly.save.prediction?.metrics.npc.adjusted.games, circuitBoards);
assert.equal(
  weeklyCircuit(weekly.save, npcs).save.prediction?.metrics.npc.adjusted.games,
  circuitBoards,
);
console.log(
  "PASS career/practice persistence: frozen opponent ratings, scopes, post-result rating changes, abandoned recovery once, legacy migration without invented forecasts, actual weekly NPC circuit",
);

const event = getSchedule(base.world.date, base.player.rating, {
  city: "Bangkok",
  countryCode: "TH",
  demonym: "Thai",
  continent: "Asia",
}).find((e) => (e.details?.format ?? "swiss") === "swiss")!;
let t = createTournament({
  event: { ...event, fieldSize: 16 },
  player: {
    name: base.player.name,
    rating: base.player.rating,
    country: "TH",
    title: "none",
  },
  npcs,
  seed: 543,
  playerActor: playerActor(base),
  predictionEnvironment: predictionEnvironment(base),
});
let save: GameSave = { ...base, tournament: t };
assert(
  t.pairings[0]
    .filter((p) => p.black !== "bye")
    .every((p) => p.prediction && p.result === null),
);
const roundFirst = JSON.stringify(t.pairings[0].map((p) => p.prediction));
let npcGames = 0;
while (t.status === "playing") {
  const before = t.round;
  npcGames += t.pairings[before - 1].filter(
    (p) => p.black !== "bye" && p.white !== "player" && p.black !== "player",
  ).length;
  t = reportPlayerResult(t, "draw", predictionEnvironment(save));
  save = recordTournamentPredictions({ ...save, tournament: t }, t);
  t = save.tournament!;
  assert.equal(save.prediction?.metrics.npc.adjusted.games, npcGames);
  assert.equal(
    recordTournamentPredictions(save, t).prediction,
    save.prediction,
    "Repeated processing must be idempotent",
  );
  assert.equal(
    JSON.stringify(t.pairings[0].map((p) => p.prediction)),
    roundFirst,
  );
  if (t.status === "playing")
    assert(
      t.pairings[t.round - 1]
        .filter((p) => p.black !== "bye")
        .every((p) => p.prediction && p.result === null),
    );
}
assert(t.predictionRecordedRounds === t.pairings.length);
const compact = compactTournament(t);
for (let i = 0; i < t.pairings.length; i++)
  for (let j = 0; j < t.pairings[i].length; j++) {
    const before = t.pairings[i][j],
      after = compact.pairings[i][j];
    if (before.prediction)
      assert.deepEqual(
        (after.prediction ?? after.forecast)?.adjusted,
        before.prediction.adjusted,
      );
  }
assert(JSON.stringify(compact).length < JSON.stringify(t).length * 0.65);
const blackNpc = compact.pairings[0].find(
  (p) => p.black !== "bye" && p.black !== "player",
)!;
const blackHistory = tournamentGames(compact, blackNpc.black);
close(
  blackHistory[0].prediction!.adjusted.win,
  (blackNpc.forecast ?? blackNpc.prediction)!.adjusted.loss,
);
const abort = new AbortController();
const cancelled = playSimulatedGame({
  save: base,
  npc,
  color: "white",
  timeControl: findTimeControl("none"),
  seed: 99,
  db,
  engine: {
    search: async () => {
      throw new Error("No move should run after cancellation");
    },
  },
  signal: abort.signal,
});
abort.abort();
assert.equal(await cancelled, null);
console.log(
  `PASS Swiss/tournament integration: ${npcGames} NPC boards use their original forecasts; every future round freezes before results; no repeats/double counting`,
);

const stressStart = performance.now();
const stress: PredictionObservation[] = Array.from(
  { length: 4500 },
  (_, i) => ({
    prediction: make(1800, 1800, {
      id: `stress-${i}`,
      conditions: { ...conditionsFor(), opening: `opening-${i}` },
    }),
    result: i % 3 === 0 ? "draw" : i % 3 === 1 ? "win" : "loss",
    scope: "npc",
    source: "abstract",
    eligible: true,
  }),
);
const bounded = observePredictions(emptyPredictionState(), stress);
assert(Object.keys(bounded.cells).length <= PREDICTION_LIMITS.cells);
assert(bounded.recent.length <= PREDICTION_LIMITS.recentNpc);
assert(bounded.seen.length <= PREDICTION_LIMITS.seen);
assert.equal(bounded.metrics.npc.adjusted.games, 4500);
assert(bounded.cells["coarse|gap:0|rating:2|time:classical"]);
const stressMs = performance.now() - stressStart;
const benchStart = performance.now();
for (let i = 0; i < 10000; i++)
  make(1000 + (i % 2000), 1600 + (i % 1400), { state: bounded });
const benchMs = performance.now() - benchStart;
console.log(
  `PASS bounded history stress: ${Object.keys(bounded.cells).length} cells, ${bounded.recent.length} recent NPC details, ${bounded.seen.length} dedupe IDs; 4,500 records ${stressMs.toFixed(1)} ms; 10,000 forecasts ${benchMs.toFixed(1)} ms (${(benchMs / 10000).toFixed(4)} ms/forecast), retained state ${(JSON.stringify(bounded).length / 1024).toFixed(1)} KiB`,
);
console.log(
  `Match prediction verification passed in ${(performance.now() - started).toFixed(1)} ms.`,
);
