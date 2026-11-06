import type { CareerHistory, GameOutcome, GameResult } from '@/types';

export interface Record3 {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** 0 to 100, null with no games */
  winRate: number | null;
}

export function recordOf(games: GameResult[]): Record3 {
  const wins = games.filter((g) => g.outcome === 'win').length;
  const draws = games.filter((g) => g.outcome === 'draw').length;
  const losses = games.length - wins - draws;
  return { games: games.length, wins, draws, losses, winRate: games.length ? Math.round(((wins + draws * 0.5) / games.length) * 1000) / 10 : null };
}

export interface OpeningStat extends Record3 {
  name: string;
}

export interface CareerStats {
  total: Record3;
  white: Record3;
  black: Record3;
  tournament: Record3;
  averageAccuracy: number | null;
  /** The game with the highest-rated opponent that was not lost */
  bestPerformance: GameResult | null;
  favoriteOpenings: OpeningStat[];
}

export function computeStats(history: CareerHistory): CareerStats {
  const games = history.games;
  const accuracy = games.length ? Math.round((games.reduce((s, g) => s + g.accuracy, 0) / games.length) * 10) / 10 : null;
  const best = games
    .filter((g) => g.outcome !== 'loss')
    .sort((a, b) => b.opponentElo + (b.outcome === 'win' ? 50 : 0) - (a.opponentElo + (a.outcome === 'win' ? 50 : 0)))[0] ?? null;

  const byOpening = new Map<string, GameResult[]>();
  for (const g of games) if (g.opening) byOpening.set(g.opening, [...(byOpening.get(g.opening) ?? []), g]);
  const favoriteOpenings = [...byOpening.entries()]
    .map(([name, list]) => ({ name, ...recordOf(list) }))
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))
    .slice(0, 3);

  return {
    total: recordOf(games),
    white: recordOf(games.filter((g) => g.color === 'white')),
    black: recordOf(games.filter((g) => g.color === 'black')),
    tournament: recordOf(games.filter((g) => g.tournamentId !== null)),
    averageAccuracy: accuracy,
    bestPerformance: best,
    favoriteOpenings,
  };
}

/** Games are stored in the order they were played, so the newest are at the end. Returns newest first. */
export const recentGames = (history: CareerHistory, count: number): GameResult[] => [...history.games].reverse().slice(0, count);

export const lastGame = (history: CareerHistory): GameResult | null => recentGames(history, 1)[0] ?? null;

export const OUTCOME_LETTER: Record<GameOutcome, 'W' | 'D' | 'L'> = { win: 'W', draw: 'D', loss: 'L' };

export interface Rival {
  key: string;
  name: string;
  elo: number;
  record: Record3;
}

/** Opponents met at least `minGames` times, most-played first. */
export function findRivals(history: CareerHistory, minGames = 2, limit = 5): Rival[] {
  const groups = new Map<string, GameResult[]>();
  for (const g of history.games) {
    const key = g.opponentId ?? `name:${g.opponentName}`;
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length >= minGames)
    .map(([key, list]) => ({ key, name: list[0].opponentName, elo: list[list.length - 1].opponentElo, record: recordOf(list) }))
    .sort((a, b) => b.record.games - a.record.games || b.elo - a.elo)
    .slice(0, limit);
}
