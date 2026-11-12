import { Card, CardTitle, ProgressBar } from '@/components/ui';
import type { Rankings } from '@/game/world/standings';
import type { CareerProgress, Player } from '@/types';
import { formatNumber } from '@/utils/format';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

interface Props {
  player: Player;
  rankings: Rankings;
  progress: CareerProgress;
}

const rankText = (r: { rank: number; of: number }): string => `#${formatNumber(r.rank)}`;

export function RatingsSection({ player, rankings, progress }: Props) {
  const stats: Array<[string, string, string?]> = [
    ['Peak Elo', formatNumber(player.peakRating)],
    ['Rated games', formatNumber(player.ratedGames)],
    ['World ranking', rankText(rankings.world), `of ${formatNumber(rankings.world.of)}`],
    ['National ranking', rankText(rankings.national), `of ${formatNumber(rankings.national.of)}`],
    ['City ranking', rankText(rankings.city), `of ${formatNumber(rankings.city.of)}`],
  ];
  return (
    <Card data-tour="ratings" className="mb-4 w-full" aria-labelledby="ratings-title">
      <CardTitle aside={<Link to="/profile?tab=stats" className="flex min-h-11 items-center gap-1 text-xs font-semibold text-gold-300">View stats<ArrowUpRight size={14} aria-hidden /></Link>}>
        <span id="ratings-title">Player ratings</span>
      </CardTitle>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-sm text-ink-muted">Current Elo</span>
        <span className="font-display text-6xl font-bold tracking-tight tabular-nums text-gold-400">{player.rating}</span>
        <span className="rounded-full border border-gold-500/15 bg-gold-500/5 px-3 py-1 text-xs font-semibold text-gold-300">{progress.current.title}</span>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/10 pt-5 sm:grid-cols-3">
        {stats.map(([label, value, hint]) => (
          <div key={label}>
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd className="mt-1 font-display text-xl font-bold tabular-nums text-ink">{value}</dd>
            {hint && <p className="text-xs text-ink-faint">{hint}</p>}
          </div>
        ))}
      </dl>
      <div className="mt-4">
        <ProgressBar value={progress.percent} label="Progress to next career stage" />
        <p className="mt-2 text-sm text-ink-muted">
          {progress.next ? `${progress.next.minRating - player.rating} Elo to ${progress.next.title}` : 'You have reached the top of the career ladder.'}
        </p>
      </div>
    </Card>
  );
}
