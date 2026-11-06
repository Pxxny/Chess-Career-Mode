import { Zap } from 'lucide-react';
import type { ActionPoints } from '@/types';
import { cn } from '@/utils/cn';

export function ApMeter({ ap }: { ap: ActionPoints }) {
  return (
    <div
      role="img"
      aria-label={`${ap.current} of ${ap.max} action points`}
      className="flex items-center gap-2 rounded-full bg-navy-700 px-3 py-1.5"
    >
      <Zap size={14} aria-hidden className="text-gold-400" />
      <span className="text-xs font-bold tracking-wide text-gold-400">AP</span>
      <span className="text-sm font-semibold tabular-nums text-ink">
        {ap.current}
        <span className="text-ink-faint">/{ap.max}</span>
      </span>
      <span aria-hidden className="hidden items-center gap-0.5 sm:flex">
        {Array.from({ length: ap.max }, (_, i) => (
          <span key={i} className={cn('h-3 w-1 rounded-full', i < ap.current ? 'bg-gold-500' : 'bg-navy-600')} />
        ))}
      </span>
    </div>
  );
}
