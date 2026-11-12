import { CareerNewsroom } from "@/features/news/CareerNews";
import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Dumbbell, Swords } from "lucide-react";
import { LanguageContext } from "@/i18n/context";
import { SimulateSeason } from "@/features/career/SimulateSeason";
import { InstallSuggestion } from "@/features/install/InstallSuggestion";
import { EsportsHomeCard } from "@/features/esports/EsportsPanel";
import { calendarLabel, calendarDate } from "@/game/qol/career";
import { Card, CardTitle, PageHeader } from "@/components/ui";
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

export function HomePage() {
  useContext(LanguageContext);
  const { save, ranked, rankings, titles, morale, schedule, news } = useDashboard();
  const { player, history } = save;
  const [selected, setSelected] = useState<Npc | null>(null);
  const progress = getCareerProgress(player.rating);
  return (
    <>
      <InstallSuggestion />
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">Your chess journey</p>
      <PageHeader title={`Welcome, ${player.name}`} description="A little progress. Every day." />
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        <CalendarDays size={15} className="text-gold-400" aria-hidden />
        <time dateTime={calendarDate(save).toISOString().slice(0, 10)} data-testid="home-date">
          {calendarLabel(save)} · Week {save.world.date.week}, day {save.world.day}
        </time>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[1.3fr_1fr]">
        <RatingsSection player={player} rankings={rankings} progress={progress} />
        <Card className="mb-4">
          <CardTitle>Your next move</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: "/train", label: "Train", detail: "Build your skills.", icon: Dumbbell },
              { to: "/complete", label: "Tournament", detail: "Find your next event.", icon: Swords },
            ].map(({ to, label, detail, icon: Icon }) => (
              <Link key={to} to={to} className="group min-w-0 rounded-xl border border-white/10 bg-navy-900/60 p-3 transition-colors hover:border-gold-500/40 hover:bg-gold-500/5">
                <div className="mb-4 flex justify-between text-gold-400"><Icon size={21} aria-hidden /><ArrowUpRight size={15} aria-hidden /></div>
                <span className="block text-sm font-semibold text-ink">{label}</span>
                <span className="mt-1 block text-xs text-ink-faint">{detail}</span>
              </Link>
            ))}
          </div>
          <Link to="/train?tab=work" className="mt-4 inline-flex min-h-11 items-center text-xs font-semibold text-ink-muted hover:text-gold-300">Work & income →</Link>
        </Card>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[1.3fr_1fr]">
        <SimulateSeason />
        <Card className="mb-4">
          <CardTitle>Plan your career</CardTitle>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {[
              ["plan", "Season plan"], ["championship", "Championship path"],
              ["people", "People & stories"], ["business", "Sponsors & legacy"],
            ].map(([view, label]) => <Link key={view} className="flex min-h-11 items-center justify-between gap-2 text-ink-muted hover:text-gold-300" to={`/career?view=${view}`}><span>{label}</span><ArrowUpRight size={14} className="shrink-0 text-ink-faint" aria-hidden /></Link>)}
          </div>
        </Card>
      </div>
      <div className="mb-4 grid items-start gap-5 xl:grid-cols-[1.3fr_1fr]">
        <CompetitionsSection player={player} schedule={schedule} rankings={rankings} />
        <div className="grid gap-4">
          <LastResultSection game={lastGame(history)} />
          <RecentFormSection games={recentGames(history, GAME_CONFIG.history.recentFormGames)} />
        </div>
      </div>
      <CareerNewsroom />
      <details className="dashboard-disclosure">
        <summary>Rankings & world players</summary>
        <div className="disclosure-body">
          <RankingsSection player={player} ranked={ranked} onSelect={setSelected} />
          <Card><CardTitle>Top players in the world</CardTitle><NpcTable npcs={ranked.slice(0, 5)} showRank onSelect={setSelected} /></Card>
        </div>
      </details>
      <details className="dashboard-disclosure">
        <summary>Wellbeing, titles & news</summary>
        <div className="disclosure-body"><MoraleSection morale={morale} /><TitlesSection titles={titles} /><NewsSection news={news} /></div>
      </details>
      <details className="dashboard-disclosure">
        <summary>Esports & team updates</summary>
        <div className="disclosure-body"><EsportsHomeCard /></div>
      </details>
      <InstallCard />
      <NpcProfileModal npc={selected} onClose={() => setSelected(null)} />
    </>
  );
}
