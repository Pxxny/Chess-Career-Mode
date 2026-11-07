import { useMemo, useState } from 'react';
import { Card, CardTitle, EmptyState } from '@/components/ui';
import { ResultBadge } from '@/components/game/ResultBadge';
import { useSave } from '@/hooks/useGame';
import { gameFromSans } from '@/game/chess/rules';
import { describeTimeControl } from '@/game/match/timeControls';
import { inCheck } from '@/game/chess/board';
import type { MatchRecord, ReviewLabel } from '@/types';
import { EvalBar } from './EvalPanel';
import { MatchBoard } from './MatchBoard';
import { MoveList } from './MoveList';
import { ReviewReport } from './ReviewReport';
import { PlayerPanel } from './PlayerPanel';

const NO_TARGETS = (): string[] => [];

/** Replay of a stored game with its analysis. */
function Replay({ match, onClose }: { match: MatchRecord; onClose: () => void }) {
  const game = useMemo(() => gameFromSans(match.moves), [match]);
  const [view, setView] = useState<number | null>(null);
  const ply = view ?? game.ucis.length;
  const position = game.positions[ply];
  const last = ply > 0 ? game.moves[ply - 1] : null;
  const king = inCheck(position) ? position.board.findIndex((p) => p === (position.turn === 'w' ? 'K' : 'k')) : -1;
  const report = match.analysis;
  const live = report ? { cp: report.evals[ply] ?? 0, mate: ply > 0 ? (report.moves[ply - 1]?.mateAfter ?? null) : null, depth: report.depth, bestSan: null, pv: [], engine: report.engine, ply } : null;
  const flipped = match.setup.playerColor === 'black';
  const top = flipped ? 'white' : 'black';
  const bottom = flipped ? 'black' : 'white';
  return (
    <div className="space-y-3" data-testid="replay">
      <button type="button" onClick={onClose} className="text-sm text-gold-300 underline">← Back to the list</button>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-2">
          <PlayerPanel side={match.setup[top]} color={top} remaining={Infinity} active={false} controller="auto" thinking={false} />
          <div className="flex gap-2">
            <EvalBar live={live} flipped={flipped} />
            <div className="min-w-0 flex-1"><MatchBoard position={position} perspective={flipped ? 'black' : 'white'} movable={null} legalTargets={NO_TARGETS} onMove={() => undefined} lastMove={last ? { from: last.from, to: last.to } : null} checkSquare={king} /></div>
          </div>
          <PlayerPanel side={match.setup[bottom]} color={bottom} remaining={Infinity} active={false} controller="auto" thinking={false} />
        </div>
        <MoveList sans={match.moves} viewPly={view} onView={setView} labels={report?.moves.map((m) => m.label) as ReviewLabel[] | undefined} />
      </div>
      {report ? <ReviewReport report={report} white={match.setup.white} black={match.setup.black} selectedPly={view} onSelectPly={setView} /> : <Card><p className="text-sm text-ink-muted">This game has no analysis (it was closed before the engine finished).</p></Card>}
    </div>
  );
}

/** Every finished match, newest first. */
export function MatchHistory() {
  const save = useSave();
  const [open, setOpen] = useState<string | null>(null);
  const matches = [...save.matches].reverse();
  const match = matches.find((m) => m.id === open);
  if (match) return <Replay match={match} onClose={() => setOpen(null)} />;
  return (
    <Card>
      <CardTitle>Match history</CardTitle>
      {matches.length === 0 ? (
        <EmptyState title="No games yet" description="Finished games appear here with their full analysis." />
      ) : (
        <ul className="divide-y divide-white/[0.06]" data-testid="match-history">
          {matches.map((m) => {
            const opp = m.setup.playerColor === 'white' ? m.setup.black : m.setup.white;
            return (
              <li key={m.id}>
                <button type="button" onClick={() => setOpen(m.id)} className="flex w-full flex-wrap items-center gap-3 py-3 text-left hover:bg-white/5">
                  <ResultBadge outcome={m.outcome} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">vs {opp.name} ({opp.elo})</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {m.setup.tournament ? `${m.setup.tournament.name}, round ${m.setup.tournament.round} · ` : ''}
                      {m.setup.rated ? 'Rated' : 'Friendly'} · {describeTimeControl(m.setup.timeControl)} · {m.openingName ?? 'Unknown opening'}{m.simulated ? ' · simulated' : ''}
                    </span>
                  </span>
                  {m.ratingBefore !== null && m.ratingAfter !== null && <span className="font-mono text-sm text-ink-muted">{m.ratingAfter - m.ratingBefore >= 0 ? '+' : ''}{m.ratingAfter - m.ratingBefore}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
