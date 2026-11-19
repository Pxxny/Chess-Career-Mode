import { lazy, Suspense, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ChevronDown, Dumbbell, Swords } from "lucide-react";
import { Card, CardTitle } from "@/components/ui";
import { CareerHealthCard } from "@/features/career/CareerHealthCard";
import { SimulateSeason } from "@/features/career/SimulateSeason";
import { eliteLink } from "@/features/elite/ElitePresentation";
import { EsportsHomeCard } from "@/features/esports/EsportsPanel";
import { CompetitionsSection } from "@/features/home/CompetitionsSection";
import { LastResultSection } from "@/features/home/LastResultSection";
import { MoraleSection } from "@/features/home/MoraleSection";
import { NewsSection } from "@/features/home/NewsSection";
import { RankingsSection } from "@/features/home/RankingsSection";
import { RatingsSection } from "@/features/home/RatingsSection";
import { RecentFormSection } from "@/features/home/RecentFormSection";
import { TitlesSection } from "@/features/home/TitlesSection";
import { useDashboard } from "@/features/home/useDashboard";
import { useInstall } from "@/features/install/InstallProvider";
import { InstallSuggestion } from "@/features/install/InstallSuggestion";
import { InstallCard } from "@/features/home/InstallCard";
import { CareerNewsroom } from "@/features/news/CareerNews";
import { SelectTourReward } from "@/features/tournaments/SelectTourReward";
import { NpcProfileModal } from "@/features/world/NpcProfileModal";
import { NpcTable } from "@/features/world/NpcTable";
import { getCareerProgress } from "@/game/career/stages";
import { recoveryDays } from "@/game/career/health";
import { bookedStart, dayLabel } from "@/game/competition/agenda";
import { eligibilityIssues } from "@/game/competition/eligibility";
import { esportsOf } from "@/game/esports/core";
import { lastGame, recentGames } from "@/game/history/stats";
import { registrationStates } from "@/game/match/registration";
import { calendarDate, calendarLabel } from "@/game/qol/career";
import { GAME_CONFIG } from "@/data/config";
import type { Npc } from "@/types";

const EloChart = lazy(() => import("@/features/profile/EloChart").then(module => ({ default: module.EloChart })));

function HomeSection({ title, children }: { title: string; children: ReactNode }) {
  const [opened, setOpened] = useState(false);
  return <details className="home-section group" onToggle={event => {
    if (event.currentTarget.open) setOpened(true);
  }}>
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm font-semibold">
      {title}<ChevronDown aria-hidden size={17} className="shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
    </summary>
    {opened && <div className="space-y-3 p-3">{children}</div>}
  </details>;
}

