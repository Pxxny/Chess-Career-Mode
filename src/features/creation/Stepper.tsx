import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { STEPS } from './useCharacterDraft';

interface StepperProps {
  current: number;
  /** Highest step index the player may jump to */
  reachable: number;
  onGo: (index: number) => void;
}

export function Stepper({ current, reachable, onGo }: StepperProps) {
  return (
    <nav aria-label="Character creation steps" className="mb-6">
      <ol className="flex items-center justify-between gap-1">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.id} className="flex flex-1 items-center gap-1 last:flex-none">
              <button
                type="button"
                disabled={i > reachable}
                aria-current={active ? 'step' : undefined}
                onClick={() => onGo(i)}
                className="flex items-center gap-2 rounded-full py-1 pr-2 disabled:cursor-not-allowed"
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                    active ? 'border-gold-500 bg-gold-500 text-navy-950' : done ? 'border-gold-500/60 text-gold-400' : 'border-white/15 text-ink-faint',
                  )}
                >
                  {done ? <Check size={14} aria-hidden /> : i + 1}
                </span>
                <span className={cn('hidden text-sm font-semibold sm:inline', active ? 'text-ink' : 'text-ink-muted')}>{step.title}</span>
              </button>
              {i < STEPS.length - 1 && <span aria-hidden className={cn('h-px flex-1', done ? 'bg-gold-500/50' : 'bg-white/10')} />}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-ink-muted sm:hidden">
        Step {current + 1} of {STEPS.length}: {STEPS[current].title}
      </p>
    </nav>
  );
}
