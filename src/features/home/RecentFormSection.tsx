import { Fragment } from 'react';
import { Card, CardTitle, EmptyState } from '@/components/ui';
import { ResultBadge } from '@/components/game/ResultBadge';
import { OUTCOME_LETTER } from '@/game/history/stats';
import type { GameResult } from '@/types';

/** `games` are newest first; the strip reads oldest to newest like W - W - D - L - W. */
export function RecentFormSection({ games }: { games: GameResult[] }) {
  const ordered = [...games].reverse();
  const points = games.reduce((s, g) => s + (g.outcome === 'win' ? 1 : g.outcome === 'draw' ? 0.5 : 0), 0);
  return (
    <Card>
      <CardTitle>Recent form</CardTitle>
      {ordered.length === 0 ? (
        <EmptyState title="No form yet" description="Form is calculated from your latest rated games." />
      ) : (
        <>
          <p className="sr-only">{ordered.map((g) => OUTCOME_LETTER[g.outcome]).join(', ')}</p>
          <div aria-hidden className="flex flex-wrap items-center gap-2">
            {ordered.map((g, i) => (
              <Fragment key={g.id}>
                {i > 0 && <span className="text-ink-faint">-</span>}
                <ResultBadge outcome={g.outcome} />
              </Fragment>
            ))}
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            {points} of {games.length} points in your last {games.length} rated {games.length === 1 ? 'game' : 'games'}.
          </p>
        </>
      )}
    </Card>
  );
}
