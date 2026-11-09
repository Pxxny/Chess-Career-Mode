import type { PredictionConfig, PredictionTime } from "./types";

export const DEFAULT_PREDICTION_CONFIG: PredictionConfig = {
  drawBase: 0.29,
  drawRatingSlope: 0.00017,
  drawGapScale: 650,
  drawScoreShare: 0.85,
  aggressiveDrawBias: -0.045,
  solidDrawBias: 0.035,
  timeDraw: { none: 0.9, bullet: 0.43, blitz: 0.62, rapid: 0.8, classical: 1 },
  whiteElo: { none: 0, bullet: 12, blitz: 20, rapid: 25, classical: 30 },
  skillElo: 0.55,
  formElo: 0.35,
  moraleElo: 0.25,
  fatigueElo: 0.6,
  preparationElo: 0.2,
  peakElo: 0.04,
  pressureElo: 0.18,
  familiarityElo: 0.12,
  headToHeadElo: 18,
  maxAdjustment: 100,
  historyPrior: 160,
  historyMin: 20,
  historyWeight: 0.65,
  upsetGap: 200,
};
const limits: Record<
  Exclude<keyof PredictionConfig, "timeDraw" | "whiteElo">,
  [number, number]
> = {
  drawBase: [0.05, 0.6],
  drawRatingSlope: [0, 0.0003],
  drawGapScale: [200, 1200],
  drawScoreShare: [0.5, 0.95],
  aggressiveDrawBias: [-0.08, 0],
  solidDrawBias: [0, 0.08],
  skillElo: [0, 0.7],
  formElo: [0, 0.5],
  moraleElo: [0, 0.4],
  fatigueElo: [0, 0.8],
  preparationElo: [0, 0.3],
  peakElo: [0, 0.06],
  pressureElo: [0, 0.3],
  familiarityElo: [0, 0.2],
  headToHeadElo: [0, 25],
  maxAdjustment: [0, 120],
  historyPrior: [80, 1000],
  historyMin: [10, 100],
  historyWeight: [0, 0.8],
  upsetGap: [150, 600],
};
export const bounded = (
  x: number,
  lo: number,
  hi: number,
  fallback = lo,
): number => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fallback);
/** Runtime validation also covers imported save data; NaN and missing fields never enter probability arithmetic. */
export function normalizePredictionConfig(
  raw?: Partial<PredictionConfig>,
): PredictionConfig {
  const c = {
    ...DEFAULT_PREDICTION_CONFIG,
    timeDraw: { ...DEFAULT_PREDICTION_CONFIG.timeDraw },
    whiteElo: { ...DEFAULT_PREDICTION_CONFIG.whiteElo },
  };
  for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
    const [lo, hi] = limits[key];
    c[key] = bounded(raw?.[key] ?? c[key], lo, hi, c[key]);
  }
  for (const time of Object.keys(c.timeDraw) as PredictionTime[]) {
    c.timeDraw[time] = bounded(
      raw?.timeDraw?.[time] ?? c.timeDraw[time],
      0.2,
      1.3,
      c.timeDraw[time],
    );
    c.whiteElo[time] = bounded(
      raw?.whiteElo?.[time] ?? c.whiteElo[time],
      0,
      40,
      c.whiteElo[time],
    );
  }
  return c;
}
