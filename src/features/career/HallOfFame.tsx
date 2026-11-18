import { Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Card, CardTitle } from "@/components/ui";
import { getCountry } from "@/data/world/countries";
import { allSelectSeries, openChampions } from "@/game/competition/selectTours";
import { useSave } from "@/hooks/useGame";

const openSeries = allSelectSeries().filter(({ type }) => type.id === "open");

export function HallOfFame() {
  const champions = Object.values(openChampions(useSave().competition))
    .sort((a, b) => b.year - a.year || a.winnerName.localeCompare(b.winnerName));

  return (
    <Card data-testid="hall-of-fame">
      <CardTitle>Hall of Fame</CardTitle>
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
  );
}
