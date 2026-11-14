import type { GameOutcome } from "@/types";
import { bounded, normalizePredictionConfig } from "./config";
import type {
  CalibrationCell,
  MatchClassification,
  PredictionActor,
  PredictionConditions,
  PredictionConfig,
  PredictionSnapshot,
  PredictionState,
  Probabilities,
} from "./types";

export const eloExpected = (player: number, opponent: number): number =>
  1 /
  (1 +
    10 **
      ((bounded(opponent, 0, 4000, 1500) - bounded(player, 0, 4000, 1500)) /
        400));
/** A draw is bounded by both players' expected score, so even extreme Elo gaps retain consistent probabilities. */
export function distribution(
  expected: number,
  drawEstimate: number,
  drawScoreShare = 0.85,
): Probabilities {
  const e = bounded(expected, 1e-12, 1 - 1e-12, 0.5);
  const draw = Math.min(
    bounded(drawEstimate, 0, 1, 0),
    2 * Math.min(e, 1 - e) * bounded(drawScoreShare, 0.5, 0.95, 0.85),
  );
  const win = e - draw / 2;
  return { win, draw, loss: 1 - win - draw, expected: e };
}
export function classifyMatch(
  eloGap: number,
  p: Probabilities,
): MatchClassification {
  // Equal-rated opponents remain even despite a small colour/condition advantage.
  if (Math.abs(eloGap) < 25 && Math.abs(p.expected - 0.5) < 0.06)
    return "Even Match";
  const gap = 400 * Math.log10(p.expected / (1 - p.expected));
  const size = Math.round(Math.abs(gap));
  if (size < 25) return "Even Match";
  const strength = size < 50 ? "Narrow" : size < 150 ? "Slight" : size < 200 ? "Solid" : size < 300 ? "" : size < 450 ? "Clear" : size < 650 ? "Heavy" : size < 900 ? "Dominant" : "Overwhelming";
  return `${strength ? `${strength} ` : ""}${gap > 0 ? "Favorite" : "Underdog"}` as MatchClassification;
}
/** Integer basis points via largest remainders: the displayed three values ALWAYS total 100.00%. */
export function displayPercentages(p: Probabilities): [number, number, number] {
  const exact = [p.win, p.draw, p.loss].map((x) => x * 10000);
  const units = exact.map(Math.floor);
  const order = [0, 1, 2].sort(
    (a, b) => exact[b] - units[b] - (exact[a] - units[a]) || a - b,
  );
  const missing = 10000 - units.reduce((a, b) => a + b, 0);
  for (let i = 0; i < missing; i++) units[order[i % 3]]++;
  return units.map((x) => x / 100) as [number, number, number];
}
export const sampleOutcome = (p: Probabilities, roll: number): GameOutcome =>
  roll < p.win ? "win" : roll < p.win + p.draw ? "draw" : "loss";
export const scoreOf = (result: GameOutcome): number =>
  result === "win" ? 1 : result === "draw" ? 0.5 : 0;
export const outcomeOf = (score: number): GameOutcome =>
  score === 1 ? "win" : score === 0.5 ? "draw" : "loss";
export const invertOutcome = (outcome: GameOutcome): GameOutcome =>
  outcome === "win" ? "loss" : outcome === "loss" ? "win" : "draw";
const neutral = (x: number | undefined): number => bounded(x ?? 50, 0, 100, 50);
const aggression = (s: string | undefined, config: PredictionConfig): number =>
  ["attacking", "tactical", "dynamic"].includes(s ?? "")
    ? (config.aggressiveDrawBias ?? -0.045)
    : ["solid", "defensive", "prophylactic"].includes(s ?? "")
      ? (config.solidDrawBias ?? 0.035)
      : 0;
