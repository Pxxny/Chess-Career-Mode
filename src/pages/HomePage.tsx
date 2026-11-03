import { ArrowRight, Dumbbell, Globe, Star, Swords, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardTitle, PageHeader, ProgressBar, StatCard } from '@/components/ui';
import { ROUTES } from '@/data/navigation';
import { NpcProfileModal } from '@/features/world/NpcProfileModal';
import { NpcTable } from '@/features/world/NpcTable';
import { getCareerProgress } from '@/game/career/stages';
import { getWorldRank } from '@/game/npc/rankings';
import { usePlayer } from '@/hooks/useGame';
import { useRankedNpcs } from '@/hooks/useNpcs';
import type { Npc } from '@/types';
import { formatNumber } from '@/utils/format';

const SHORTCUTS = [
  { to: ROUTES.train, label: 'Train', text: 'Build your skills.', icon: Dumbbell },
  { to: ROUTES.complete, label: 'Complete', text: 'Find opponents and events.', icon: Swords },
  { to: ROUTES.career, label: 'Career', text: 'See the path to the title.', icon: TrendingUp },
];

export function HomePage() {
  const player = usePlayer();
  const ranked = useRankedNpcs();
  const [selected, setSelected] = useState<Npc | null>(null);
  const progress = getCareerProgress(player.rating);
  const rank = useMemo(() => getWorldRank(player.rating, ranked), [player.rating, ranked]);

  return (
    <>
      <PageHeader title={`Welcome, ${player.name}`} description="Your career at a glance." />

      <Card className="mb-4">
        <p className="text-sm text-ink-muted">Current rating</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-display text-5xl font-bold tabular-nums text-gold-400">{player.rating}</span>
          <span className="text-lg font-semibold text-ink">{progress.current.title}</span>
        </div>
        <div className="mt-4">
          <ProgressBar value={progress.percent} label="Progress to next career stage" />
          <p className="mt-2 text-sm text-ink-muted">
            {progress.next
              ? `${progress.next.minRating - player.rating} rating points to ${progress.next.title}`
              : 'You have reached the top of the career ladder.'}
          </p>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="World rank" value={`#${formatNumber(rank)}`} hint={`of ${formatNumber(ranked.length + 1)} ranked players`} icon={Globe} />
        <StatCard label="Reputation" value={formatNumber(player.reputation)} hint="Opens invitations later" icon={Star} />
        <StatCard label="Peak rating" value={formatNumber(player.peakRating)} hint={`Age ${player.age}`} icon={TrendingUp} />
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {SHORTCUTS.map(({ to, label, text, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-navy-800 p-4 transition-colors hover:border-gold-500/40"
          >
            <span className="flex items-center gap-3">
              <Icon size={20} aria-hidden className="text-gold-500" />
              <span>
                <span className="block font-semibold text-ink">{label}</span>
                <span className="block text-sm text-ink-muted">{text}</span>
              </span>
            </span>
            <ArrowRight size={16} aria-hidden className="text-ink-faint transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      <Card>
        <CardTitle>Top players in the world</CardTitle>
        <NpcTable npcs={ranked.slice(0, 5)} showRank onSelect={setSelected} />
      </Card>
      <NpcProfileModal npc={selected} onClose={() => setSelected(null)} />
    </>
  );
}
