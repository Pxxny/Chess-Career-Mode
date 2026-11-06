import type { GameOutcome } from '@/types';

const SCORE: Record<GameOutcome, number> = { win: 1, draw: 0.5, loss: 0 };

/** FIDE-style development coefficient: new players move faster, elite players slower. */
export function kFactor(ratedGames: number, rating: number): number {
  if (ratedGames < 30) return 40;
  return rating < 2400 ? 20 : 10;
}

export const expectedScore = (rating: number, opponent: number): number => 1 / (1 + 10 ** ((opponent - rating) / 400));

/** Rating points won (positive) or lost (negative) for one game. */
export function ratingChange(rating: number, opponent: number, outcome: GameOutcome, ratedGames: number): number {
  return Math.round(kFactor(ratedGames, rating) * (SCORE[outcome] - expectedScore(rating, opponent)));
}
