import { RetirementPanel } from "./RetirementPanel";
import { EliteHero, EliteStats } from "@/features/elite/ElitePresentation";
import { buildTimeline, buildMilestones } from "@/game/career/overview";
import { TrophiesTab } from "@/features/profile/tabs/TrophiesTab";
import { Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Card, CardTitle } from "@/components/ui";
import { getCountry } from "@/data/world/countries";
import { allSelectSeries, openChampions } from "@/game/competition/selectTours";
import { useSave } from "@/hooks/useGame";

const openSeries = allSelectSeries().filter(({ type }) => type.id === "open");

export function HallOfFame() {
  const save = useSave();
  const timeline = buildTimeline(save);
  const milestones = buildMilestones(save).filter(item => item.achieved);
  const champions = Object.values(openChampions(save.competition))
    .sort((a, b) => b.year - a.year || a.winnerName.localeCompare(b.winnerName));

  return (
    <div className="space-y-4">
      <EliteHero title={save.player.name} label="Hall of Fame · Chess legacy" artwork={<Trophy size={48} className="text-gold-300" aria-hidden />}>
        <p className="text-sm text-ink-muted">{save.career.startYear} – {save.retirement?.year ?? save.world.date.year}</p>
      </EliteHero>
      <EliteStats items={[["Career titles", save.history.titles.length], ["Tournament wins", save.history.tournaments.filter(event => event.rank === 1).length], ["Peak Elo", save.player.peakRating], ["Rated games", save.player.ratedGames]]} />
    <Card data-testid="hall-of-fame">
      <CardTitle>World Finals champions</CardTitle>
      <p className="mb-4 text-sm text-ink-muted">Men’s Open World Finals champions in this career.</p>
      <div className="grid gap-4 xl:grid-cols-2">
        {openSeries.map(({ id, name }) => {
          const winners = champions.filter((winner) => winner.seriesId === id);
          return (
            <section key={id} className="min-w-0 rounded-2xl border border-white/10 bg-navy-900/60 p-4">
              <div className="flex items-start gap-3">
                <Trophy size={21} aria-hidden className="mt-1 shrink-0 text-gold-300" />
                <div>
                  <h3 translate="no" className="font-semibold">{name}</h3>
                  <p className="text-xs text-ink-muted">World Finals</p>
                </div>
              </div>
              {winners.length ? (
                <ul className="mt-4 divide-y divide-white/10">
                  {winners.map((winner) => (
                    <li key={winner.finalId} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 py-3">
                      <time dateTime={String(winner.year)} className="text-sm font-semibold text-gold-300">{winner.year}</time>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span translate="no" className="break-words font-semibold">{winner.winnerName}</span>
                          {winner.by === "player" && <Badge>Your champion</Badge>}
                        </div>
                        <p translate="no" className="text-xs text-ink-muted">{getCountry(winner.country)?.name ?? winner.country}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-ink-muted">No champions recorded yet.</p>
              )}
            </section>
          );
        })}
      </div>
      <Link to="/career?view=championship" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-gold-300 underline">Championship path</Link>
    </Card>
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Card>
        <CardTitle>Legacy timeline</CardTitle>
        <ol className="max-h-96 space-y-3 overflow-y-auto border-l border-navy-600 pl-4">
          {[...timeline].reverse().map(item => <li key={item.id}>
            <p className="text-xs font-semibold text-gold-300">{item.year} / W{item.week}</p>
            <strong>{item.label}</strong>
            {item.detail && <p className="text-xs text-ink-muted">{item.detail}</p>}
          </li>)}
        </ol>
      </Card>
      <Card>
        <CardTitle>Career milestones</CardTitle>
        {milestones.length ? <ul className="space-y-2">{milestones.map(item => <li key={item.id} className="text-sm">{item.label} · {item.progressText}</li>)}</ul> :
          <p className="text-sm text-ink-muted">No career milestones reached yet.</p>}
        <Link to="/profile?tab=stats" className="mt-3 inline-flex min-h-11 items-center text-sm text-gold-300 underline">Career records</Link>
      </Card>
    </div>
    <RetirementPanel />
    <TrophiesTab />
    </div>
  );
}
