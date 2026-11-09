import type { GameOutcome, GameSave } from "@/types";
import { DEFAULT_PREDICTION_CONFIG, normalizePredictionConfig } from "./config";
import {
  baselineDraw,
  calibrationKeys,
  invertOutcome,
  classifyMatch,
} from "./model";
import type {
  PredictionConfig,
  PredictionObservation,
  PredictionScope,
  PredictionState,
  Probabilities,
  ScoreTotals,
  UpsetRecord,
} from "./types";

export const PREDICTION_LIMITS = {
  cells: 1536,
  recentCareer: 500,
  recentNpc: 200,
  seen: 4096,
  upsets: 100,
} as const;
const outcomes: GameOutcome[] = ["win", "draw", "loss"];
export const emptyScores = (): ScoreTotals => ({
  games: 0,
  brier: 0,
  logLoss: 0,
  correct: 0,
  bins: {
    win: Array.from({ length: 10 }, () => ({
      games: 0,
      probability: 0,
      observed: 0,
    })),
    draw: Array.from({ length: 10 }, () => ({
      games: 0,
      probability: 0,
      observed: 0,
    })),
    loss: Array.from({ length: 10 }, () => ({
      games: 0,
      probability: 0,
      observed: 0,
    })),
  },
});
export const emptyPredictionState = (): PredictionState => ({
  version: 1,
  config: normalizePredictionConfig(),
  cells: {},
  learned: 0,
  metrics: {
    career: { baseline: emptyScores(), adjusted: emptyScores() },
    practice: { baseline: emptyScores(), adjusted: emptyScores() },
    npc: { baseline: emptyScores(), adjusted: emptyScores() },
  },
  recent: [],
  seen: [],
  upsets: {
    records: [],
    biggestCareer: null,
    unexpectedCareer: null,
    biggestNpc: null,
    unexpectedNpc: null,
  },
});
export function predictionOf(save: GameSave): PredictionState {
  return save.prediction ?? emptyPredictionState();
}
/** Only normalise once on save migration, not on the render/search hot paths. Older games are never backfilled. */
export function normalizePredictionState(
  raw?: PredictionState,
): PredictionState {
  if (!raw || raw.version !== 1) return emptyPredictionState();
  const empty = emptyPredictionState();
  const validCells = Object.entries(raw.cells ?? {})
    .filter(
      ([key, c]) =>
        key.length < 900 &&
        c &&
        Number.isFinite(c.games) &&
        c.games >= 0 &&
        Number.isFinite(c.draws) &&
        c.draws >= 0 &&
        c.draws <= c.games &&
        Number.isFinite(c.priorDraw) &&
        c.priorDraw >= 0 &&
        c.priorDraw <= c.games &&
        Number.isFinite(c.played) &&
        c.played >= 0 &&
        c.played <= c.games,
    )
    .slice(0, PREDICTION_LIMITS.cells);
  const metrics = { ...empty.metrics };
  for (const scope of ["career", "practice", "npc"] as PredictionScope[]) {
    for (const kind of ["baseline", "adjusted"] as const) {
      const score = raw.metrics?.[scope]?.[kind];
      if (
        score &&
        ["games", "brier", "logLoss", "correct"].every(
          (k) =>
            Number.isFinite(score[k as "games"]) && score[k as "games"] >= 0,
        ) &&
        outcomes.every(
          (o) =>
            Array.isArray(score.bins?.[o]) &&
            score.bins[o].length === 10 &&
            score.bins[o].every(
              (b) =>
                b &&
                [b.games, b.probability, b.observed].every(
                  (n) => Number.isFinite(n) && n >= 0,
                ),
            ),
        )
      )
        metrics[scope] = { ...metrics[scope], [kind]: score };
    }
  }
  return {
    ...empty,
    ...raw,
    config: normalizePredictionConfig(raw.config),
    cells: Object.fromEntries(validCells),
    learned: Number.isFinite(raw.learned) ? Math.max(0, raw.learned) : 0,
    metrics,
    recent: (Array.isArray(raw.recent) ? raw.recent : [])
      .filter(validObservation)
      .slice(-700),
    seen: (Array.isArray(raw.seen) ? raw.seen : [])
      .filter((id) => typeof id === "string")
      .slice(-PREDICTION_LIMITS.seen),
    upsets: {
      ...empty.upsets,
      ...raw.upsets,
      records: (raw.upsets?.records ?? []).slice(-PREDICTION_LIMITS.upsets),
    },
  };
}
export function probabilityScores(
  p: Probabilities,
  actual: GameOutcome,
): { brier: number; logLoss: number; correct: number } {
  const predicted = outcomes.reduce(
    (best, o) => (p[o] > p[best] ? o : best),
    "win",
  );
  return {
    brier: outcomes.reduce(
      (sum, o) => sum + (p[o] - Number(o === actual)) ** 2,
      0,
    ),
    logLoss: -Math.log(Math.max(1e-15, p[actual])),
    correct: Number(predicted === actual),
  };
}
function addScores(
  t: ScoreTotals,
  p: Probabilities,
  actual: GameOutcome,
): ScoreTotals {
  const scores = probabilityScores(p, actual);
  const bins = { ...t.bins };
  for (const o of outcomes) {
    const i = Math.min(9, Math.floor(p[o] * 10));
    bins[o] = t.bins[o].map((b, k) =>
      k === i
        ? {
            games: b.games + 1,
            probability: b.probability + p[o],
            observed: b.observed + Number(actual === o),
          }
        : b,
    );
  }
  return {
    games: t.games + 1,
    brier: t.brier + scores.brier,
    logLoss: t.logLoss + scores.logLoss,
    correct: t.correct + scores.correct,
    bins,
  };
}
function validProbabilities(p: Probabilities | undefined): p is Probabilities {
  return (
    !!p &&
    [p.win, p.draw, p.loss, p.expected].every(
      (x) => Number.isFinite(x) && x >= 0 && x <= 1,
    ) &&
    Math.abs(p.win + p.draw + p.loss - 1) < 1e-9 &&
    Math.abs(p.win + p.draw / 2 - p.expected) < 1e-9
  );
}
export function validObservation(o: PredictionObservation): boolean {
  const p = o?.prediction;
  return (
    !!p &&
    p.version === 1 &&
    typeof p.id === "string" &&
    p.id.length > 0 &&
    ["career", "practice", "npc"].includes(o.scope) &&
    ["played", "engine-simulated", "abstract"].includes(o.source) &&
    outcomes.includes(o.result) &&
    !!p.player &&
    !!p.opponent &&
    !!p.conditions &&
    !!p.config &&
    validProbabilities(p.baseline) &&
    validProbabilities(p.adjusted)
  );
}
function upsetOf(o: PredictionObservation): UpsetRecord | null {
  const p = o.prediction;
  if (o.result === "draw" || !o.eligible) return null;
  const win = o.result === "win";
  const winner = win ? p.player : p.opponent,
    loser = win ? p.opponent : p.player;
  const gap = loser.elo - winner.elo;
  if (gap < p.config.upsetGap) return null;
  return {
    id: p.id,
    winner: winner.name,
    loser: loser.name,
    winnerElo: winner.elo,
    loserElo: loser.elo,
    gap,
    probability: win ? p.adjusted.win : p.adjusted.loss,
    career: o.scope === "career" && win,
    source: o.source,
    stamp: p.stamp,
    event: p.conditions.tournamentName ?? p.conditions.tournamentType,
  };
}
/** Batched, immutable, prequential scoring. Learns only AFTER every submitted snapshot already exists. */
export function observePredictions(
  state: PredictionState,
  observations: readonly PredictionObservation[],
): PredictionState {
  const seen = new Set(state.seen),
    fresh = observations.filter((o) => {
      if (!validObservation(o) || seen.has(o.prediction.id)) return false;
      seen.add(o.prediction.id);
      return true;
    });
  if (!fresh.length) return state;
  const cells = { ...state.cells },
    metrics = { ...state.metrics },
    upsets = { ...state.upsets, records: [...state.upsets.records] };
  let learned = state.learned,
    cellCount = Object.keys(cells).length;
  for (const o of fresh) {
    const p = o.prediction;
    metrics[o.scope] = {
      baseline: addScores(metrics[o.scope].baseline, p.baseline, o.result),
      adjusted: addScores(metrics[o.scope].adjusted, p.adjusted, o.result),
    };
    if (o.eligible) {
      // Add both colour perspectives with half weight? NO: one canonical observation per game.
      // A second, mirrored colour cell (only) gives Black evidence without doubling game totals or other dimensions.
      learned++;
      const base = baselineDraw(p.player, p.opponent, p.conditions, p.config);
      const keys = calibrationKeys(p.player, p.opponent, p.conditions);
      const color = p.conditions.color;
      if (color !== "unknown")
        keys.push(`color:${color === "white" ? "black" : "white"}`);
      for (const key of keys) {
        const old = cells[key];
        if (
          !old &&
          (cellCount >= PREDICTION_LIMITS.cells ||
            (cellCount >= PREDICTION_LIMITS.cells - 256 &&
              (key.startsWith("joint|") || key.startsWith("opening:"))))
        )
          continue;
        if (!old) cellCount++;
        cells[key] = {
          games: (old?.games ?? 0) + 1,
          draws: (old?.draws ?? 0) + Number(o.result === "draw"),
          priorDraw: (old?.priorDraw ?? 0) + base,
          played: (old?.played ?? 0) + Number(o.source !== "abstract"),
        };
      }
    }
    const upset = upsetOf(o);
    if (upset) {
      upsets.records.push(upset);
      if (upset.career) {
        if (!upsets.biggestCareer || upset.gap > upsets.biggestCareer.gap)
          upsets.biggestCareer = upset;
        if (
          !upsets.unexpectedCareer ||
          upset.probability < upsets.unexpectedCareer.probability
        )
          upsets.unexpectedCareer = upset;
      } else if (
        o.scope === "npc" ||
        (o.scope === "career" &&
          o.result === "loss" &&
          p.opponent.data === "npc-estimate")
      ) {
        if (!upsets.biggestNpc || upset.gap > upsets.biggestNpc.gap)
          upsets.biggestNpc = upset;
        if (
          !upsets.unexpectedNpc ||
          upset.probability < upsets.unexpectedNpc.probability
        )
          upsets.unexpectedNpc = upset;
      }
    }
  }
  const all = [...state.recent, ...fresh];
  const career = all
      .filter((o) => o.scope !== "npc")
      .slice(-PREDICTION_LIMITS.recentCareer),
    npc = all
      .filter((o) => o.scope === "npc")
      .slice(-PREDICTION_LIMITS.recentNpc);
  return {
    ...state,
    cells,
    learned,
    metrics,
    seen: [...seen].slice(-PREDICTION_LIMITS.seen),
    recent: [...career, ...npc],
    upsets: {
      ...upsets,
      records: upsets.records.slice(-PREDICTION_LIMITS.upsets),
    },
  };
}
export function recordPredictions(
  save: GameSave,
  observations: readonly PredictionObservation[],
): GameSave {
  const state = predictionOf(save),
    prediction = observePredictions(state, observations);
  return prediction === state ? save : { ...save, prediction };
}
export const configurePredictions = (
  save: GameSave,
  config: Partial<PredictionConfig>,
): GameSave => ({
  ...save,
  prediction: {
    ...predictionOf(save),
    config: normalizePredictionConfig({
      ...predictionOf(save).config,
      ...config,
    }),
  },
});
export function reliabilityError(t: ScoreTotals): number {
  if (!t.games) return 0;
  return (
    outcomes.reduce(
      (s, o) =>
        s +
        t.bins[o].reduce(
          (total, b) =>
            total +
            (b.games ? Math.abs(b.observed - b.probability) / t.games : 0),
          0,
        ),
      0,
    ) / 3
  );
}
export function mirrorPrediction(
  p: PredictionObservation["prediction"],
): PredictionObservation["prediction"] {
  const reverse = (x: Probabilities): Probabilities => ({
    win: x.loss,
    draw: x.draw,
    loss: x.win,
    expected: 1 - x.expected,
  });
  return {
    ...p,
    player: p.opponent,
    opponent: p.player,
    conditions: {
      ...p.conditions,
      color:
        p.conditions.color === "white"
          ? "black"
          : p.conditions.color === "black"
            ? "white"
            : "unknown",
    },
    baseline: reverse(p.baseline),
    adjusted: reverse(p.adjusted),
    eloDifference: -p.eloDifference,
    modifierElo: -p.modifierElo,
    classification: classifyMatch(-p.eloDifference, reverse(p.adjusted)),
    factors: p.factors.map((f) => ({ ...f, elo: -f.elo })),
  };
}
export { DEFAULT_PREDICTION_CONFIG, invertOutcome };
