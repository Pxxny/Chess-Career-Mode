import { CareerHealthCard } from "@/features/career/CareerHealthCard";
import { eliteLink } from "@/features/elite/ElitePresentation";
import { registrationWindow } from "@/game/competition/registrationWindow";
import { CareerNewsroom } from "@/features/news/CareerNews";
import { lazy, Suspense, useContext, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Dumbbell, Swords, TrendingUp, Compass } from "lucide-react";
import { LanguageContext } from "@/i18n/context";
import { SimulateSeason } from "@/features/career/SimulateSeason";
import { InstallSuggestion } from "@/features/install/InstallSuggestion";
import { EsportsHomeCard } from "@/features/esports/EsportsPanel";
import { calendarLabel, calendarDate } from "@/game/qol/career";
import { Card, CardTitle, Avatar } from "@/components/ui";
import { CompetitionsSection } from "@/features/home/CompetitionsSection";
import { SelectTourReward } from "@/features/tournaments/SelectTourReward";
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

const EloChart = lazy(() => import("@/features/profile/EloChart").then(module => ({ default: module.EloChart })));

export function HomePage() {
  useContext(LanguageContext);
  const { save, ranked, rankings, titles, morale, schedule, news } = useDashboard();
  const { player, history } = save;
  const [selected, setSelected] = useState<Npc | null>(null);
  const progress = getCareerProgress(player.rating);
  const nextEvent = schedule.find(event => event.weeksUntilStart > 0 && (!event.details?.nationality || event.details.nationality === player.country));
  return (
    <>
      <InstallSuggestion />
      <CareerHealthCard />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="workspace-heading">Home Dashboard</h1>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <CalendarDays size={15} aria-hidden />
          <time dateTime={calendarDate(save).toISOString().slice(0, 10)} data-testid="home-date">
            {calendarLabel(save)} · W{save.world.date.week}
          </time>
        </div>
      </div>
      <div className="mb-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" data-testid="workspace-dashboard">
        <Card className="flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={player.name} seed={player.avatarSeed} appearance={player.appearance} />
              <div className="min-w-0">
                <h2 className="break-words text-lg font-bold" translate="no">{player.name}</h2>
                <p className="text-xs text-ink-muted">{titles.currentLabel} · {player.city.name}</p>
              </div>
            </div>
            <dl className="divide-y divide-navy-600">
              {([["Current Elo", player.rating.toLocaleString()], ["World ranking", `#${rankings.world.rank}`], ["Peak Elo", player.peakRating.toLocaleString()], ["Rated games", player.ratedGames]] as const).map(([label, value]) =>
                <div key={label} className="flex justify-between gap-3 py-2 text-sm">
                  <dt className="text-ink-muted">{label}</dt><dd className="font-bold tabular-nums text-gold-300">{value}</dd>
                </div>)}
            </dl>
          </div>
          <Link className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-300" to="/profile">View career profile <ArrowUpRight size={15} aria-hidden /></Link>
        </Card>
        <Suspense fallback={<Card aria-busy="true">Loading rating chart…</Card>}><EloChart compact /></Suspense>
      </div>
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Next tournament</CardTitle>
          {nextEvent ? <><p className="text-lg font-bold" translate="no">{nextEvent.name}</p>
            <p className="my-2 text-sm text-ink-muted">{nextEvent.details?.timeControl?.label} · {nextEvent.year} / W{nextEvent.week}
              {nextEvent.details?.prize !== undefined && ` · $${nextEvent.details.prize.toLocaleString()}`}
              {registrationWindow(save, nextEvent).status === "open" && <span> · Registration open</span>}
            </p></> : <p className="mb-3 text-sm text-ink-muted">No upcoming tournament in this schedule.</p>}
          <Link to="/complete?tab=calendar" className={eliteLink}>View tournament schedule</Link>
        </Card>
        <Card>
          <CardTitle>Quick actions</CardTitle>
          <div className="divide-y divide-navy-600">
            {([["/complete?section=match", "Matchday", Swords], ["/complete?tab=calendar&display=atlas", "Tournament atlas", Compass], ["/profile?tab=stats", "Elo analytics", TrendingUp]] as const).map(([to, label, Icon]) =>
              <Link key={to} to={to} className="flex min-h-11 items-center gap-2 py-2 text-sm font-semibold hover:text-gold-300"><Icon size={16} aria-hidden className="text-gold-300" />{label}</Link>)}
          </div>
        </Card>
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
      <div className="mb-4 empty:hidden"><SelectTourReward /></div>
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
