import { useMemo, useState } from 'react';
import { Bot, Flag, Handshake, Hand, LogOut, Pause, Play } from 'lucide-react';
import { Badge, Button, Card, ProgressBar } from '@/components/ui';
import { inCheck, type Position } from '@/game/chess/board';
import type { GameEnd } from '@/game/chess/rules';
import { describeTimeControl } from '@/game/match/timeControls';
import type { MatchSetup, MatchSnapshot, Speed } from '@/game/match/session';
import type { MatchSide, MatchTermination, ReviewLabel, PieceColor } from '@/types';
import { useGameStore } from '@/store/gameStore';
import { EvalBar, EvalPanel } from './EvalPanel';
import { MatchBoard } from './MatchBoard';
import { MoveList } from './MoveList';
import { PlayerPanel } from './PlayerPanel';
import { ReviewReport } from './ReviewReport';
import { useMatchSession } from './useMatchSession';

const TERMINATION: Record<MatchTermination, string> = {
  checkmate: 'by checkmate',
  resignation: 'by resignation',
  timeout: 'on time',
  stalemate: 'by stalemate',
  insufficient: 'by insufficient material',
  fiftyMove: 'by the fifty-move rule',
  repetition: 'by threefold repetition',
  agreement: 'by agreement',
  abandoned: 'because the game was abandoned',
};

const SPEEDS: Array<{ id: Speed; label: string }> = [
  { id: 'real', label: 'Real time' },
  { id: 'brisk', label: 'Brisk' },
  { id: 'fast', label: 'Fast-forward' },
  { id: 'max', label: 'Instant' },
];

export function resultText(end: GameEnd, white: MatchSide, black: MatchSide): string {
  const how = TERMINATION[end.reason as MatchTermination] ?? '';
  if (end.result === 'draw') return `Draw ${how}`;
  const winner = end.result === 'white' ? white : black;
  return `${end.result === 'white' ? 'White' : 'Black'} wins ${how} (${winner.name})`;
}

const kingSquare = (pos: Position, color: PieceColor): number => pos.board.findIndex((p) => p === (color === 'white' ? 'K' : 'k'));

interface Props {
  setup: MatchSetup;
  onExit: () => void;
}

