import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardTitle } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { useNpcs } from "@/hooks/useNpcs";
import { getCountry } from "@/data/world/countries";
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
export function AnnualTournaments({ history = false }: { history?: boolean }) {
  const save = useSave(),
    npcs = useNpcs(),
    [year, setYear] = useState(save.world.date.year),
    [kind, setKind] = useState("all"),
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
    () => annualEvents(save, selectedYear),
    [selectedYear, save.career.id, save.player.country, save.player.city.name],
  );
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
  const source: Array<{
    id: string;
    name: string;
    kind: "regular" | "national";
    event?: ScheduledEvent;
    record?: ArchivedEvent;
  }> = events.map((event) => {
    const record = records.find((r) => r.id === event.id);
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
  const filtered = source.filter(
    (e) =>
      (kind === "all" || e.kind === kind) &&
      (resultFilter === "all" || !!e.record) &&
      e.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div
      data-testid={history ? "annual-history" : "annual-calendar"}
      className="space-y-4"
    >
      <Card>
        <CardTitle>
          {history
            ? "Tournament history by year"
            : "Annual tournament calendar"}
        </CardTitle>
        <p className="mb-4 text-sm text-ink-muted">
          {history
            ? "Every tournament scheduled in this year, together with recorded results. Events without results stay visible. Future years stay hidden until your career reaches them."
            : "Browse the whole year: tournament names, dates, participant limits, formats and game counts. Click any event for details."}
        </p>
        <p className="mb-4 text-xs text-ink-muted">
          Calendar tournaments are listed first. Extra NPC World Circuit events
          follow.
        </p>
        <div className="flex flex-wrap gap-2">
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
        <p className="mt-3 text-xs text-ink-muted">{filtered.length} events</p>
        {error && (
          <p role="alert" className="mt-3 text-red-300">
            {error}
          </p>
        )}
      </Card>
      {filtered.length ? (
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
                data-event-kind={row.kind}
              >
                <Card>
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
      {filtered.length > limit && (
        <Button variant="secondary" onClick={() => setLimit((n) => n + 20)}>
          Show more events
        </Button>
      )}
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
