import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Tone = 'gold' | 'neutral';

const tones: Record<Tone, string> = {
  gold: 'bg-gold-500/15 text-gold-300',
  neutral: 'bg-white/5 text-ink-muted',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>
      {children}
    </span>
  );
}
