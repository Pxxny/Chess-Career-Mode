import { expectedScore } from '@/game/history/elo';
import { createRng, mixSeed } from '@/game/rng';
import type { GameOutcome, Termination } from '@/types';
import type { Opponent } from '@/game/play/opponent';
import type { OpeningDatabase } from './database';
import { chooseOpening, type OpeningContext, type Preferences } from './situations';
import type { OpeningEntry, Side } from './types';

export interface SimulationInput {
  seed: number;
  playerRating: number;
  /** Average of the player's skills, 0 to 100 */
  playerSkill: number;
  color: Side;
  opponent: Opponent;
  critical?: boolean;
}

export interface SimulatedGame {
  outcome: GameOutcome;
  termination: Termination;
  /** The opening moves played (SAN), a line from the database */
  moves: string[];
  entry: OpeningEntry | null;
  /** Situation that chose the opening, null when the player had no preference */
  situation: string | null;
  accuracy: number;
}

/** Share of games drawn at a given rating gap. */
export const drawChance = (gap: number): number => Math.max(0.08, 0.32 - Math.abs(gap) / 2500);

/**
 * Plays out a game without a board: the result comes only from the two ratings, so the opening has no effect.
 * The player's preferred openings decide which line goes into the record, nothing else.
 * Tournament simulation can call this for the player's AI.
 *
 * The outcome and accuracy use their own random streams, seeded from `seed` only. The opening is chosen from
 * a separate stream. Changing the preferences can therefore change the opening but never the result.
 */
export function simulateGame(db: OpeningDatabase, prefs: Preferences, input: SimulationInput): SimulatedGame {
  const resultRng = createRng(mixSeed(input.seed, 0x1e5a));
  const accuracyRng = createRng(mixSeed(input.seed, 0xacc0));
  const openingRng = createRng(mixSeed(input.seed, 0x09e1));

  const gap = input.playerRating - input.opponent.elo;
  const expected = expectedScore(input.playerRating, input.opponent.elo);
  const draw = drawChance(gap);
  const win = Math.min(0.97 - draw, Math.max(0.02, expected - draw / 2));
  const roll = resultRng.next();
  const outcome: GameOutcome = roll < win ? 'win' : roll < win + draw ? 'draw' : 'loss';
  const termination: Termination = outcome === 'draw' ? 'agreement' : resultRng.chance(0.55) ? 'resignation' : 'checkmate';
  const accuracy = Math.round(Math.max(35, Math.min(97, 52 + input.playerSkill * 0.4 + accuracyRng.normal(0, 5))) * 10) / 10;

  // The opponent decides White's first move when the player is Black.
  const whiteLines = input.opponent.lines.white;
  const whiteFirstMove = input.color === 'black' && whiteLines.length ? openingRng.pick(whiteLines)[0] : input.color === 'black' ? openingRng.pick(['e4', 'd4', 'c4', 'Nf3']) : null;
  const context: OpeningContext = { color: input.color, opponent: input.opponent.temperament, critical: input.critical, whiteFirstMove };
  const choice = chooseOpening(db, prefs, context, openingRng);
  let entry: OpeningEntry | null = choice?.entry ?? null;
  if (!entry) {
    // No preference: the player drifts into whatever is popular for this first move.
    const pool = db.entries.filter((e) => e.side === input.color && e.depth >= 4 && e.depth <= 12 && e.popularity >= 3 && (input.color === 'white' || e.firstMove === whiteFirstMove));
    entry = pool.length ? openingRng.pick(pool) : null;
  }
  return { outcome, termination, moves: entry?.moves ?? [], entry, situation: choice?.situation ?? null, accuracy };
}
