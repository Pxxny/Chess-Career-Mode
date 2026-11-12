import type { CareerHistory, GameStamp } from "@/types/history";

export type EloPeriod = "tournament" | "month" | "year";
export interface EloPoint { key: string; label: string; elo: number; }
const stampOrder = (s: GameStamp) => s.year * 364 + (s.week - 1) * 7 + (s.day ?? 1) - 1;

/** Closing Elo for each recorded period; no synthetic results or empty periods. */
export function buildEloSeries(history: CareerHistory, period: EloPeriod, locale = "en-GB"): EloPoint[] {
  const groups = new Map<string, EloPoint>();
  if (period === "tournament") {
    const games = [...history.games].sort((a, b) => stampOrder(a) - stampOrder(b));
    for (const game of games) {
      if (!game.tournamentId || !Number.isFinite(game.ratingAfter)) continue;
      const key = `${game.year}:${game.tournamentId}`;
      // A tournament's final retained game supplies its closing rating.
      groups.delete(key);
      groups.set(key, { key, label: `${game.tournamentName ?? game.tournamentId} · ${game.year}`, elo: game.ratingAfter });
    }
  } else {
    const points = history.ratingHistory.length
      ? history.ratingHistory
      : history.games.map((g) => ({ year: g.year, week: g.week, day: g.day, elo: g.ratingAfter }));
    for (const point of [...points].sort((a, b) => stampOrder(a) - stampOrder(b))) {
      if (!Number.isFinite(point.elo)) continue;
      const date = new Date(Date.UTC(point.year, 0, 1 + (point.week - 1) * 7 + (point.day ?? 1) - 1));
      const key = period === "year" ? String(point.year) : `${point.year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = period === "year" ? String(point.year) : date.toLocaleDateString(locale, { month: "short", year: "numeric", timeZone: "UTC", calendar: "gregory" });
      groups.set(key, { key, label, elo: point.elo });
    }
  }
  return [...groups.values()];
}