/** The live match: board, clocks, evaluation, moves, and the controls to simulate, take control, resign or leave. */
export function MatchViewer({ setup, onExit }: Props) {
  const { session, snap } = useMatchSession(setup);
  const [message, setMessage] = useState<string | null>(null);
  const [offering, setOffering] = useState(false);
  const clocks = session.clocks();
  const live = snap.viewPly === null;
  const shownPly = snap.viewPly ?? snap.game.ucis.length;
  const position: Position = snap.game.positions[shownPly];
  const over = snap.status === 'over';
  const humanSides = (['white', 'black'] as PieceColor[]).filter((c) => snap.controllers[c] === 'human');
  const movable = snap.status === 'running' && live ? (humanSides.length === 2 ? 'both' : (humanSides[0] ?? null)) : null;
  const flipped = setup.playerColor === 'black';
  const player = setup.playerColor;
  const opponent: PieceColor = player === 'white' ? 'black' : 'white';
  const sideOf = (c: PieceColor): MatchSide => (c === 'white' ? setup.white : setup.black);

  const shownMove = shownPly > 0 ? snap.game.moves[shownPly - 1] : null;
  const check = live ? snap.checkSquare : inCheck(position) ? kingSquare(position, position.turn === 'w' ? 'white' : 'black') : -1;
  const mateSquare = over && live && snap.end?.reason === 'checkmate' ? kingSquare(position, snap.end.result === 'white' ? 'black' : 'white') : -1;
  const drawSquares = over && live && snap.end && snap.end.result === 'draw' && snap.end.reason !== 'timeout' && snap.end.reason !== 'agreement' ? [kingSquare(position, 'white'), kingSquare(position, 'black')] : [];
  const labels = snap.analysis.status === 'done' ? (snap.analysis.report.moves.map((m) => m.label) as ReviewLabel[]) : undefined;
  const record = useGameStore((s) => s.save?.matches[s.save.matches.length - 1]);
  const ratingChange = over && setup.rated && record?.ratingBefore != null && record.ratingAfter != null ? record.ratingAfter - record.ratingBefore : null;
  const tournament = setup.tournament;
  const turnColor = snap.turn;

  const confirmLeave = () => {
    const hands = humanSides.length > 0 && snap.game.ucis.length >= 2 && !over;
    if (hands && !window.confirm('Leaving now abandons the game and counts as a loss. Leave anyway?')) return;
    session.leave();
    onExit();
  };

  const offerDraw = async () => {
    setOffering(true);
    setMessage(await session.offerDraw());
    setOffering(false);
  };

  const controlButton = (color: PieceColor) =>
    snap.controllers[color] === 'human' ? (
      <Button variant="secondary" onClick={() => session.setController(color, 'auto')} disabled={over || (humanSides.length === 1 && color === player && setup.mode === 'play' && false)}>
        <Bot className="h-4 w-4" aria-hidden /> Let the simulator play {color === player ? 'my side' : color}
      </Button>
    ) : (
      <Button variant="secondary" onClick={() => session.setController(color, 'human')} disabled={over}>
        <Hand className="h-4 w-4" aria-hidden /> Take control of {color === player ? 'my side' : color}
      </Button>
    );

  const subtitle = useMemo(() => [setup.rated ? 'Rated' : 'Friendly', describeTimeControl(setup.timeControl), snap.referee === 'chess.js' ? 'Rules: chess.js' : 'Rules: built-in'].join(' · '), [setup, snap.referee]);

  return (
    <div className="space-y-4" data-testid="match-viewer">
      <Card className="py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-lg font-bold text-ink" data-testid="match-title">{tournament ? tournament.name : 'Match'}</p>
            <p className="text-xs text-ink-muted">
              {tournament ? `Round ${tournament.round} of ${tournament.rounds} · ` : 'No tournament · '}
              {subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tournament && <Badge tone="gold">Round {tournament.round}</Badge>}
            <Badge>{setup.mode === 'simulate' ? 'Simulation' : 'You play'}</Badge>
            <Button variant="secondary" onClick={confirmLeave}>
              <LogOut className="h-4 w-4" aria-hidden /> {over ? 'Close' : 'Leave'}
            </Button>
          </div>
        </div>
      </Card>

      {snap.notice && <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">{snap.notice}</p>}
      {snap.rulesWarnings > 0 && <p role="status" className="rounded-lg border border-white/10 bg-navy-800 px-3 py-2 text-xs text-ink-muted">The rules engines disagreed {snap.rulesWarnings} time(s); the game was kept in sync.</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-2">
          <PlayerPanel side={sideOf(opponent)} color={opponent} remaining={clocks[opponent]} active={snap.status === 'running' && turnColor === opponent} controller={snap.controllers[opponent]} thinking={snap.thinking === opponent} ratingChange={null} />
          <div className="flex items-stretch gap-2">
            <EvalBar live={snap.live} flipped={flipped} />
            <div className="min-w-0 flex-1">
              <MatchBoard
                position={position}
                perspective={flipped ? 'black' : 'white'}
                movable={movable}
                legalTargets={(from) => session.legalTargets(from)}
                onMove={(uci) => session.humanMove(uci)}
                lastMove={shownMove ? { from: shownMove.from, to: shownMove.to } : null}
                checkSquare={check}
                mateSquare={mateSquare}
                drawSquares={drawSquares}
              />
            </div>
          </div>
          <PlayerPanel side={sideOf(player)} color={player} remaining={clocks[player]} active={snap.status === 'running' && turnColor === player} controller={snap.controllers[player]} thinking={snap.thinking === player} ratingChange={ratingChange} />
          {!live && <p className="text-center text-xs text-ink-muted">Looking at move {shownPly}. <button type="button" className="underline" onClick={() => session.view(null)}>Back to the game</button></p>}
        </div>

        <div className="space-y-3">
          {over && snap.end && (
            <Card data-testid="result-banner" className="border-gold-500/40">
              <p className="font-display text-xl font-bold text-ink">{snap.end.result === 'draw' ? 'Draw' : snap.end.result === 'white' ? 'White wins' : 'Black wins'}</p>
              <p className="text-sm text-ink-muted">{resultText(snap.end, setup.white, setup.black)}</p>
              {setup.rated && ratingChange !== null && <p className="mt-1 text-sm text-ink">Rating {record!.ratingBefore} → <span className="font-semibold">{record!.ratingAfter}</span> ({ratingChange >= 0 ? '+' : ''}{ratingChange})</p>}
              {!setup.rated && <p className="mt-1 text-xs text-ink-faint">A friendly game does not change your rating.</p>}
              {snap.game.ucis.length === 0 && <p className="mt-1 text-xs text-ink-faint">No moves were played, so nothing was recorded.</p>}
            </Card>
          )}

          <Card>
            <div className="flex flex-wrap gap-2" data-testid="match-controls">
              {!over && snap.status !== 'ready' && (
                <>
                  {controlButton(player)}
                  {setup.mode === 'simulate' && humanSides.length === 0 && (snap.status === 'paused' ? (
                    <Button variant="secondary" onClick={() => session.resume()}><Play className="h-4 w-4" aria-hidden /> Resume</Button>
                  ) : (
                    <Button variant="secondary" onClick={() => session.pause()}><Pause className="h-4 w-4" aria-hidden /> Pause</Button>
                  ))}
                  {controlButton(opponent)}
                  <Button variant="secondary" onClick={offerDraw} disabled={offering || snap.controllers[turnColor] !== 'human'}><Handshake className="h-4 w-4" aria-hidden /> Offer draw</Button>
                  <Button variant="danger" onClick={() => session.resign(humanSides.includes(turnColor) ? turnColor : player)} disabled={humanSides.length === 0}><Flag className="h-4 w-4" aria-hidden /> Resign</Button>
                </>
              )}
            </div>
            {!over && (
              <label className="mt-3 block text-xs text-ink-muted">
                Speed of simulated players
                <select data-testid="speed" value={snap.speed} onChange={(e) => session.setSpeed(e.target.value as Speed)} className="mt-1 w-full rounded-lg border border-white/10 bg-navy-900 px-3 py-2 text-sm text-ink">
                  {SPEEDS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
            )}
            {message && <p role="status" className="mt-2 text-sm text-ink-muted">{message}</p>}
            {snap.status === 'paused' && <p className="mt-2 text-sm text-amber-200">Paused. The clocks are stopped.</p>}
          </Card>

          <EvalPanel live={snap.live} position={position} ply={shownPly} busy={snap.status === 'running'} />
          <MoveList sans={snap.game.sans} viewPly={snap.viewPly} onView={(p) => session.view(p)} labels={labels} />
        </div>
      </div>

      {over && snap.game.ucis.length >= 2 && (
        <>
          {snap.analysis.status === 'running' && (
            <Card>
              <p className="mb-2 text-sm text-ink">Analysing the game with the engine… {snap.analysis.done} / {snap.analysis.total} positions</p>
              <ProgressBar value={(snap.analysis.done / Math.max(1, snap.analysis.total)) * 100} label="Analysis progress" />
            </Card>
          )}
          {snap.analysis.status === 'error' && (
            <Card>
              <p className="text-sm text-red-300">The analysis failed: {snap.analysis.message}</p>
              <Button className="mt-2" variant="secondary" onClick={() => session.retryAnalysis()}>Try again</Button>
            </Card>
          )}
          {snap.analysis.status === 'done' && <ReviewReport report={snap.analysis.report} white={setup.white} black={setup.black} selectedPly={snap.viewPly} onSelectPly={(p) => session.view(p)} />}
        </>
      )}
    </div>
  );
}
