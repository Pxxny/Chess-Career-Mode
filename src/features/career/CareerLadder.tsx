import { Badge } from '@/components/ui';
import { CAREER_STAGES } from '@/data/careerStages';
import { cn } from '@/utils/cn';

export function CareerLadder({ currentId }: { currentId: string }) {
  const currentIndex = CAREER_STAGES.findIndex((s) => s.id === currentId);

  return (
    <ol className="divide-y divide-white/5">
      {CAREER_STAGES.map((stage, i) => {
        const reached = i <= currentIndex;
        return (
          <li key={stage.id} className={cn('flex items-center justify-between gap-4 py-3', !reached && 'opacity-60')}>
            <div className="min-w-0">
              <p className="font-semibold text-ink">{stage.title}</p>
              <p className="text-sm text-ink-muted">{stage.summary}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm tabular-nums text-ink-faint">{stage.minRating}+</span>
              {i === currentIndex && <Badge tone="gold">Current</Badge>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
