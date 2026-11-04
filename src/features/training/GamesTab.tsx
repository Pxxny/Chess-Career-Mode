import { Card, CardTitle, EmptyState } from '@/components/ui';
import { ResultBadge } from '@/components/game/ResultBadge';
import { recentGames } from '@/game/history/stats';
import { useSave } from '@/hooks/useGame';

export function GamesTab() {
  const { history, training } = useSave();
  const thematic = history.sessions.filter((s) => s.sessionId === 'thematic-games').slice(-5).reverse();
  const rated = recentGames(history, 5);

  return (
    <>
      <Card className="mb-4">
        <CardTitle>Games to analyse</CardTitle>
        <p className="font-display text-3xl font-bold tabular-nums text-ink">{training.unanalyzedGames}</p>
        <p className="mt-1 text-sm text-ink-muted">
          Rated games and thematic games you have not yet gone over. Use Analyze Your Game in the Sessions tab (Chess) to learn from them.
        </p>
      </Card>

      <Card className="mb-4">
        <CardTitle>Recent thematic games</CardTitle>
        {thematic.length === 0 ? (
          <EmptyState title="No thematic games yet" description="Complete a Thematic Games session to see it here." />
        ) : (
          <ul className="divide-y divide-white/5">
            {thematic.map((s, i) => (
              <li key={`${s.year}-${s.week}-${s.day}-${i}`} className="py-2.5">
                <p className="font-semibold text-ink">{s.detail ?? s.name}</p>
                <p className="text-xs text-ink-muted">
                  {s.qualityLabel} session · year {s.year}, week {s.week}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Recent rated games</CardTitle>
        {rated.length === 0 ? (
          <EmptyState title="No rated games yet" description="Playing full games against opponents arrives with the match engine. They will be listed here." />
        ) : (
          <ul className="divide-y divide-white/5">
            {rated.map((g) => (
              <li key={g.id} className="flex items-center gap-3 py-2.5">
                <ResultBadge outcome={g.outcome} />
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{g.opponentName}</p>
                  <p className="text-xs text-ink-muted">
                    Elo {g.opponentElo} · {g.color}
                    {g.opening ? ` · ${g.opening}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
