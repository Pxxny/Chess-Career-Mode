import { useMemo, useState } from 'react';
import { Badge, Button, Card, CardTitle } from '@/components/ui';
import { ResultBadge } from '@/components/game/ResultBadge';
import { buildFeedback } from '@/game/play/feedback';
import { OBJECTIVE_BY_ID } from '@/game/play/objectives';
import { formatClock } from '@/game/play/timeControls';
import { useEngineInfo } from '@/hooks/useEngineInfo';
import { useOpeningDb } from '@/store/openingStore';
import { cn } from '@/utils/cn';
import { AnalysisPanel } from './AnalysisPanel';
import { PlayBoard } from './PlayBoard';
import { useGameSession, type SessionConfig } from './useGameSession';

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

const REASON: Record<string, string> = {
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

interface Props {
  config: SessionConfig;
  title: string;
  /** Called when the player is done with the result screen */
  onExit: () => void;
  /** Extra line under the result, such as a rating change */
  extra?: (info: { ratingChange: number | null; ratingAfter: number | null }) => string | null;
  onAgain?: () => void;
}

function Clock({ ms, active, label }: { ms: number; active: boolean; label: string }) {
  return (
    <span role="timer" aria-label={`${label} clock`} className={cn('shrink-0 rounded-lg px-3 py-1 font-mono text-xl font-bold tabular-nums', active ? 'bg-gold-500 text-navy-950' : 'bg-navy-700 text-ink', ms < 10000 && 'text-red-300')}>
      {formatClock(ms)}
    </span>
  );
}

/** The game itself: players, clocks, board, move list, controls, and then the result with its analysis. */
export function GameScreen({ config, title, onExit, extra, onAgain }: Props) {
  const s = useGameSession(config);
  const db = useOpeningDb();
  const engine = useEngineInfo();
  const [confirm, setConfirm] = useState(false);
  const [drawMessage, setDrawMessage] = useState<string | null>(null);
  const opponentColor = config.color === 'white' ? 'black' : 'white';
  const turn = s.position.turn === 'w' ? 'white' : 'black';

  const material = useMemo(() => {
    let w = 0;
    let b = 0;
    for (const p of s.position.board) {
      if (!p) continue;
      const v = VALUE[p.toLowerCase()] ?? 0;
      if (p === p.toUpperCase()) w += v;
      else b += v;
    }
    return w - b;
  }, [s.position]);
  const playerLead = config.color === 'white' ? material : -material;

  const lastMove = s.game.moves.length ? s.game.moves[s.game.moves.length - 1] : null;
  const outcome = s.result ? (s.result.result === 'draw' ? 'draw' : (s.result.result === config.color ? 'win' : 'loss')) : null;

  const feedback = useMemo(() => {
    if (!s.result || s.analysis.status !== 'done' || !outcome) return [];
    return buildFeedback({ objective: config.objective, color: config.color, outcome, game: s.game, analysis: s.analysis.data, db, forcedLine: config.forcedLine, moveTimes: s.moveTimes, timeControl: config.timeControl, takebacks: s.takebacks });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.result, s.analysis]);

  const objective = config.objective ? OBJECTIVE_BY_ID[config.objective] : null;
  const rec = s.recorded;
  const extraLine = rec && extra ? extra({ ratingChange: rec.ratingChange, ratingAfter: rec.game.ratingAfter }) : null;

  const opponentBar = (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="break-words font-semibold text-ink">{config.opponent.name}</p>
        <p className="text-xs text-ink-muted">Elo {config.opponent.elo} · {opponentColor}{playerLead < 0 ? ` · +${-playerLead}` : ''}</p>
      </div>
      {s.hasClock && <Clock ms={s.over ? s.clocks[opponentColor] : s.clocks[opponentColor]} active={!s.over && turn === opponentColor} label="Opponent" />}
    </div>
  );
  const playerBar = (
    <div className="flex items-center justify-between gap-2">
      <div>
        <p className="font-semibold text-ink">You</p>
        <p className="text-xs text-ink-muted">{config.color}{playerLead > 0 ? ` · +${playerLead}` : ''}</p>
      </div>
      {s.hasClock && <Clock ms={s.clocks[config.color]} active={!s.over && turn === config.color} label="Your" />}
    </div>
  );

  const status = s.result
    ? ''
    : s.thinking
      ? `${config.opponent.name} is thinking…`
      : s.canMove
        ? `Your move${s.position.turn === 'w' ? ' (White)' : ' (Black)'}.`
        : '';

  return (
    <>
      <Card>
        <CardTitle aside={<div className="flex flex-wrap gap-2">{objective && <Badge tone="gold">{objective.label}</Badge>}<Badge>{config.timeControl.label}</Badge>{config.mode === 'engine' && <Badge>{engine.label}</Badge>}</div>}>{title}</CardTitle>

        {config.mode === 'blitz' && <p className="mb-3 text-sm text-ink-muted">Simulated online game · Your opponent is computer controlled.</p>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
          <div className="space-y-2">
            {opponentBar}
            <PlayBoard position={s.position} perspective={config.color} playerColor={config.color} canMove={s.canMove} lastMove={lastMove} hint={s.hint} onMove={s.move} />
            {playerBar}
            <p aria-live="polite" className="min-h-5 text-sm text-ink-muted">{status}</p>
          </div>

          <div className="space-y-3">
            {s.result && outcome ? (
              <div role="status" className="rounded-xl border border-gold-500/40 bg-gold-500/5 p-4">
                <div className="flex items-center gap-3">
                  <ResultBadge outcome={outcome} size="lg" />
                  <div>
                    <p className="font-display text-xl font-bold text-ink">{outcome === 'win' ? 'You won' : outcome === 'draw' ? 'Draw' : 'You lost'} {REASON[s.result.reason]}</p>
                    {extraLine && <p className="text-sm text-gold-300">{extraLine}</p>}
                  </div>
                </div>
                {rec && (
                  <p className="mt-2 text-sm text-ink-muted">
                    {rec.gains.map((g) => `+${g.xp} ${g.stat}${g.levels ? ` (level ${g.value}!)` : ''}`).join(' · ')}{rec.apSpent > 0 ? ` · -${rec.apSpent} AP` : ''}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {onAgain && <Button onClick={onAgain}>Play again</Button>}
                  <Button variant="secondary" onClick={onExit}>Back to setup</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={!s.canMove || s.game.ucis.length < 2} onClick={async () => setDrawMessage(await s.offerDraw())}>Offer draw</Button>
                {config.allowTakeback && <Button variant="secondary" disabled={s.thinking || s.game.ucis.length === 0} onClick={s.takeback}>Take back</Button>}
                {config.allowHint && <Button variant="secondary" disabled={!s.canMove} onClick={s.requestHint}>Hint</Button>}
                {confirm ? (
                  <>
                    <Button variant="danger" onClick={() => { s.resign(); setConfirm(false); }}>Confirm resign</Button>
                    <Button variant="secondary" onClick={() => setConfirm(false)}>Keep playing</Button>
                  </>
                ) : (
                  <Button variant="danger" onClick={() => (s.game.ucis.length < 2 ? (s.leave(), onExit()) : setConfirm(true))}>{s.game.ucis.length < 2 ? 'Leave' : 'Resign'}</Button>
                )}
              </div>
            )}
            {drawMessage && !s.result && <p aria-live="polite" className="text-sm text-ink-muted">{drawMessage}</p>}
            {s.notice && <p role="alert" className="rounded-lg bg-red-500/10 p-2 text-sm text-red-300">{s.notice}</p>}
            {config.liveFeedback && s.feedback && !s.result && (
              <p aria-live="polite" className="rounded-lg bg-navy-900 p-2 text-sm text-ink">
                <span className="font-semibold">{s.feedback.san}</span>: {s.feedback.label === 'best' ? 'the engine\'s top choice.' : s.feedback.label === 'good' ? 'a good move.' : `${s.feedback.label}${s.feedback.betterSan ? `, ${s.feedback.betterSan} was better` : ''}.`}
              </p>
            )}
            {s.hints > 0 && !s.result && <p className="text-xs text-ink-faint">Hints used: {s.hints}</p>}

            <div className="max-h-64 overflow-y-auto rounded-lg bg-navy-900 p-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-muted">Moves</p>
              {s.game.sans.length === 0 ? (
                <p className="text-sm text-ink-faint">No moves yet.</p>
              ) : (
                <ol className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink">
                  {s.game.sans.map((san, i) => (
                    <li key={i}>
                      {(s.game.positions[i].turn === 'w' || i === 0) && <span className="mr-1 text-ink-faint">{s.game.positions[i].fullmove}{s.game.positions[i].turn === 'w' ? '.' : '...'}</span>}
                      <span className="font-semibold">{san}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            {!s.result && <p className="text-xs text-ink-faint">Leaving this screen during a game counts as resigning it.</p>}
            {config.startFen && <p className="text-xs text-ink-faint">Started from a set position, so this game does not count toward opening statistics.</p>}
          </div>
        </div>
      </Card>

      {s.result && <AnalysisPanel game={s.game} analysis={s.analysis} feedback={feedback} color={config.color} />}
    </>
  );
}

