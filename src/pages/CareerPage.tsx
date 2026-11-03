import { Card, CardTitle, PageHeader, ProgressBar } from '@/components/ui';
import { CareerLadder } from '@/features/career/CareerLadder';
import { getCareerProgress } from '@/game/career/stages';
import { usePlayer, useWorld } from '@/hooks/useGame';

export function CareerPage() {
  const player = usePlayer();
  const { date } = useWorld();
  const progress = getCareerProgress(player.rating);

  return (
    <>
      <PageHeader
        title="Career"
        description={`Year ${date.year}, week ${date.week}. Every title on the road to World Champion.`}
      />
      <Card className="mb-4">
        <p className="text-sm text-ink-muted">Current stage</p>
        <p className="mt-1 font-display text-2xl font-bold text-gold-400">{progress.current.title}</p>
        <div className="mt-4">
          <ProgressBar value={progress.percent} label="Progress to next career stage" />
          <p className="mt-2 text-sm text-ink-muted">
            {progress.next ? `Next: ${progress.next.title} at ${progress.next.minRating}` : 'Top of the ladder'}
          </p>
        </div>
      </Card>
      <Card>
        <CardTitle>Career ladder</CardTitle>
        <CareerLadder currentId={progress.current.id} />
      </Card>
    </>
  );
}