export function HomePage() {
  const { save, ranked, rankings, titles, morale, schedule, news } = useDashboard();
  const { player, history } = save;
  const { installed } = useInstall();
  const [selected, setSelected] = useState<Npc | null>(null);
  const registration = registrationStates(save)
    .filter(row => row.status !== "missed")
    .sort((a,b) => bookedStart(a) - bookedStart(b))[0];
  const active = save.tournament?.status === "playing" ? save.tournament : null;
  const esports = esportsOf(save).active;
  const resting = recoveryDays(save) > 0;
  const canRecommend = !save.retirement && !active && !registration && esports?.status !== "playing"
    && !resting && !save.pendingMatch;
  const recommended = canRecommend
    ? schedule.find(event => event.weeksUntilStart > 0 && eligibilityIssues(save, event).length === 0)
    : undefined;
  const next = resting ? null
    : active ? { label: "Current tournament", name: active.name, detail: `Round ${active.round} / ${active.rounds}`, to: "/complete", action: "Open current tournament" }
    : esports?.status === "playing" ? { label: "Current tournament", name: esports.event.name, detail: `Round ${esports.round}`, to: "/complete?circuit=esports", action: "Open current tournament" }
    : registration ? { label: "Your next registered tournament", name: registration.name, detail: dayLabel(bookedStart(registration)).slice(0, 10), to: "/complete?section=registrations", action: "View registration" }
    : recommended ? { label: "Next tournament", name: recommended.name, detail: dayLabel(bookedStart(recommended)).slice(0, 10), to: `/complete?event=${encodeURIComponent(recommended.id)}`, action: "View tournament" } : null;

  return <>
    <InstallSuggestion />
    <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <h1 className="workspace-heading">Home Dashboard</h1>
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <CalendarDays size={15} aria-hidden />
        <time dateTime={calendarDate(save).toISOString().slice(0, 10)} data-testid="home-date">
          {calendarLabel(save)} · W{save.world.date.week}
        </time>
      </div>
    </header>
    <CareerHealthCard />
    <div className="mb-3 empty:hidden"><SelectTourReward /></div>
    {next && !save.pendingMatch && <Card className="mb-3 border-gold-500/40" data-testid="home-next-action">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gold-300">{next.label}</p>
          <h2 className="mt-1 break-words text-lg font-bold" translate="no">{next.name}</h2>
          <p className="text-sm text-ink-muted">{next.detail}</p>
        </div>
        <Link to={next.to} className={eliteLink}>{next.action}<ArrowUpRight className="ml-2" size={16} aria-hidden /></Link>
      </div>
    </Card>}

    <div className="mb-4 grid grid-cols-2 gap-2" aria-label="Quick actions">
      {([["/train","Train today",Dumbbell],["/complete","Browse tournaments",Swords]] as const).map(([to,label,Icon]) =>
        <Link key={to} to={to} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-navy-600 bg-navy-800 px-2 text-sm font-semibold hover:text-gold-300">
          <Icon size={17} aria-hidden className="shrink-0 text-gold-300" />{label}
        </Link>)}
    </div>
    <Link to="/profile?tab=stats" data-tour="ratings" data-testid="workspace-dashboard"
      className="mb-4 flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-600 bg-navy-800 px-3 py-2 text-sm hover:border-gold-500/50">
      <span><strong className="text-gold-300">{player.rating.toLocaleString()} Elo</strong><span className="ml-2 text-ink-muted"> · #{rankings.world.rank}</span></span>
      <span className="flex items-center gap-1 text-xs text-ink-muted">Elo analytics <ArrowUpRight size={14} aria-hidden /></span>
    </Link>
    <div className="space-y-2">
      <HomeSection title="Player ratings & recent results">
        <Suspense fallback={<Card aria-busy="true">Loading rating chart…</Card>}><EloChart compact /></Suspense>
        <RatingsSection player={player} rankings={rankings} progress={getCareerProgress(player.rating)} tourAnchor={false} />
        <LastResultSection game={lastGame(history)} />
        <RecentFormSection games={recentGames(history, GAME_CONFIG.history.recentFormGames)} />
      </HomeSection>
      <HomeSection title="Season & competitions">
        <SimulateSeason />
        <div className="flex flex-wrap gap-3 text-sm text-gold-300">
          <Link to="/complete?tab=calendar">Tournament calendar</Link>
          <Link to="/complete?tab=calendar&display=atlas">Tournament atlas</Link>
          <Link to="/career?view=championship">Championship path</Link>
          <Link to="/career?view=plan">Season plan</Link>
          <Link to="/complete?section=match">Matchday</Link>
        </div>
        <CompetitionsSection player={player} schedule={schedule} rankings={rankings} />
        <EsportsHomeCard />
      </HomeSection>
      <HomeSection title="Rankings & world players">
        <RankingsSection player={player} ranked={ranked} onSelect={setSelected} />
        <Card><CardTitle>Top players in the world</CardTitle><NpcTable npcs={ranked.slice(0, 5)} showRank onSelect={setSelected} /></Card>
      </HomeSection>
      <HomeSection title="Career news & wellbeing">
        <CareerNewsroom /><MoraleSection morale={morale} /><TitlesSection titles={titles} /><NewsSection news={news} />
      </HomeSection>
      {!installed && <HomeSection title="Install game"><InstallCard /></HomeSection>}
    </div>
    <NpcProfileModal npc={selected} onClose={() => setSelected(null)} />
  </>;
}
