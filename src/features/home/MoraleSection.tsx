import { Card, CardTitle, ProgressBar } from '@/components/ui';
import type { Morale } from '@/game/player/morale';
import { cn } from '@/utils/cn';

export function MoraleSection({ morale }: { morale: Morale }) {
  return (
    <Card className="mb-4">
      <CardTitle aside={<span className="text-sm font-semibold text-gold-400">{morale.label}</span>}>Morale</CardTitle>
      <p className="mb-2 font-display text-4xl font-bold tabular-nums text-ink">
        {morale.value}
        <span className="text-lg text-ink-faint">/100</span>
      </p>
      <ProgressBar value={morale.value} label="Morale" />
      <ul className="mt-4 divide-y divide-white/5">
        {morale.factors.map((f) => (
          <li key={f.label} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{f.label}</p>
              <p className="text-xs text-ink-muted">{f.note}</p>
            </div>
            <span className={cn('shrink-0 text-sm font-semibold tabular-nums', f.value > 0 ? 'text-emerald-300' : f.value < 0 ? 'text-red-300' : 'text-ink-faint')}>
              {f.value > 0 ? '+' : ''}
              {f.value}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
