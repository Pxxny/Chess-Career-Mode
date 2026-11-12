import { Link } from "react-router-dom";
import { MonitorCheck, Monitor, Volume2, VolumeX } from "lucide-react";
import type { ScreenWakeStatus } from "@/hooks/useScreenWakeLock";
import { setSoundEnabled, useSoundEnabled } from "@/audio/sound";
import { LanguageSelector } from "@/i18n/LanguageSelector";
import { ApMeter } from "@/components/game/ApMeter";
import { MoneyChip } from "@/components/game/MoneyChip";
import { Avatar } from "@/components/ui";
import { ROUTES } from "@/data/navigation";
import { usePlayer } from "@/hooks/useGame";

export function TopBar({ wakeStatus }: { wakeStatus: ScreenWakeStatus }) {
  const player = usePlayer();
  const sound = useSoundEnabled();

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-navy-950/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-2 sm:flex sm:h-20 sm:justify-between sm:px-7 sm:py-0">
        <Link
          to={ROUTES.profile}
          aria-label={`Open profile for ${player.name}`}
          className="flex min-w-0 items-center gap-3 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-white/5"
        >
          <Avatar
            name={player.name}
            seed={player.avatarSeed}
            appearance={player.appearance}
          />
          <span translate="no" className="truncate font-semibold text-ink">
            {player.name}
          </span>
        </Link>
        <div
          data-performance-trigger
          className="col-start-1 row-start-2 flex min-w-0 touch-manipulation select-none items-center gap-2 sm:ml-auto"
        >
          <ApMeter ap={player.ap} />
          <MoneyChip amount={player.money} />
        </div>
        <div className="col-start-2 row-start-1 flex items-center gap-2">
          <span data-testid="screen-wake-status" data-status={wakeStatus} role="img" aria-label={wakeStatus === "active" ? "Screen stays awake" : wakeStatus === "unavailable" ? "Screen wake lock is unavailable in this browser" : "Screen wake lock is waiting for the browser"}
            title={wakeStatus === "active" ? "Screen stays awake" : wakeStatus === "unavailable" ? "Screen wake lock is unavailable in this browser" : "Screen wake lock is waiting for the browser"}
            className={`flex items-center gap-2 text-xs ${wakeStatus === "active" ? "text-gold-400" : "text-ink-faint"}`}>
            {wakeStatus === "active" ? <MonitorCheck size={17} /> : <Monitor size={17} />}
          </span>
          <button
            type="button"
            aria-label={sound ? "Turn sound off" : "Turn sound on"}
            aria-pressed={sound}
            onClick={() => setSoundEnabled(!sound)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 text-ink-muted hover:text-ink"
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <LanguageSelector compact />
        </div>
      </div>
    </header>
  );
}
