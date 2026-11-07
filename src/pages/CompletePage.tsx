import { useMemo, useState } from 'react';
import { Card, CardTitle, PageHeader, Tabs } from '@/components/ui';
import { MatchHistory } from '@/features/match/MatchHistory';
import { MatchSetupPanel } from '@/features/match/MatchSetupPanel';
import { MatchViewer } from '@/features/match/MatchViewer';
import { TournamentPanel } from '@/features/match/TournamentPanel';
import { NpcDirectory } from '@/features/world/NpcDirectory';
import { NpcProfileModal } from '@/features/world/NpcProfileModal';
import { NpcTable } from '@/features/world/NpcTable';
import { usePlayer } from '@/hooks/useGame';
import { useRankedNpcs } from '@/hooks/useNpcs';
import type { MatchSetup } from '@/game/match/session';
import type { Npc } from '@/types';

const NEARBY_COUNT = 8;
type Tab = 'play' | 'tournament' | 'history' | 'players';

export function CompletePage() {
  const player = usePlayer();
  const ranked = useRankedNpcs();
  const [selected, setSelected] = useState<Npc | null>(null);
  const [tab, setTab] = useState<Tab>('play');
  const [active, setActive] = useState<MatchSetup | null>(null);

  const nearby = useMemo(
    () =>
      [...ranked]
        .sort((a, b) => Math.abs(a.currentElo - player.rating) - Math.abs(b.currentElo - player.rating))
        .slice(0, NEARBY_COUNT)
        .sort((a, b) => b.currentElo - a.currentElo),
    [ranked, player.rating],
  );

  if (active) {
    return (
      <>
        <PageHeader title="Match" description="Play it yourself, or let the simulator play and take control whenever you like." />
        <MatchViewer key={active.seed} setup={active} onExit={() => setActive(null)} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Complete" description="Rated games, tournaments and matches against the players of your world." />
      <Tabs
        label="Complete sections"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'play', label: 'Play' },
          { id: 'tournament', label: 'Tournaments' },
          { id: 'history', label: 'History' },
          { id: 'players', label: 'Players' },
        ]}
      >
        {tab === 'play' && <MatchSetupPanel onStart={setActive} />}
        {tab === 'tournament' && <TournamentPanel onStart={setActive} />}
        {tab === 'history' && <MatchHistory />}
        {tab === 'players' && (
          <>
            <Card className="mb-4">
              <CardTitle>Players near your rating</CardTitle>
              <NpcTable npcs={nearby} onSelect={setSelected} />
            </Card>
            <Card className="mb-4">
              <CardTitle>Player directory</CardTitle>
              <NpcDirectory />
            </Card>
          </>
        )}
      </Tabs>
      <NpcProfileModal npc={selected} onClose={() => setSelected(null)} />
    </>
  );
}
