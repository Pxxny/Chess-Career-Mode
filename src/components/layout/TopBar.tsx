import { Link } from 'react-router-dom';
import { ApMeter } from '@/components/game/ApMeter';
import { MoneyChip } from '@/components/game/MoneyChip';
import { Avatar } from '@/components/ui';
import { ROUTES } from '@/data/navigation';
import { usePlayer } from '@/hooks/useGame';

export function TopBar() {
  const player = usePlayer();

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-navy-950/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
        <Link
          to={ROUTES.profile}
          aria-label={`Open profile for ${player.name}`}
          className="flex min-w-0 items-center gap-3 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-white/5"
        >
          <Avatar name={player.name} seed={player.avatarSeed} appearance={player.appearance} />
          <span className="truncate font-semibold text-ink">{player.name}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <ApMeter ap={player.ap} />
          <MoneyChip amount={player.money} />
        </div>
      </div>
    </header>
  );
}
