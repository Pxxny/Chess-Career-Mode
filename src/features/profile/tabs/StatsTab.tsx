import { Card, CardTitle, EmptyState } from '@/components/ui';
import { computeStats, type Record3 } from '@/game/history/stats';
import { useSave } from '@/hooks/useGame';

const fmt = (r: Record3): string => (r.games ? `${r.wins}W ${r.draws}D ${r.losses}L` : 'No games');
const pct = (v: number | null): string => (v === null ? '–' : `${v}%`);

export function StatsTab() {
  const { player, history } = useSave();
  const stats = computeStats(history);
  const best = stats.bestPerformance;

  const rows: Array<[string, string]> = [
    ['Total games', String(stats.total.games)],
    ['Wins', String(stats.total.wins)],
    ['Draws', String(stats.total.draws)],
    ['Losses', String(stats.total.losses)],
    ['Win rate', pct(stats.total.winRate)],
    ['Average accuracy', pct(stats.averageAccuracy)],
    ['Highest Elo', String(player.peakRating)],
    ['White record', fmt(stats.white)],
    ['Black record', fmt(stats.black)],
    ['Tournament record', fmt(stats.tournament)],
  ];

  return (
    <>
      <Card className="mb-4">
        <CardTitle>Career statistics</CardTitle>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-navy-700/60 p-3">
              <dt className="text-xs text-ink-muted">{label}</dt>
              <dd className="mt-1 font-display text-lg font-bold tabular-nums text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-faint">Win rate counts a draw as half a point.</p>
      </Card>

      <Card className="mb-4">
        <CardTitle>Best performance</CardTitle>
        {best ? (
          <p className="text-ink">
            {best.outcome === 'win' ? 'Beat' : 'Drew with'} <span className="font-semibold">{best.opponentName}</span> ({best.opponentElo}) in year {best.year}, week {best.week}
            {best.tournamentName ? ` at the ${best.tournamentName}` : ''}.
          </p>
        ) : (
          <EmptyState title="No result yet" description="Your strongest win or draw will be shown here." />
        )}
      </Card>

      <Card>
        <CardTitle>Favorite openings</CardTitle>
        {stats.favoriteOpenings.length === 0 ? (
          <EmptyState title="No openings recorded" description="Openings you play most often will be listed here." />
        ) : (
          <ul className="divide-y divide-white/5">
            {stats.favoriteOpenings.map((o) => (
              <li key={o.name} className="flex items-center justify-between py-2.5">
                <span className="font-semibold text-ink">{o.name}</span>
                <span className="text-sm tabular-nums text-ink-muted">
                  {o.games} {o.games === 1 ? 'game' : 'games'} · {fmt(o)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
