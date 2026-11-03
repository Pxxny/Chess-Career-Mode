import { useMemo, useState } from 'react';
import { Card, CardTitle, EmptyState, PageHeader } from '@/components/ui';
import { NpcDirectory } from '@/features/world/NpcDirectory';
import { NpcProfileModal } from '@/features/world/NpcProfileModal';
import { NpcTable } from '@/features/world/NpcTable';
import { usePlayer } from '@/hooks/useGame';
import { useRankedNpcs } from '@/hooks/useNpcs';
import type { Npc } from '@/types';

const NEARBY_COUNT = 8;

export function CompletePage() {
  const player = usePlayer();
  const ranked = useRankedNpcs();
  const [selected, setSelected] = useState<Npc | null>(null);

  const nearby = useMemo(
    () =>
      [...ranked]
        .sort((a, b) => Math.abs(a.currentElo - player.rating) - Math.abs(b.currentElo - player.rating))
        .slice(0, NEARBY_COUNT)
        .sort((a, b) => b.currentElo - a.currentElo),
    [ranked, player.rating],
  );

  return (
    <>
      <PageHeader title="Complete" description="Tournaments and matches against the players of your world." />
      <Card className="mb-4">
        <CardTitle>Players near your rating</CardTitle>
        <NpcTable npcs={nearby} onSelect={setSelected} />
      </Card>
      <Card className="mb-4">
        <CardTitle>Player directory</CardTitle>
        <NpcDirectory />
      </Card>
      <EmptyState
        title="Matches and tournaments are coming in a later stage"
        description="You will be able to challenge these players and enter events from here."
      />
      <NpcProfileModal npc={selected} onClose={() => setSelected(null)} />
    </>
  );
}
