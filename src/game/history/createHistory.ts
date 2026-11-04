import type { CareerHistory, GameStamp } from '@/types';

export function createEmptyHistory(): CareerHistory {
  return { games: [], tournaments: [], trophies: [], news: [], training: [], sessions: [], ledger: [], titles: [], ratingHistory: [] };
}

/** Fills any list a save from an older version is missing. */
export function normalizeHistory(value: Partial<CareerHistory> | undefined | null): CareerHistory {
  return { ...createEmptyHistory(), ...(value ?? {}) };
}

/** Whole weeks from `from` to `to` (52-week game years). */
export const weeksBetween = (from: GameStamp, to: GameStamp): number => (to.year - from.year) * 52 + (to.week - from.week);

/** Orders stamps newest first. */
export const newestFirst = (a: GameStamp, b: GameStamp): number => b.year - a.year || b.week - a.week;
export const oldestFirst = (a: GameStamp, b: GameStamp): number => a.year - b.year || a.week - b.week;

export function formatStamp(stamp: GameStamp): string {
  return `Year ${stamp.year}, week ${stamp.week}`;
}
