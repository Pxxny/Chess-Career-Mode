import { divisionFixture } from "@/game/competition/divisionLeague";
import { esportsEvents } from "@/game/esports/catalog";
import { Link, useSearchParams } from "react-router-dom";
import { globalQualificationCalendar } from '@/game/competition/qualificationCircuit';
import { eventAccent } from "@/game/competition/visuals";
import { isBackgroundCircuit, matchesOrganizer, type TournamentSearch } from "@/game/competition/finder";
import { TOURNAMENT_CONTINENTS, matchesVenueContinent } from "@/game/competition/venues";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Button, Card, CardTitle } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { useNpcs } from "@/hooks/useNpcs";
import { COUNTRIES, getCountry } from "@/data/world/countries";
import { getSchedule, type ScheduledEvent } from "@/game/world/schedule";
import {
  archiveTournament,
  legacyEventSummaries,
  eventKind,
  historyYears,
  retainedArchives,
  type ArchivedEvent,
} from "@/game/competition/archive";
import {
  readEventArchive,
  writeMissingEventArchive,
} from "@/store/tournamentArchive";
import {
  dayLabel,
  bookedStart,
  bookedEnd,
  gameDay,
  maximumPlayerGames,
} from "@/game/competition/agenda";
import { TournamentDetail } from "./TournamentDetail";
import { annualEvents } from "@/game/competition/worldCalendar";
const TournamentAtlas = lazy(() => import("./TournamentAtlas"));
const SeasonCalendar = lazy(() => import("./SeasonCalendar"));
export function AnnualTournaments({ history = false, popularity = false }: { history?: boolean; popularity?: boolean }) {
  const [params] = useSearchParams();
  const [atlasView, setAtlasView] = useState(() => !history && params.get("display") === "atlas");
  useEffect(() => setAtlasView(!history && params.get("display") === "atlas"), [history, params]);
  const [calendarView, setCalendarView] = useState(() => !history && params.get("tab") === "calendar");
  const [qualifierCountry,setQualifierCountry]=useState('all'),[qualifierStage,setQualifierStage]=useState('all');
  const [showBackground,setShowBackground]=useState(false),[organizer,setOrganizer]=useState<TournamentSearch["organizer"]>("all");
  const save = useSave(),
    npcs = useNpcs(),
    [year, setYear] = useState(save.world.date.year),
    [kind, setKind] = useState("all"),
    [continent, setContinent] = useState("all"),
    [resultFilter, setResultFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [limit, setLimit] = useState(20),
    [stored, setStored] = useState<ArchivedEvent[]>([]),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<{
      event?: ScheduledEvent;
      record?: ArchivedEvent;
    } | null>(null);
  const years = historyYears(save),
    selectedYear = years.includes(year) ? year : save.world.date.year;
  useEffect(() => {
    let current = true;
    setStored([]);
    setError("");
    void readEventArchive(save.career.id, selectedYear)
      .then(async (rows) => {
        if (!current) return;
        const ids = new Set(rows.map((e) => e.id));
        const legacy = legacyEventSummaries(save, npcs, selectedYear).filter(
          (e) => !ids.has(e.id),
        );
        setStored([...legacy, ...rows]);
        if (legacy.length)
          await writeMissingEventArchive(save.career.id, legacy);
      })
      .catch(() => {
        if (current)
          setError(
            "The tournament archive could not be read. Retained save data is still shown.",
          );
      });
    return () => {
      current = false;
    };
  }, [save.career.id, selectedYear, save.tournamentArchivePending, npcs]);
  const events = useMemo(
    () => [...new Map([...globalQualificationCalendar(selectedYear),...annualEvents(save, selectedYear)].map(e=>[e.id,e])).values()],
    [selectedYear, save.career.id, save.player.country, save.player.city.name, save.hostedEvents],
  );
  const popularityEvents = useMemo(() => {
    if (!popularity) return events;
    const byId = new Map(events.map(event => [event.id, event]));
    for (const booking of save.registrations) {
      if (booking.year !== selectedYear || byId.has(booking.eventId)) continue;
      byId.set(booking.eventId, {
        ...booking, id: booking.eventId, minElo: booking.minElo ?? 0,
        minReputation: booking.minReputation ?? 0, invitational: false,
        registrationDeadline: { year: booking.year, week: booking.week - 1 },
        weeksUntilStart: 0, weeksUntilDeadline: 0,
      });
    }
    if (selectedYear === save.world.date.year) {
      for (const playoff of [false, true]) {
        const fixture = divisionFixture(save, npcs, playoff);
        if (fixture) byId.set(fixture.id, byId.get(fixture.id) ?? fixture);
      }
    }
    return [...byId.values()];
  }, [events, npcs, popularity, save, selectedYear]);
  const records = useMemo(() => {
    const map = new Map(stored.map((e) => [e.id, e]));
    for (const e of retainedArchives(save))
      if (e.year === selectedYear) map.set(e.id, e);
    return [...map.values()].sort(
      (a, b) => b.startDay - a.startDay || a.name.localeCompare(b.name),
    );
  }, [
    stored,
    npcs,
    save.tournamentArchivePending,
    save.history.tournaments,
    save.competition?.archive,
    save.expansion?.cups,
    save.tournament?.status,
    save.tournament?.eventId,
    selectedYear,
  ]);
  const recordById=new Map(records.map(r=>[r.id,r]));
  const source: Array<{
    id: string;
    name: string;
    kind: "regular" | "national";
    event?: ScheduledEvent;
    record?: ArchivedEvent;
  }> = popularityEvents.map((event) => {
    const record = recordById.get(event.id);
    return {
      id: event.id,
      name: record?.name ?? event.name,
      kind: record?.kind ?? eventKind(event),
      event,
      record,
    };
  });
  {
    const ids = new Set(source.map((e) => e.id));
    for (const record of records)
      if (!ids.has(record.id))
        source.push({
          id: record.id,
          name: record.name,
          kind: record.kind,
          record,
        });
    source.sort((a, b) => {
      // Hundreds of supplementary circuit groups must not bury the actual annual catalogue.
      const circuit =
        Number(a.record?.source === "world-circuit") -
        Number(b.record?.source === "world-circuit");
      if (circuit) return circuit;
      // Completed results first in history; every other scheduled event remains accessible.
      if (history && !!a.record !== !!b.record) return a.record ? -1 : 1;
      return (
        (a.record?.startDay ?? bookedStart(a.event!)) -
          (b.record?.startDay ?? bookedStart(b.event!)) ||
        a.name.localeCompare(b.name)
      );
    });
  }
  const rankings = (() => {
    if (!popularity) return [];
    const active = new Map((save.calendarTournaments?.active ?? []).map(t => [t.eventId, t.players.length]));
    for (const row of save.calendarTournaments?.national ?? []) active.set(row.event.id, row.teams.length);
    if (save.tournament) active.set(save.tournament.eventId, save.tournament.team?.teams.length ?? save.tournament.players.length);
    const start = selectedYear * 364;
    const esports = new Map(esportsEvents(start, save.career.id, 363).map(event => [event.id, { event, teams: undefined as number | undefined }]));
    for (const entry of save.esports?.entries ?? []) {
      if (entry.event.day >= start && entry.event.day < start + 364)
        esports.set(entry.event.id, { event: entry.event, teams: undefined });
    }
    for (const result of [...(save.esports?.history ?? []), ...(save.esports?.active ? [save.esports.active] : [])]) {
      if (result.event.day >= start && result.event.day < start + 364)
        esports.set(result.event.id, { event: result.event, teams: result.teams.length });
    }
    const rows = source.map(row => {
      const actual = row.record?.fieldSize ?? active.get(row.id);
      return { ...row, entrants: actual ?? row.event?.fieldSize ?? 0, actual: actual !== undefined,
        unit: row.kind === "national" ? "teams" : "players", start: row.record?.startDay ?? bookedStart(row.event!),
        prestige: row.event?.details?.prestige ?? 0, esports: false };
    });
    for (const { event, teams } of esports.values()) {
      rows.push({ id: event.id, name: event.name, kind: "regular",
        entrants: teams ?? 4, actual: teams !== undefined, unit: "teams", start: event.day,
        prestige: 0, esports: true });
    }
    return rows.sort((a, b) => b.entrants - a.entrants || b.prestige - a.prestige ||
      a.start - b.start || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  })();
  const rankedMatches = rankings.map((row, index) => ({ ...row, rank: index + 1 }))
    .filter(row => row.name.toLowerCase().includes(query.trim().toLowerCase()));
  const filtered = source.filter(
    (e) =>
      (qualifierCountry==='all'||e.event?.details?.qualificationCircuit?.country===qualifierCountry) &&
      (qualifierStage==='all'||e.event?.details?.qualificationCircuit?.stage===qualifierStage) &&
      (showBackground||!isBackgroundCircuit(e.record)) &&
      (organizer==='all'||!!e.event&&matchesOrganizer(e.event,organizer)) &&
      (kind === "all" || e.kind === kind) &&
      matchesVenueContinent(e.record?.country ?? e.event?.details?.country, continent) &&
      (resultFilter === "all" || !!e.record) &&
      e.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div
      data-testid={history ? "annual-history" : "annual-calendar"}
      className="space-y-4"
    >
      {popularity ? <>
        <Card>
          <CardTitle>Tournament popularity</CardTitle>
          <p className="mb-3 text-sm text-ink-muted">Ranked by field size. Uses recorded turnout when available and scheduled capacity otherwise. Ties use prestige, then start date.</p>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Tournament year" className="rounded-lg bg-navy-900 p-3" value={selectedYear}
              onChange={e => { setYear(Number(e.target.value)); setLimit(20); }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <input aria-label="Search tournament popularity" className="min-w-0 flex-1 rounded-lg bg-navy-900 p-3"
              placeholder="Search tournaments…" value={query} onChange={e => { setQuery(e.target.value); setLimit(20); }} />
          </div>
          {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
          <p className="mt-3 text-xs text-ink-muted">{rankedMatches.length} tournaments</p>
        </Card>
        <ol className="divide-y divide-navy-600 rounded-xl bg-navy-800 px-4" aria-label="Tournament popularity ranking">
          {rankedMatches.slice(0, limit).map(row => (
            <li key={row.id} value={row.rank} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 py-3">
              <strong className={row.rank <= 3 ? "text-gold-300" : "text-ink-muted"}>#{row.rank}</strong>
              <div className="min-w-0">
                {row.esports
                  ? <Link className="break-words font-semibold" to="/complete?circuit=esports">{row.name}</Link>
                  : <button type="button" className="break-words text-left font-semibold" onClick={() => setSelected(row)}>{row.name}</button>}
                <p className="text-xs text-ink-muted">{row.entrants.toLocaleString()} {row.unit} · {row.actual ? "Recorded entrants" : "Scheduled capacity"} · {dayLabel(row.start).slice(0, 10)}</p>
              </div>
            </li>
          ))}
        </ol>
        {!rankedMatches.length && <Card>No tournaments match this search.</Card>}
        {rankedMatches.length > limit && <Button variant="secondary" onClick={() => setLimit(n => n + 50)}>Show more tournaments</Button>}
      </> : <>
      <Card>
        <CardTitle>
          {history
            ? "Tournament history by year"
            : "Annual tournament calendar"}
        </CardTitle>
        {!atlasView && <>
        <p className="mb-4 text-sm text-ink-muted">
          {history
            ? "Every tournament scheduled in this year, together with recorded results. Events without results stay visible. Future years stay hidden until your career reaches them."
            : "Browse the whole year: tournament names, dates, participant limits, formats and game counts. Click any event for details."}
        </p>
        <p className="mb-4 text-xs text-ink-muted">
          Calendar events are open to eligible players and NPCs. Background NPC-only circuit results are hidden unless enabled.
        </p>
        </>}
        <details key={atlasView ? "atlas" : "calendar"} open={!atlasView || undefined}>
          <summary className="mb-2 cursor-pointer text-sm font-semibold text-ink-muted">Filters</summary>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showBackground} onChange={e=>{setShowBackground(e.target.checked);setLimit(20);}}/>Show NPC-only background events</label>
          <select aria-label="Annual tournament organizer" value={organizer??'all'} onChange={e=>{setOrganizer(e.target.value as TournamentSearch['organizer']);setLimit(20);}} className="max-w-full rounded-lg bg-navy-900 p-3"><option value="all">All organizers</option><option>Official</option><option>Unofficial</option><option value="Sponsor">Sponsor-hosted</option></select>
          <select
            aria-label="Tournament year"
            className="rounded-lg bg-navy-900 p-3"
            value={selectedYear}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setLimit(20);
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select aria-label="Qualification country" value={qualifierCountry} onChange={e=>{setQualifierCountry(e.target.value);setLimit(20);}} className="max-w-full rounded-lg bg-navy-900 p-3"><option value="all">All qualification countries</option>{COUNTRIES.filter(c=>c.capital&&c.continent!=='Antarctica').map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select>
          <select aria-label="Qualification stage" value={qualifierStage} onChange={e=>{setQualifierStage(e.target.value);setLimit(20);}} className="max-w-full rounded-lg bg-navy-900 p-3"><option value="all">All qualification stages</option>{['local','national','continental','world'].map(stage=><option key={stage} value={stage}>{stage}</option>)}</select>
          <select data-testid="annual-continent-filter" aria-label="Annual tournament continent" value={continent} onChange={(e) => { setContinent(e.target.value); setLimit(20); }} className="max-w-full rounded-lg bg-navy-900 p-3">
            <option value="all">All continents</option>
            {TOURNAMENT_CONTINENTS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            aria-label="Annual tournament category"
            className="rounded-lg bg-navy-900 p-3"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setLimit(20);
            }}
          >
            <option value="all">All categories</option>
            <option value="regular">Regular tournaments</option>
            <option value="national">National teams</option>
          </select>
          {history && (
            <select
              aria-label="Tournament results filter"
              className="rounded-lg bg-navy-900 p-3"
              value={resultFilter}
              onChange={(e) => {
                setResultFilter(e.target.value);
                setLimit(20);
              }}
            >
              <option value="all">All tournaments this year</option>
              <option value="recorded">Recorded results only</option>
            </select>
          )}
        </div>
        </details>
        <div className="mt-3 flex">
          <input
            aria-label="Search annual tournaments"
            className="min-w-0 flex-1 rounded-lg bg-navy-900 p-3"
            placeholder="Search tournaments…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(20);
            }}
          />
        </div>
        <div role="group" aria-label="Calendar display" className="mt-4 flex flex-wrap gap-2">
          <Button variant={!atlasView && !calendarView ? "primary" : "secondary"} aria-pressed={!atlasView && !calendarView} onClick={() => { setAtlasView(false); setCalendarView(false); }}>List view</Button>
          <Button variant={!atlasView && calendarView ? "primary" : "secondary"} aria-pressed={!atlasView && calendarView} onClick={() => { setAtlasView(false); setCalendarView(true); }}>Calendar view</Button>
          {!history && <Button variant={atlasView ? "primary" : "secondary"} aria-pressed={atlasView} onClick={() => setAtlasView(true)}>Tournament atlas</Button>}
        </div>
        <p className="mt-3 text-xs text-ink-muted">{filtered.length} events</p>
        {error && (
          <p role="alert" className="mt-3 text-red-300">
            {error}
          </p>
        )}
      </Card>
      {atlasView ? <Suspense fallback={<Card>Drawing the game map…</Card>}>
        <TournamentAtlas events={filtered.flatMap(row => row.event ? [row.event] : [])}
          onDetails={event => setSelected({ event, record: recordById.get(event.id) })} />
      </Suspense> : calendarView ? <Suspense fallback={<Card>Loading calendar…</Card>}><SeasonCalendar year={selectedYear}
        events={filtered.map((r) => ({ id: r.id, name: r.name, start: r.record?.startDay ?? bookedStart(r.event!), end: r.record?.endDay ?? bookedEnd(r.event!), details:r.event?.details, level:r.event?.level, event:r.event }))}
        onSelect={(id) => { const row = filtered.find((r) => r.id === id); if (row) setSelected({ event: row.event, record: row.record }); }} /></Suspense> : filtered.length ? (
        <ul className="space-y-3">
          {filtered.slice(0, limit).map((row) => {
            const { event: e, record: r } = row,
              live =
                (save.tournament?.eventId === row.id &&
                  save.tournament.status === "playing") ||
                save.calendarTournaments?.active.some(
                  (t) => t.eventId === row.id,
                ) ||
                save.calendarTournaments?.national.some(
                  (n) => n.event.id === row.id,
                ),
              start = r?.startDay ?? bookedStart(e!),
              end = r?.endDay ?? bookedEnd(e!),
              status = live
                ? "In progress"
                : r
                  ? "Completed"
                  : gameDay(save) < start
                    ? "Upcoming"
                    : gameDay(save) <= end
                      ? "Event dates in progress"
                      : "Date passed · no recorded result";
            return (
              <li
                key={row.id}
                data-annual-event={row.id}
                data-host-country={r?.country ?? e?.details?.country ?? ""}
                data-host-continent={getCountry(r?.country ?? e?.details?.country ?? "")?.continent ?? ""}
                data-event-kind={row.kind}
              >
                <Card style={{borderLeft:`4px solid ${eventAccent(e?.details,e?.level).color}`}}>
                  <Button
                    variant="secondary"
                    className="max-w-full text-left"
                    onClick={() => setSelected({ event: e, record: r })}
                  >
                    <span translate="no">{row.name}</span>
                  </Button>
                  <p className="mt-2 text-sm text-gold-300">{status}</p>
                  <p className="mt-2 text-xs text-ink-muted">
                    {r?.datePrecision === "week"
                      ? `Year ${r.year}, week ${r.week}`
                      : `${dayLabel(start).slice(0, 10)} – ${dayLabel(end).slice(0, 10)}`}
                  </p>
                  <p className="mt-1 text-sm">
                    {row.kind === "national"
                      ? "National teams"
                      : "Regular tournaments"}{" "}
                    · {r?.fieldSize ?? e!.fieldSize}{" "}
                    {row.kind === "national" ? "teams" : "players"}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {r?.format ?? e?.details?.format} ·{" "}
                    {r ? r.rounds || "Not recorded" : maximumPlayerGames(e!)}{" "}
                    {r ? "rounds" : "max games per player"}
                  </p>
                  {!r && gameDay(save) > end && (
                    <p className="mt-2 text-xs text-ink-muted">
                      This event has no saved results. Older missing results
                      cannot be reconstructed.
                    </p>
                  )}
                  <Button
                    className="mt-3"
                    onClick={() => setSelected({ event: e, record: r })}
                  >
                    {live ? "Open tournament / watch games" : "View tournament"}
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <p>
            {history
              ? "No tournament results recorded for this year."
              : "No tournaments match these filters."}
          </p>
        </Card>
      )}
      {!atlasView && !calendarView && filtered.length > limit && (
        <Button variant="secondary" onClick={() => setLimit((n) => n + 20)}>
          Show more events
        </Button>
      )}
      </>}
      {selected && (
        <TournamentDetail
          key={selected.event?.id ?? selected.record!.id}
          event={selected.event}
          record={
            records.find(
              (r) => r.id === (selected.event?.id ?? selected.record?.id),
            ) ?? selected.record
          }
          tournament={
            save.tournament?.eventId ===
            (selected.event?.id ?? selected.record?.id)
              ? (save.tournament ?? undefined)
              : undefined
          }
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
