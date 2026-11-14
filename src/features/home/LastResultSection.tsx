import { useNpcStore } from "@/store/npcStore";
import { Card, CardTitle, EmptyState } from '@/components/ui';
import { outcomeLabel, ResultBadge } from '@/components/game/ResultBadge';
import type { GameResult } from '@/types';
import { cn } from '@/utils/cn';

export function LastResultSection({ game }: { game: GameResult | null }) {
  const npc = useNpcStore(s=>game?.opponentId?s.npcs.find(n=>n.id===game.opponentId):undefined);
  const npcPoint = npc?.ratingHistory?.find(p=>p.id===`player:${game?.id}`);
  if (!game) {
    return (
      <Card>
        <CardTitle>Last result</CardTitle>
        <EmptyState title="No rated games yet" description="Your most recent match will appear here after you play." />
      </Card>
    );
  }
  const change = game.ratingAfter - game.ratingBefore;
  const rows: Array<[string, string]> = [
    ['Opponent', game.opponentName],
    ['Opponent Elo', String(game.opponentElo)],
    ...(npcPoint ? [['Opponent Elo after game', `${npcPoint.before} → ${npcPoint.elo} (${npcPoint.elo-npcPoint.before>=0?'+':''}${npcPoint.elo-npcPoint.before})`] as [string,string]] : []),
    ['Date', `Year ${game.year}, week ${game.week}`],
    ['Tournament', game.tournamentName ?? 'Single rated game'],
  ];
  return (
    <Card>
      <CardTitle>Last result</CardTitle>
      <div className="mb-4 flex items-center gap-3">
        <ResultBadge outcome={game.outcome} size="lg" />
        <div>
          <p className="font-display text-xl font-bold text-ink">{outcomeLabel(game.outcome)}</p>
          <p className={cn('text-sm font-semibold tabular-nums', change > 0 ? 'text-emerald-300' : change < 0 ? 'text-red-300' : 'text-ink-muted')}>
            {change > 0 ? '+' : ''}
            {change} Elo ({game.ratingBefore} → {game.ratingAfter})
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd className="font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
