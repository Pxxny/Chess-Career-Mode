import type { Rng } from '@/game/rng';
import type { SearchLine } from './types';

/** Stockfish's UCI_Elo accepts 1320 to 3190. Below that the engine is weakened further by picking weaker candidate moves. */
export const SF_MIN_ELO = 1320;
export const SF_MAX_ELO = 3190;
export const MIN_ENGINE_ELO = 500;
export const MAX_ENGINE_ELO = 3200;

export interface Strength {
  /** The strength that was asked for */
  elo: number;
  full: boolean;
  /** Passed to Stockfish as UCI_Elo. Undefined = full strength. */
  limitElo?: number;
  movetime: number;
  multiPv: number;
  /** Centipawns. The chance of a weaker candidate grows with it. 0 = always the best move. */
  temperature: number;
  /** Search depth for the built-in engine */
  builtinDepth: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Settings for an opponent of a given strength. The Elo is approximate: Stockfish's UCI_Elo is calibrated
 * against engine rating lists, not FIDE ratings, and the weakest levels use a move-picking temperature.
 */
export function strengthFor(elo: number, options: { full?: boolean; thinkMs?: number } = {}): Strength {
  const rounded = Math.round(clamp(elo, MIN_ENGINE_ELO, MAX_ENGINE_ELO));
  const builtinDepth = rounded < 900 ? 1 : rounded < 1300 ? 2 : rounded < 1900 ? 3 : 4;
  if (options.full) {
    return { elo: rounded, full: true, movetime: options.thinkMs ?? 1100, multiPv: 1, temperature: 0, builtinDepth: 4 };
  }
  const base = options.thinkMs ?? clamp(150 + (rounded - SF_MIN_ELO) * 0.35, 150, 900);
  if (rounded >= SF_MIN_ELO) {
    return { elo: rounded, full: false, limitElo: Math.min(rounded, SF_MAX_ELO), movetime: Math.round(base), multiPv: rounded < 1700 ? 3 : 1, temperature: rounded < 1700 ? 25 : 0, builtinDepth };
  }
  const weak = (SF_MIN_ELO - rounded) / (SF_MIN_ELO - MIN_ENGINE_ELO);
  return { elo: rounded, full: false, limitElo: SF_MIN_ELO, movetime: Math.round(Math.min(base, 250)), multiPv: 5, temperature: Math.round(60 + weak * 640), builtinDepth };
}

/** Score of a line as a single number for comparing candidates. Mates dominate. */
export function lineScore(line: SearchLine): number {
  if (line.mate !== null) return line.mate > 0 ? 10000 - line.mate : -10000 - line.mate;
  return line.cp ?? 0;
}

/**
 * Picks a move from the candidates. With temperature 0 it is the best line; otherwise weaker moves become
 * more likely the higher the temperature, but a move that loses much more than a minor-piece swing
 * is never chosen by a stronger setting (the loss cap).
 */
export function pickCandidate(lines: SearchLine[], temperature: number, rng: Rng): SearchLine {
  if (lines.length === 1 || temperature <= 0) return lines[0];
  const best = lineScore(lines[0]);
  const cap = Math.max(150, temperature * 3);
  const pool = lines.filter((l) => best - lineScore(l) <= cap);
  return rng.weighted(pool, (l) => Math.exp((lineScore(l) - best) / temperature));
}
