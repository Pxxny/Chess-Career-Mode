import { useId, type ReactNode } from 'react';
import { mixSeed } from '@/game/rng';
import type { GameSave } from '@/types';
import { cn } from '@/utils/cn';

export function hashString(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** A seed that is stable for the career and changes with every game played. */
export const gameSeed = (save: GameSave, salt = 0): number => mixSeed(mixSeed(hashString(save.career.id), save.practice.gameCounter + salt), save.world.date.week);

/** Average of the player's skills, 0 to 100 */
export function skillAverage(save: GameSave): number {
  const values = Object.values(save.player.skills);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">{label}</label>
      {children(id)}
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export const selectClass = 'min-h-11 w-full rounded-lg border border-white/10 bg-navy-900 px-3 text-sm text-ink focus:border-gold-500 focus:outline-none';

/** A row of mutually exclusive buttons */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ id: T; label: string; disabled?: boolean }>; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="mb-1 text-sm font-semibold text-ink">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            disabled={o.disabled}
            onClick={() => onChange(o.id)}
            className={cn('min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-40', value === o.id ? 'border-gold-500 bg-gold-500/10 text-gold-300' : 'border-white/10 bg-navy-900 text-ink-muted hover:text-ink')}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StatusLine({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return <p role={tone === 'warn' ? 'alert' : undefined} className={cn('rounded-lg px-3 py-2 text-sm', tone === 'warn' ? 'bg-red-500/10 text-red-300' : 'bg-navy-900 text-ink-muted')}>{children}</p>;
}
