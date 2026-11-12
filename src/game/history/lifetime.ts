import type { CareerHistory, GameResult } from "@/types";
export interface OutcomeTotals {
  games: number;
  wins: number;
  draws: number;
  losses: number;
}
export interface LifetimeTotals {
  total: OutcomeTotals;
  white: OutcomeTotals;
  black: OutcomeTotals;
  tournament: OutcomeTotals;
  accuracySum: number;
  analysedGames: number;
}
const empty = (): OutcomeTotals => ({ games: 0, wins: 0, draws: 0, losses: 0 });
export function addLifetimeGame(
  totals: LifetimeTotals,
  game: GameResult,
): LifetimeTotals {
  const next = structuredClone(totals);
  for (const row of [
    next.total,
    next[game.color],
    ...(game.tournamentId ? [next.tournament] : []),
  ]) {
    row.games++;
    row[
      game.outcome === "win"
        ? "wins"
        : game.outcome === "draw"
          ? "draws"
          : "losses"
    ]++;
  }
  if (game.analyzed !== false) {
    next.analysedGames++;
    next.accuracySum += game.accuracy;
  }
  return next;
}
/** Older saves seed only results still present; discarded outcomes cannot be reconstructed. */
export function lifetimeOf(history: CareerHistory): LifetimeTotals {
  return (
    history.lifetime ??
    history.games.reduce(addLifetimeGame, {
      total: empty(),
      white: empty(),
      black: empty(),
      tournament: empty(),
      accuracySum: 0,
      analysedGames: 0,
    })
  );
}
