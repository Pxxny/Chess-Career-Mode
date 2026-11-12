import { SeasonPlan } from "@/features/career/SeasonPlan";
import { ChampionshipPath } from "@/features/career/ChampionshipPath";
import { PeopleStories } from "@/features/career/PeopleStories";
import { CareerBusiness } from "@/features/career/CareerBusiness";
import { BackupPanel } from "@/features/career/BackupPanel";
import { YearReviews } from "@/features/career/YearReviews";
import { useSearchParams } from "react-router-dom";
import { PredictionStatistics } from "@/features/prediction/PredictionStatistics";
import { Check } from "lucide-react";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  PageHeader,
  ProgressBar,
  Tabs,
} from "@/components/ui";
import { CareerLadder } from "@/features/career/CareerLadder";
import { TROPHY_CATEGORIES } from "@/features/profile/tabs/TrophiesTab";
import {
  buildFinance,
  buildMilestones,
  buildTimeline,
  reputationStatus,
} from "@/game/career/overview";
import { getCareerProgress } from "@/game/career/stages";
import { newestFirst } from "@/game/history/createHistory";
import { computeStats, findRivals } from "@/game/history/stats";
import { useSave } from "@/hooks/useGame";
import { cn } from "@/utils/cn";
import { formatMoney, formatNumber } from "@/utils/format";

