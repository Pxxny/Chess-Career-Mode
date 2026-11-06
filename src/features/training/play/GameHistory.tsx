import { useMemo, useState } from 'react';
import { Button, Card, CardTitle, EmptyState } from '@/components/ui';
import { ResultBadge } from '@/components/game/ResultBadge';
import { gameFromSans, START_FEN } from '@/game/chess/rules';
import type { GameMode, PlayedGame } from '@/types';
import { AnalysisPanel } from './AnalysisPanel';

const MODE: Record<GameMode, string> = { training: 'Training', blitz: 'Online blitz', engine: 'Engine' };

/** A past practice game with its analysis, opened from a history list. */
export function GameReview({ game, onClose }: { game: PlayedGame; onClose: () => void }) {
  const state = useMemo(() => gameFromSans(game.moves, game.startFen ?? START_FEN), [game]);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-semibold text-ink">
          {MODE[game.mode]} game vs {game.opponentName} ({game.opponentElo}) · {game.color}
          {game.openingName ? ` · ${game.openingName}` : ''}
        </p>
        <Button variant="secondary" onClick={onClose}>Close review</Button>
      </div>
      {game.simulated ? (
        <p className="text-sm text-ink-muted">This game was simulated, so there is no board to replay.</p>
      ) : (
        <AnalysisPanel game={state} analysis={game.analysis ? { status: 'done', data: game.analysis } : { status: 'idle' }} feedback={[]} color={game.color} />
      )}
    </div>
  );
}

export function GameHistory({ games, title, limit = 10 }: { games: PlayedGame[]; title: string; limit?: number }) {
  const [open, setOpen] = useState<PlayedGame | null>(null);
  const list = [...games].reverse().slice(0, limit);
  if (open) return <GameReview game={open} onClose={() => setOpen(null)} />;
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {list.length === 0 ? (
        <EmptyState title="No games yet" description="Finished games appear here with their result and analysis." />
      ) : (
        <ul className="divide-y divide-white/5">
          {list.map((g) => (
            <li key={g.id} className="flex items-center gap-3 py-2.5">
              <ResultBadge outcome={g.outcome} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{g.opponentName}</p>
                <p className="truncate text-xs text-ink-muted">
                  {MODE[g.mode]} · Elo {g.opponentElo} · {g.color} · {g.timeControl}
                  {g.openingName ? ` · ${g.openingName}` : ''}
                  {g.accuracy !== null ? ` · ${Math.round(g.accuracy)}% accuracy` : ''}
                  {g.simulated ? ' · simulated' : ''}
                </p>
              </div>
              {g.ratingBefore !== null && g.ratingAfter !== null && (
                <span className={`text-sm font-bold tabular-nums ${g.ratingAfter >= g.ratingBefore ? 'text-emerald-300' : 'text-red-300'}`} aria-label={`Rating change ${g.ratingAfter - g.ratingBefore}`}>
                  {g.ratingAfter - g.ratingBefore >= 0 ? '+' : ''}
                  {g.ratingAfter - g.ratingBefore}
                </span>
              )}
              {!g.simulated && <Button variant="secondary" className="min-h-11" onClick={() => setOpen(g)}>Review</Button>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
