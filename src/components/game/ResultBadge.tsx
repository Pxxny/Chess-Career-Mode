import type { GameOutcome } from '@/types';
import { cn } from '@/utils/cn';

const STYLE: Record<GameOutcome, { letter: string; label: string; classes: string }> = {
  win: { letter: 'W', label: 'Win', classes: 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/50' },
  draw: { letter: 'D', label: 'Draw', classes: 'bg-amber-500/20 text-amber-300 ring-amber-400/50' },
  loss: { letter: 'L', label: 'Loss', classes: 'bg-red-500/20 text-red-300 ring-red-400/50' },
};

export const outcomeLabel = (outcome: GameOutcome): string => STYLE[outcome].label;

/** Letter plus colour, so the result never relies on colour alone. */
export function ResultBadge({ outcome, size = 'md' }: { outcome: GameOutcome; size?: 'md' | 'lg' }) {
  const s = STYLE[outcome];
  return (
    <span
      role="img"
      aria-label={s.label}
      className={cn('inline-flex items-center justify-center rounded-full font-bold ring-1', s.classes, size === 'lg' ? 'h-11 w-11 text-lg' : 'h-8 w-8 text-sm')}
    >
      {s.letter}
    </span>
  );
}
