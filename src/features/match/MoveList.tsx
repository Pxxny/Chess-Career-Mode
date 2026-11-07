import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { LABEL_TEXT } from '@/game/match/review';
import type { ReviewLabel } from '@/types';
import { cn } from '@/utils/cn';

const MARK: Partial<Record<ReviewLabel, { symbol: string; classes: string }>> = {
  brilliant: { symbol: '!!', classes: 'text-cyan-300' },
  best: { symbol: '★', classes: 'text-emerald-300' },
  excellent: { symbol: '!', classes: 'text-emerald-300' },
  inaccuracy: { symbol: '?!', classes: 'text-amber-300' },
  mistake: { symbol: '?', classes: 'text-orange-400' },
  missed: { symbol: '✕', classes: 'text-orange-300' },
  blunder: { symbol: '??', classes: 'text-red-400' },
};

interface Props {
  sans: readonly string[];
  /** The half-move being shown (0 = start position), or null for the live position */
  viewPly: number | null;
  onView: (ply: number | null) => void;
  labels?: readonly ReviewLabel[];
}

/** "1. e4 e5" rows. Click a move to see that position; the arrows and keys step through the game. */
export function MoveList({ sans, viewPly, onView, labels }: Props) {
  const current = viewPly ?? sans.length;
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [current, sans.length]);

  const go = (ply: number) => onView(ply >= sans.length ? null : Math.max(0, ply));
  const rows: number[] = [];
  for (let i = 0; i < sans.length; i += 2) rows.push(i);
  const cell = (ply: number) => {
    const san = sans[ply];
    if (san === undefined) return <span />;
    const label = labels?.[ply];
    const mark = label ? MARK[label] : undefined;
    return (
      <button
        type="button"
        ref={ply + 1 === current ? activeRef : undefined}
        data-ply={ply + 1}
        aria-label={`Move ${Math.floor(ply / 2) + 1}${ply % 2 ? ' black' : ''}: ${san}${label ? `, ${LABEL_TEXT[label]}` : ''}`}
        aria-current={ply + 1 === current ? 'true' : undefined}
        onClick={() => go(ply + 1)}
        className={cn('rounded px-2 py-0.5 text-left font-mono text-sm hover:bg-white/10', ply + 1 === current ? 'bg-gold-500 font-bold text-navy-950' : 'text-ink')}
      >
        {san}
        {mark && <span className={cn('ml-1 text-xs font-bold', ply + 1 === current ? 'text-navy-950' : mark.classes)}>{mark.symbol}</span>}
      </button>
    );
  };

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-navy-800 p-2"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
        else if (e.key === 'Home') { e.preventDefault(); go(0); }
        else if (e.key === 'End') { e.preventDefault(); onView(null); }
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <p className="px-1 text-xs uppercase tracking-wide text-ink-faint">Moves</p>
        <div className="flex gap-1">
          {([
            ['Start', ChevronsLeft, () => go(0), current === 0],
            ['Previous move', ChevronLeft, () => go(current - 1), current === 0],
            ['Next move', ChevronRight, () => go(current + 1), current >= sans.length],
            ['Latest move', ChevronsRight, () => onView(null), current >= sans.length],
          ] as const).map(([label, Icon, action, disabled]) => (
            <button key={label} type="button" aria-label={label} disabled={disabled} onClick={action} className="rounded-md bg-navy-700 p-1.5 text-ink hover:bg-navy-600 disabled:opacity-40">
              <Icon className="h-4 w-4" aria-hidden />
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto pr-1" data-testid="move-list">
        {rows.length === 0 && <p className="px-1 py-3 text-sm text-ink-muted">No moves yet.</p>}
        {rows.map((i) => (
          <div key={i} className="grid grid-cols-[2.2rem_1fr_1fr] items-center gap-1">
            <span className="px-1 text-right font-mono text-xs text-ink-faint">{i / 2 + 1}.</span>
            {cell(i)}
            {cell(i + 1)}
          </div>
        ))}
      </div>
    </div>
  );
}
