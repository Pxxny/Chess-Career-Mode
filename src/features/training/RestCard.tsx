import { Moon } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, CardTitle } from '@/components/ui';
import { restBlock, restInfo, type RestKind } from '@/game/training/engine';
import { useSave } from '@/hooks/useGame';
import { useGameStore } from '@/store/gameStore';

const OPTIONS: RestKind[] = ['break', 'nap'];

export function RestCard() {
  const save = useSave();
  const rest = useGameStore((s) => s.rest);
  const endDay = useGameStore((s) => s.endDay);
  const [message, setMessage] = useState('');
  const restDay = save.training.hoursUsedToday === 0;

  const doRest = (kind: RestKind) => {
    const result = rest(kind);
    setMessage(result.ok ? `${restInfo(kind).label}: recovered ${result.recovered}% fatigue.` : result.error);
  };
  const sleep = () => {
    const report = endDay();
    if (!report) return;
    setMessage(
      `${report.restDay ? 'A full rest day. ' : ''}You slept and recovered ${report.recovered}% fatigue. It is now ${report.newWeek ? `week ${report.newDay.week}, ` : ''}day ${report.newDay.day}. Action points restored.`,
    );
  };

  return (
    <Card className="mb-4">
      <CardTitle>Rest &amp; recovery</CardTitle>
      <p className="mb-3 text-sm text-ink-muted">Recover during the day with a break or nap, or end the day to sleep. A day with no training recovers extra.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((kind) => {
          const info = restInfo(kind);
          const block = restBlock(save, kind);
          return (
            <Button key={kind} variant="secondary" onClick={() => doRest(kind)} disabled={block !== null} title={block ?? undefined}>
              {info.label} ({info.hours} h, -{info.recovery}%)
            </Button>
          );
        })}
        <Button onClick={sleep}>
          <Moon size={16} aria-hidden />
          {restDay ? 'Rest day: end day' : 'End day & sleep'}
        </Button>
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-ink-muted">
        {message}
      </p>
    </Card>
  );
}
