import { barPercent, describeAdvantage, formatCentipawns, formatEval, positionNotes } from '@/game/match/evalFormat';
import type { LiveEval } from '@/game/match/session';
import type { Position } from '@/game/chess/board';
import { cn } from '@/utils/cn';

/** The advantage bar. White's share is at the bottom, always from White's point of view. */
export function EvalBar({ live, orientation = 'vertical', flipped = false }: { live: LiveEval | null; orientation?: 'vertical' | 'horizontal'; flipped?: boolean }) {
  const white = live ? barPercent(live.cp, live.mate) : 50;
  const text = live ? formatEval(live.cp, live.mate) : '–';
  const vertical = orientation === 'vertical';
  const whiteStyle = vertical ? { height: `${white}%` } : { width: `${white}%` };
  return (
    <div
      role="meter"
      aria-label="Advantage bar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(white)}
      aria-valuetext={live ? describeAdvantage(live.cp, live.mate) : 'No evaluation yet'}
      data-testid="eval-bar"
      className={cn('relative overflow-hidden rounded-md border border-white/10 bg-charcoal-900', vertical ? 'h-full min-h-[16rem] w-7' : 'h-5 w-full', vertical && flipped && 'rotate-180')}
    >
      <div className={cn('absolute bg-stone-100 transition-all duration-500', vertical ? 'bottom-0 left-0 right-0' : 'bottom-0 left-0 top-0')} style={whiteStyle} />
      <span className={cn('absolute text-[0.65rem] font-bold', vertical ? 'bottom-1 left-0 right-0 text-center text-charcoal-900' : 'left-1 top-0.5 text-charcoal-900', vertical && flipped && 'rotate-180')}>{white >= 50 ? text : ''}</span>
      <span className={cn('absolute text-[0.65rem] font-bold text-stone-100', vertical ? 'left-0 right-0 top-1 text-center' : 'right-1 top-0.5', vertical && flipped && 'rotate-180')}>{white < 50 ? text : ''}</span>
    </div>
  );
}

/** Numerical evaluation (White's point of view), the engine's line and short notes on the position. */
export function EvalPanel({ live, position, ply, busy }: { live: LiveEval | null; position: Position; ply: number; busy?: boolean }) {
  const notes = positionNotes(position, live, ply);
  return (
    <div data-testid="eval-panel" className="rounded-xl border border-white/[0.06] bg-navy-800 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-ink-faint">Engine evaluation (White)</p>
        {live && live.depth > 0 && <p className="text-[0.7rem] text-ink-faint">{live.engine} · depth {live.depth}</p>}
      </div>
      <p className="mt-1 font-mono text-2xl font-bold text-ink" data-testid="eval-text">{live ? formatEval(live.cp, live.mate) : busy ? '…' : '–'}</p>
      <p className="font-mono text-xs text-ink-muted" data-testid="eval-cp">{live ? formatCentipawns(live.cp, live.mate) : 'Waiting for the engine'}</p>
      {live && live.pv.length > 0 && <p className="mt-2 break-words text-sm text-ink"><span className="text-ink-faint">Best line: </span>{live.pv.slice(0, 6).join(' ')}</p>}
      <ul className="mt-2 space-y-0.5 text-xs text-ink-muted">
        {notes.map((n) => <li key={n}>• {n}</li>)}
      </ul>
    </div>
  );
}
