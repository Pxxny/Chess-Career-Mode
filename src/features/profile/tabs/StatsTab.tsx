import { useState } from "react";
import { OpeningHistoryDialog } from "@/features/qol/HistoryDialogs";
import { Card, CardTitle, EmptyState } from "@/components/ui";
import { computeStats, type Record3 } from "@/game/history/stats";
import { useSave } from "@/hooks/useGame";

const fmt = (r: Record3): string =>
  r.games ? `${r.wins}W ${r.draws}D ${r.losses}L` : "No games";
const pct = (v: number | null): string => (v === null ? "–" : `${v}%`);

export function StatsTab() {
  const { player, history } = useSave();
  const [opening, setOpening] = useState<string | null>(null);
  const stats = computeStats(history);
  const best = stats.bestPerformance;

  const rows: Array<[string, string]> = [
    ["Total games", String(stats.total.games)],
    ["Wins", String(stats.total.wins)],
    ["Draws", String(stats.total.draws)],
    ["Losses", String(stats.total.losses)],
    ["Score rate", pct(stats.total.winRate)],
    ["Average accuracy", pct(stats.averageAccuracy)],
    ["Highest Elo", String(player.peakRating)],
    ["White record", fmt(stats.white)],
    ["Black record", fmt(stats.black)],
    ["Tournament record", fmt(stats.tournament)],
  ];

  return (
    <>
      {opening && (
        <OpeningHistoryDialog name={opening} onClose={() => setOpening(null)} />
      )}
      <Card className="mb-4">
        <CardTitle>Career statistics</CardTitle>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-navy-700/60 p-3">
              <dt className="text-xs text-ink-muted">{label}</dt>
              <dd className="mt-1 font-display text-lg font-bold tabular-nums text-ink">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-faint">
          Score rate counts a draw as half a point.
        </p>
        <p className="mt-2 text-xs text-ink-faint">
          Detailed game history keeps the latest 1,000 rated games. Lifetime
          totals keep counting after that limit.
        </p>
        {player.ratedGames > stats.total.games && (
          <p className="mt-2 text-xs text-ink-faint">
            Older results were already missing when lifetime tracking started.
            Known outcomes cover {stats.total.games} of {player.ratedGames}{" "}
            rated games.
          </p>
        )}
      </Card>

      <Card className="mb-4">
        <CardTitle>Best performance</CardTitle>
        <p className="mb-2 text-xs text-ink-muted">
          Best performance and opening breakdown use retained game history.
        </p>
        {best ? (
          <p className="text-ink">
            {best.outcome === "win" ? "Beat" : "Drew with"}{" "}
            <span className="font-semibold">{best.opponentName}</span> (
            {best.opponentElo}) in year {best.year}, week {best.week}
            {best.tournamentName ? ` at the ${best.tournamentName}` : ""}.
          </p>
        ) : (
          <EmptyState
            title="No result yet"
            description="Your strongest win or draw will be shown here."
          />
        )}
      </Card>

      <Card>
        <CardTitle>Favorite openings</CardTitle>
        {stats.favoriteOpenings.length === 0 ? (
          <EmptyState
            title="No openings recorded"
            description="Openings you play most often will be listed here."
          />
        ) : (
          <ul className="divide-y divide-white/5">
            {stats.favoriteOpenings.map((o) => (
              <li
                key={o.name}
                className="flex items-center justify-between py-2.5"
              >
                <button
                  type="button"
                  onClick={() => setOpening(o.name)}
                  className="min-h-11 text-left font-semibold text-gold-300 underline decoration-gold-500/30 underline-offset-4"
                  aria-label={`View games with ${o.name}`}
                >
                  {o.name}
                </button>
                <span className="text-sm tabular-nums text-ink-muted">
                  {o.games} {o.games === 1 ? "game" : "games"} · {fmt(o)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