export function CareerPage() {
  const [params, setParams] = useSearchParams();
  const availableViews = [
    "overview",
    "plan",
    "championship",
    "people",
    "business",
    "predictions",
    "years",
  ] as const;
  const view =
    availableViews.find((v) => v === params.get("view")) ?? "overview";
  const save = useSave();
  const { player, world, history } = save;
  const { date } = world;
  const progress = getCareerProgress(player.rating);
  const timeline = buildTimeline(save);
  const milestones = buildMilestones(save);
  const finance = buildFinance(save);
  const reputation = reputationStatus(player.reputation);
  const rivals = findRivals(history);
  const stats = computeStats(history);
  const achievementCount = history.trophies.length;
  const latestAchievements = [...history.trophies]
    .reverse()
    .sort(newestFirst)
    .slice(0, 3);
  const yearsPlayed = date.year - player.careerStartYear + (date.week - 1) / 52;

  const careerStats: Array<[string, string]> = [
    ["Rated games", formatNumber(player.ratedGames)],
    [
      "Record",
      stats.total.games
        ? `${stats.total.wins}W ${stats.total.draws}D ${stats.total.losses}L`
        : "No games",
    ],
    [
      "Score rate",
      stats.total.winRate === null ? "–" : `${stats.total.winRate}%`,
    ],
    ["Tournaments played", String(history.tournaments.length)],
    [
      "Tournaments won",
      String(history.tournaments.filter((t) => t.rank === 1).length),
    ],
    ["Years in career", yearsPlayed.toFixed(1)],
    ["Peak Elo", formatNumber(player.peakRating)],
    ["Trophies", String(achievementCount)],
  ];

  return (
    <>
      <PageHeader
        title="Career"
        description={`Year ${date.year}, week ${date.week}. Every title on the road to World Champion.`}
      />

      <BackupPanel />
      <Tabs
        label="Career sections"
        active={view}
        onChange={(v) => setParams(v === "overview" ? {} : { view: v })}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "plan", label: "Season plan" },
          { id: "championship", label: "Championship path" },
          { id: "people", label: "People & stories" },
          { id: "business", label: "Sponsors & legacy" },
          { id: "predictions", label: "Match predictions" },
          { id: "years", label: "Year in review" },
        ]}
      >
        {view === "plan" ? (
          <SeasonPlan />
        ) : view === "championship" ? (
          <ChampionshipPath />
        ) : view === "people" ? (
          <PeopleStories />
        ) : view === "business" ? (
          <CareerBusiness />
        ) : view === "predictions" ? (
          <PredictionStatistics />
        ) : view === "years" ? (
          <YearReviews />
        ) : (
          <>
            <Card className="mb-4">
              <p className="text-sm text-ink-muted">Current stage</p>
              <p className="mt-1 font-display text-2xl font-bold text-gold-400">
                {progress.current.title}
              </p>
              <div className="mt-4">
                <ProgressBar
                  value={progress.percent}
                  label="Progress to next career stage"
                />
                <p className="mt-2 text-sm text-ink-muted">
                  {progress.next
                    ? `Next: ${progress.next.title} at ${progress.next.minRating}`
                    : "Top of the ladder"}
                </p>
              </div>
            </Card>

            <Card className="mb-4">
              <CardTitle>Career statistics</CardTitle>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {careerStats.map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-navy-700/60 p-3">
                    <dt className="text-xs text-ink-muted">{label}</dt>
                    <dd className="mt-1 font-display text-lg font-bold tabular-nums text-ink">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card className="mb-4">
              <CardTitle>Career timeline</CardTitle>
              <ol className="relative ml-2 border-l border-white/10">
                {[...timeline].reverse().map((event) => (
                  <li key={event.id} className="mb-4 ml-4 last:mb-0">
                    <span
                      aria-hidden
                      className={cn(
                        "absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full",
                        event.kind === "start"
                          ? "bg-gold-500"
                          : "bg-navy-600 ring-2 ring-gold-500/60",
                      )}
                    />
                    <p className="font-semibold text-ink">{event.label}</p>
                    {event.detail && (
                      <p className="text-sm text-ink-muted">{event.detail}</p>
                    )}
                    <p className="text-xs text-ink-faint">
                      Year {event.year}, week {event.week}
                    </p>
                  </li>
                ))}
              </ol>
            </Card>

            <Card className="mb-4">
              <CardTitle
                aside={
                  <Badge tone="gold">
                    {milestones.filter((m) => m.achieved).length}/
                    {milestones.length}
                  </Badge>
                }
              >
                Career milestones
              </CardTitle>
              <ul className="divide-y divide-white/5">
                {milestones.map((m) => (
                  <li key={m.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={cn(
                          "flex items-center gap-2 text-sm font-semibold",
                          m.achieved ? "text-ink" : "text-ink-muted",
                        )}
                      >
                        {m.achieved && (
                          <Check
                            size={14}
                            aria-hidden
                            className="text-emerald-300"
                          />
                        )}
                        {m.label}
                      </span>
                      <span className="text-xs tabular-nums text-ink-faint">
                        {m.progressText}
                      </span>
                    </div>
                    {!m.achieved && (
                      <div className="mt-1.5">
                        <ProgressBar value={m.progress} label={m.label} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="mb-4">
              <CardTitle
                aside={
                  <span className="text-sm tabular-nums text-ink-muted">
                    {achievementCount} total
                  </span>
                }
              >
                Achievements
              </CardTitle>
              {latestAchievements.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No achievements yet. They are earned by playing and appear
                  here and in your profile.
                </p>
              ) : (
                <ul className="mb-3 divide-y divide-white/5">
                  {latestAchievements.map((t) => (
                    <li key={t.id} className="py-2">
                      <p className="font-semibold text-ink">{t.name}</p>
                      <p className="text-sm text-ink-muted">{t.description}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {TROPHY_CATEGORIES.map((c) => (
                  <Badge key={c.id}>
                    {c.label}:{" "}
                    {history.trophies.filter((t) => t.category === c.id).length}
                  </Badge>
                ))}
              </div>
            </Card>

            <Card className="mb-4">
              <CardTitle>Financial overview</CardTitle>
              <dl className="grid grid-cols-3 gap-3">
                {[
                  ["Balance", formatMoney(finance.balance)],
                  ["Total income", formatMoney(finance.income)],
                  ["Total expenses", formatMoney(finance.expenses)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-navy-700/60 p-3">
                    <dt className="text-xs text-ink-muted">{label}</dt>
                    <dd className="mt-1 font-display text-lg font-bold tabular-nums text-ink">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              {finance.bestPrize && (
                <p className="mt-3 text-sm text-ink-muted">
                  Biggest prize: {formatMoney(finance.bestPrize.amount)} (
                  {finance.bestPrize.label.replace("Prize: ", "")})
                </p>
              )}
              {finance.recent.length === 0 ? (
                <p className="mt-3 text-sm text-ink-muted">
                  No income or expenses recorded yet. Prize money and fees will
                  be listed here.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-white/5">
                  {finance.recent.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <span className="text-ink">{e.label}</span>
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          e.amount >= 0 ? "text-emerald-300" : "text-red-300",
                        )}
                      >
                        {e.amount >= 0 ? "+" : "-"}
                        {formatMoney(Math.abs(e.amount))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="mb-4">
              <CardTitle aside={<Badge tone="gold">{reputation.label}</Badge>}>
                Career reputation
              </CardTitle>
              <p className="font-display text-3xl font-bold tabular-nums text-ink">
                {formatNumber(player.reputation)}
              </p>
              <div className="mt-3">
                <ProgressBar
                  value={reputation.percent}
                  label="Progress to next reputation level"
                />
                <p className="mt-2 text-sm text-ink-muted">
                  {reputation.next
                    ? `${reputation.next.min - player.reputation} more to become a ${reputation.next.label.toLowerCase()}.`
                    : "You have the highest reputation level."}
                </p>
              </div>
            </Card>

            <Card className="mb-4">
              <CardTitle>Important rivals</CardTitle>
              {rivals.length === 0 ? (
                <EmptyState
                  title="No rivals yet"
                  description="Opponents you meet at least twice become rivals."
                />
              ) : (
                <ul className="divide-y divide-white/5">
                  {rivals.map((r) => (
                    <li
                      key={r.key}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{r.name}</p>
                        <p className="text-xs text-ink-muted">Elo {r.elo}</p>
                      </div>
                      <p className="shrink-0 text-sm tabular-nums text-ink-muted">
                        {r.record.wins}W {r.record.draws}D {r.record.losses}L
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardTitle>Career ladder</CardTitle>
              <CareerLadder currentId={progress.current.id} />
            </Card>
          </>
        )}
      </Tabs>
    </>
  );
}