export function baselineDraw(
  a: PredictionActor,
  b: PredictionActor,
  conditions: PredictionConditions,
  c: PredictionConfig,
): number {
  const average = (a.elo + b.elo) / 2;
  const level = bounded(
    c.drawBase + (average - 1800) * c.drawRatingSlope,
    0.08,
    0.6,
  );
  return bounded(
    (level +
      aggression(a.style, c) +
      aggression(b.style, c) +
      bounded(conditions.openingDrawBias ?? 0, -0.06, 0.06)) *
      c.timeDraw[conditions.timeControl] *
      Math.exp(-((Math.abs(a.elo - b.elo) / c.drawGapScale) ** 2)),
    0.001,
    0.8,
  );
}
const safeKey = (s: string): string => encodeURIComponent(s.slice(0, 90));
/** Joint + coarse + marginal cells cover every requested dimension without allocating an unbounded Cartesian table. */
export function calibrationKeys(
  a: PredictionActor,
  b: PredictionActor,
  x: PredictionConditions,
): string[] {
  const gap = Math.abs(a.elo - b.elo),
    average = (a.elo + b.elo) / 2;
  const dimensions = [
    `gap:${gap < 50 ? 0 : gap < 100 ? 1 : gap < 200 ? 2 : gap < 400 ? 3 : 4}`,
    `rating:${average < 1200 ? 0 : average < 1800 ? 1 : average < 2200 ? 2 : average < 2500 ? 3 : 4}`,
    `time:${x.timeControl}`,
    `color:${x.color}`,
    `opening:${safeKey(x.opening)}`,
    `archetype:${safeKey([a.archetype ?? a.style ?? "unknown", b.archetype ?? b.style ?? "unknown"].sort().join("/"))}`,
    `event:${safeKey(x.tournamentType)}`,
  ];
  return [
    `joint|${dimensions.join("|")}`,
    `coarse|${dimensions.slice(0, 3).join("|")}`,
    ...dimensions,
  ];
}
function historicalDraw(
  base: number,
  keys: string[],
  state: PredictionState | undefined,
  c: PredictionConfig,
): { draw: number; games: number; played: number; exact: number } {
  const coarse = state?.cells[keys[1]],
    exact = state?.cells[keys[0]];
  const eligible = keys
    .map((k) => state?.cells[k])
    .filter(
      (cell): cell is CalibrationCell => !!cell && cell.games >= c.historyMin,
    );
  if (!coarse || coarse.games < c.historyMin || !eligible.length)
    return {
      draw: base,
      games: coarse?.games ?? 0,
      played: coarse?.played ?? 0,
      exact: exact?.games ?? 0,
    };
  // Weighted average of residuals, NOT a sum of overlapping sample counts/effects. Each prior is the forecast draw BEFORE observing that result.
  let weight = 0,
    residual = 0;
  eligible.forEach((cell, i) => {
    const w = Math.min(cell.games, 500) * (i === 0 && exact === cell ? 2 : 1);
    residual +=
      (w * (cell.draws - cell.priorDraw)) / (cell.games + c.historyPrior);
    weight += w;
  });
  return {
    draw: bounded(
      base + (c.historyWeight * residual) / weight,
      base * 0.45,
      Math.min(0.8, base + 0.2),
    ),
    games: coarse?.games ?? 0,
    played: coarse?.played ?? 0,
    exact: exact?.games ?? 0,
  };
}
function skillStrength(a: PredictionActor, x: PredictionConditions): number {
  const fast = x.timeControl === "bullet" || x.timeControl === "blitz";
  const weights = {
    tactics: fast ? 2 : 1,
    calculation: fast ? 1 : 2,
    opening: 1,
    positional: fast ? 1 : 2,
    endgame: 1,
    visualization: 1,
    timeManagement: fast ? 3 : 1,
    concentration: 1,
    mental: 1,
    preparation: 1,
  };
  // Skills already reflected in Elo are centred around the actor's own rating, avoiding double-counting chess strength.
  const reference = bounded((a.elo - 500) / 25, 5, 95);
  let sum = 0,
    total = 0;
  for (const key of Object.keys(weights) as (keyof typeof weights)[]) {
    if (a.skills?.[key] === undefined) continue;
    sum += (neutral(a.skills[key]) - reference) * weights[key];
    total += weights[key];
  }
  return total ? bounded(sum / total, -30, 30) : 0;
}
function sanitizeActor(actor: PredictionActor): PredictionActor {
  const result = { ...actor, elo: bounded(actor.elo, 0, 4000, 1500) };
  if (actor.openings)
    result.openings = {
      white: [...actor.openings.white],
      black: [...actor.openings.black],
    };
  if (actor.skills)
    result.skills = Object.fromEntries(
      Object.entries(actor.skills)
        .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
        .map(([k, v]) => [k, bounded(v!, 0, 100)]),
    );
  return result;
}
export interface PredictInput {
  id: string;
  stamp?: PredictionSnapshot["stamp"];
  player: PredictionActor;
  opponent: PredictionActor;
  conditions: PredictionConditions;
  state?: PredictionState;
  config?: Partial<PredictionConfig>;
  /** Ratings-only simulations retain their original opening-independent contract. */
  ratingsOnly?: boolean;
}
export function predictMatch(input: PredictInput): PredictionSnapshot {
  const player = sanitizeActor(input.player),
    opponent = sanitizeActor(input.opponent);
  const config = normalizePredictionConfig(input.config ?? input.state?.config);
  const conditions = {
    ...input.conditions,
    importance: bounded(input.conditions.importance, 0, 1),
    pressure: bounded(input.conditions.pressure, 0, 1),
  };
  const eloDifference = player.elo - opponent.elo;
  const baseDraw = baselineDraw(player, opponent, conditions, config);
  const history = historicalDraw(
    baseDraw,
    calibrationKeys(player, opponent, conditions),
    input.state,
    config,
  );
  const baseline = distribution(
    eloExpected(player.elo, opponent.elo),
    baseDraw,
    config.drawScoreShare,
  );
  const factors = input.ratingsOnly
    ? []
    : [
        {
          name: "Colour",
          elo:
            conditions.color === "unknown"
              ? 0
              : config.whiteElo[conditions.timeControl] *
                (conditions.color === "white" ? 1 : -1),
        },
        {
          name: "Skills for time control",
          elo:
            config.skillElo *
            (skillStrength(player, conditions) -
              skillStrength(opponent, conditions)),
        },
        {
          name: "Current form",
          elo: config.formElo * (neutral(player.form) - neutral(opponent.form)),
        },
        {
          name: "Morale",
          elo:
            config.moraleElo *
            (neutral(player.morale) - neutral(opponent.morale)),
        },
        {
          name: "Fatigue",
          elo:
            config.fatigueElo *
            (bounded(opponent.fatigue ?? 0, 0, 100) -
              bounded(player.fatigue ?? 0, 0, 100)),
        },
        {
          name: "Paid preparation quality",
          elo:
            config.preparationElo *
            (bounded(player.preparation ?? 0, 0, 100) -
              bounded(opponent.preparation ?? 0, 0, 100)),
        },
        {
          name: "Opening familiarity",
          elo:
            config.familiarityElo *
            (neutral(player.openingFamiliarity) -
              neutral(opponent.openingFamiliarity)),
        },
        {
          name: "Peak rating recovery",
          elo:
            config.peakElo *
            (bounded((player.peakElo ?? player.elo) - player.elo, 0, 200) -
              bounded(
                (opponent.peakElo ?? opponent.elo) - opponent.elo,
                0,
                200,
              )),
        },
        {
          name: "Tournament pressure",
          elo:
            config.pressureElo *
            conditions.pressure *
            conditions.importance *
            (neutral(player.skills?.mental) - neutral(opponent.skills?.mental)),
        },
        {
          name: "Head-to-head residual",
          elo: conditions.headToHead
            ? config.headToHeadElo *
              bounded(
                (conditions.headToHead.score - conditions.headToHead.expected) /
                  (conditions.headToHead.games + 20),
                -1,
                1,
                0,
              )
            : 0,
        },
      ];
  const modifierElo = bounded(
    factors.reduce((s, f) => s + f.elo, 0),
    -config.maxAdjustment,
    config.maxAdjustment,
  );
  const adjusted = distribution(
    1 / (1 + 10 ** (-(eloDifference + modifierElo) / 400)),
    history.draw,
    config.drawScoreShare,
  );
  const games = history.games,
    played = history.played;
  const confidence =
    played >= 400 &&
    history.exact >= 80 &&
    player.data === "career" &&
    opponent.data === "career"
      ? "High"
      : games >= 80
        ? "Moderate"
        : "Low";
  return freezeSnapshot({
    id: input.id,
    version: 1,
    stamp: input.stamp ? { ...input.stamp } : { year: 0, week: 0, day: 0 },
    player,
    opponent,
    conditions: {
      ...conditions,
      ...(conditions.headToHead
        ? { headToHead: { ...conditions.headToHead } }
        : {}),
    },
    baseline,
    adjusted,
    eloDifference,
    modifierElo,
    factors,
    classification: classifyMatch(eloDifference, adjusted),
    confidence,
    support: {
      games,
      played,
      simulated: games - played,
      exact: history.exact,
      total: input.state?.learned ?? 0,
    },
    config,
  });
}

/** Detached snapshots are immutable in memory as well as after JSON persistence. */
function freezeSnapshot<T extends object>(value: T): T {
  for (const child of Object.values(value))
    if (child && typeof child === "object" && !Object.isFrozen(child))
      freezeSnapshot(child);
  return Object.freeze(value);
}
