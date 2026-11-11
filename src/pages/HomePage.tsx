import { InstallSuggestion } from "@/features/install/InstallSuggestion";
import { EsportsHomeCard } from "@/features/esports/EsportsPanel";
import { calendarLabel, calendarDate } from "@/game/qol/career";
import { ArrowRight, Dumbbell, Swords, TrendingUp } from "lucide-react";
import { useContext, useState } from "react";
import { LanguageContext } from "@/i18n/context";
import { Link } from "react-router-dom";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { ROUTES } from "@/data/navigation";
import { CompetitionsSection } from "@/features/home/CompetitionsSection";
import { LastResultSection } from "@/features/home/LastResultSection";
import { MoraleSection } from "@/features/home/MoraleSection";
import { NewsSection } from "@/features/home/NewsSection";
import { RatingsSection } from "@/features/home/RatingsSection";
import { InstallCard } from "@/features/home/InstallCard";
import { RankingsSection } from "@/features/home/RankingsSection";
import { RecentFormSection } from "@/features/home/RecentFormSection";
import { TitlesSection } from "@/features/home/TitlesSection";
import { useDashboard } from "@/features/home/useDashboard";
import { NpcProfileModal } from "@/features/world/NpcProfileModal";
import { NpcTable } from "@/features/world/NpcTable";
import { getCareerProgress } from "@/game/career/stages";
import { GAME_CONFIG } from "@/data/config";
import { lastGame, recentGames } from "@/game/history/stats";
import type { Npc } from "@/types";

const SHORTCUTS = [
  {
    to: ROUTES.train,
    label: "Train",
    text: "Build your skills.",
    icon: Dumbbell,
  },
  {
    to: ROUTES.complete,
    label: "Complete",
    text: "Find opponents and events.",
    icon: Swords,
  },
  {
    to: ROUTES.career,
    label: "Career",
    text: "See the path to the title.",
    icon: TrendingUp,
  },
];

export function HomePage() {
  useContext(LanguageContext);
  const { save, ranked, rankings, titles, morale, schedule, news } =
    useDashboard();
  const { player, history } = save;
  const [selected, setSelected] = useState<Npc | null>(null);
  const progress = getCareerProgress(player.rating);

  return (
    <>
      <InstallSuggestion />
      <PageHeader
        title={`Welcome, ${player.name}`}
        description="Your career at a glance."
      />
      <EsportsHomeCard />

      <time
        dateTime={calendarDate(save).toISOString().slice(0, 10)}
        className="mb-5 block text-sm font-semibold text-ink-muted"
        data-testid="home-date"
      >
        {calendarLabel(save)} · Week {save.world.date.week}, day{" "}
        {save.world.day}
      </time>
      <Link
        to="/train?tab=work"
        className="mb-5 inline-block text-sm font-semibold text-gold-300 underline underline-offset-4"
      >
        Work & income →
      </Link>
      <RatingsSection player={player} rankings={rankings} progress={progress} />
      <RankingsSection player={player} ranked={ranked} onSelect={setSelected} />
      <TitlesSection titles={titles} />
      <CompetitionsSection
        player={player}
        schedule={schedule}
        rankings={rankings}
      />

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <LastResultSection game={lastGame(history)} />
        <RecentFormSection
          games={recentGames(history, GAME_CONFIG.history.recentFormGames)}
        />
      </div>

      <MoraleSection morale={morale} />
      <NewsSection news={news} />

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
            <ArrowRight
              size={16}
              aria-hidden
              className="text-ink-faint transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </div>

      <Card>
        <CardTitle>Top players in the world</CardTitle>
        <NpcTable npcs={ranked.slice(0, 5)} showRank onSelect={setSelected} />
      </Card>
      <InstallCard />
      <NpcProfileModal npc={selected} onClose={() => setSelected(null)} />
    </>
  );
}
