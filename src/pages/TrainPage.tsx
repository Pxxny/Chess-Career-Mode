import { Card, CardTitle, EmptyState, PageHeader } from '@/components/ui';
import { getArchetype } from '@/data/archetypes';
import { ArchetypeSummary } from '@/features/creation/ArchetypeSummary';
import { SkillList } from '@/features/training/SkillList';
import { usePlayer } from '@/hooks/useGame';

export function TrainPage() {
  const player = usePlayer();

  return (
    <>
      <PageHeader title="Train" description="Spend action points to improve the skills that decide your games." />
      <Card className="mb-4">
        <CardTitle>Your skills</CardTitle>
        <SkillList skills={player.skills} />
      </Card>
      <Card className="mb-4">
        <CardTitle>Your archetype: {getArchetype(player.archetype).label}</CardTitle>
        <ArchetypeSummary archetype={getArchetype(player.archetype)} tendencies={player.tendencies} />
        <p className="mt-4 text-xs text-ink-faint">Your archetype is a starting point. Every skill can be trained, and your tendencies change as you play.</p>
      </Card>
      <EmptyState
        title="Training sessions are coming in a later stage"
        description="Once training is added, you will spend action points here to raise these skills."
      />
    </>
  );
}
