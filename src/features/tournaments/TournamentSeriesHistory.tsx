import { useEffect, useMemo, useState } from "react";
import { getCountry } from "@/data/world/countries";
import { eventSeriesKey, eventSeriesName } from "@/game/competition/eventSeries";
import { retainedArchives, type ArchivedEvent } from "@/game/competition/archive";
import { readSeriesArchive, seriesEdition } from "@/store/tournamentArchive";
import { temporaryCareer } from "@/utils/temporaryCareer";
import type { GameSave } from "@/types";

export function TournamentSeriesHistory({ save, name, current }: { save: GameSave; name: string; current?: ArchivedEvent }) {
  const [open, setOpen] = useState(false);
  return <details className="rounded-xl border border-navy-600 p-3" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer font-semibold">Tournament history</summary>
    {open && <SeriesEditions save={save} name={name} current={current} />}
  </details>;
}

function SeriesEditions({ save, name, current }: { save: GameSave; name: string; current?: ArchivedEvent }) {
  const key = eventSeriesKey(name);
  const [archived, setArchived] = useState<Awaited<ReturnType<typeof readSeriesArchive>> | null>(temporaryCareer ? [] : null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (temporaryCareer) return;
    let live = true;
    void readSeriesArchive(save.career.id, key).then(events => {
      if (live) setArchived(events);
    }, () => {
      if (live) { setError(true); setArchived([]); }
    });
    return () => { live = false; };
  }, [key, save.career.id]);

  const editions = useMemo(() => {
    const rows = new Map((archived ?? []).map(event => [event.id, event]));
    for (const event of [...retainedArchives(save), ...(current ? [current] : [])]) {
      if (eventSeriesKey(event.name) === key) rows.set(event.id, seriesEdition(event));
    }
    return [...rows.values()].sort((a, b) => b.year - a.year || b.week - a.week);
  }, [archived, current, key, save]);
  return <div className="mt-3 space-y-2">
    <p className="text-sm text-ink-muted" translate="no">{eventSeriesName(name)}</p>
    {archived === null && <p role="status">Reading past editions…</p>}
    {error && <p role="status">Some archived editions could not be loaded.</p>}
    {archived !== null && !editions.length && <p className="text-sm text-ink-muted">No completed editions recorded in this career yet.</p>}
    {editions.map(edition => <article key={edition.id} className="rounded-lg bg-navy-900 p-3 text-sm">
      <p className="font-semibold">{edition.year} · W{edition.week} · {edition.city ?? "Venue not recorded"}{edition.country ? `, ${getCountry(edition.country)?.name ?? edition.country}` : ""}</p>
      <p>Champion · <span translate="no">{edition.winner ?? "—"}</span></p>
      <p className="text-ink-muted">{edition.fieldSize} entries · {edition.rounds} rounds{edition.playerRank ? ` · Your rank #${edition.playerRank}` : ""}</p>
    </article>)}
  </div>;
}
