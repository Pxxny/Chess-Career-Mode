import { ResultBadge } from "@/components/game/ResultBadge";
import { EmptyState } from "@/components/ui";
import { OpeningReport } from "@/features/history/OpeningReport";
import { Replay } from "@/features/match/MatchHistory";
import { useMatchRecords } from "@/hooks/useMatchRecords";
import { useSave } from "@/hooks/useGame";
import {
  dedupeRows,
  indexRowsFromEvent,
  indexRowsFromMatch,
  outcomeOfScore,
  pageOf,
  rowMatches,
  sortRows,
  summarizeRows,
  type HistoryFilter,
  type HistoryOutcome,
  type MatchIndexRow,
} from "@/game/history/matchLedger";
import { ensureMatchIndex, readEventIndex, readNpcIndex } from "@/store/matchIndex";
import type { MatchRecord } from "@/types";
import { useEffect, useMemo, useState } from "react";

const PAGE = 50;
const pct = (value: number | null) =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;

function Filters({
  filter,
  times,
  years,
  onChange,
}: {
  filter: HistoryFilter;
  times: string[];
  years: number[];
  onChange: (next: HistoryFilter) => void;
}) {
  const set = (patch: HistoryFilter) => onChange({ ...filter, ...patch });
  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-2">
      <input
        type="search"
        aria-label="Search matches"
        placeholder="Opponent, event or year"
        value={filter.query ?? ""}
        onChange={(e) => set({ query: e.target.value })}
        className="rounded-lg bg-navy-900 p-3 sm:col-span-2"
      />
      <select
        aria-label="Result"
        value={filter.outcome ?? "all"}
        onChange={(e) =>
          set({ outcome: e.target.value as HistoryOutcome | "all" })
        }
        className="rounded-lg bg-navy-900 p-3"
      >
        <option value="all">All results</option>
        <option value="win">Wins</option>
        <option value="draw">Draws</option>
        <option value="loss">Losses</option>
      </select>
      <select
        aria-label="Time control"
        value={filter.timeControl ?? "all"}
        onChange={(e) => set({ timeControl: e.target.value })}
        className="rounded-lg bg-navy-900 p-3"
      >
        <option value="all">All time controls</option>
        {times.map((time) => (
          <option key={time} value={time}>
            {time}
          </option>
        ))}
      </select>
      <select
        aria-label="Color"
        value={filter.color ?? "all"}
        onChange={(e) =>
          set({ color: e.target.value as HistoryFilter["color"] })
        }
        className="rounded-lg bg-navy-900 p-3"
      >
        <option value="all">White and black</option>
        <option value="white">White</option>
        <option value="black">Black</option>
      </select>
      <select
        aria-label="Year"
        value={filter.year ?? "all"}
        onChange={(e) =>
          set({
            year: e.target.value === "all" ? undefined : Number(e.target.value),
          })
        }
        className="rounded-lg bg-navy-900 p-3"
      >
        <option value="all">All years</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}

function MatchRows({
  rows,
  onOpen,
}: {
  rows: readonly MatchIndexRow[];
  onOpen: (row: MatchIndexRow) => void;
}) {
  const [page, setPage] = useState(0);
  const shown = pageOf(rows, page, PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  if (!rows.length)
    return (
      <EmptyState title="No matches" description="Nothing in the current filter." />
    );
  return (
    <div>
      <ul className="divide-y divide-white/[0.06]" data-testid="npc-match-history">
        {shown.map((row) => {
          const elo =
            row.eloBefore !== undefined && row.eloAfter !== undefined
              ? `${row.eloBefore} → ${row.eloAfter} (${row.eloAfter - row.eloBefore >= 0 ? "+" : ""}${row.eloAfter - row.eloBefore})`
              : "Elo per game not stored";
          return (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="flex w-full flex-wrap items-center gap-3 py-3 text-left hover:bg-white/5"
              >
                <ResultBadge outcome={outcomeOfScore(row.score)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">
                    vs {row.opponentName}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {row.eventName} · round {row.round} · {row.color} ·{" "}
                    {row.timeControl} · {row.year}
                  </span>
                  <span className="block truncate text-xs text-ink-faint">
                    {row.replay ? "Full replay" : "Result only · no moves"} · {elo}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button
          type="button"
          className="text-gold-300 underline disabled:opacity-40"
          disabled={page === 0}
          onClick={() => setPage((n) => Math.max(0, n - 1))}
        >
          Previous
        </button>
        <span className="text-ink-muted">
          {Math.min(page, pages - 1) + 1} / {pages} · {rows.length} matches
        </span>
        <button
          type="button"
          className="text-gold-300 underline disabled:opacity-40"
          disabled={page + 1 >= pages}
          onClick={() => setPage((n) => n + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function NpcHistoryPanel({
  npcId,
  npcName,
}: {
  npcId: string;
  npcName: string;
}) {
  const save = useSave();
  const matches = useMatchRecords();
  const [rows, setRows] = useState<MatchIndexRow[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>({});
  const [opponentId, setOpponentId] = useState("all");
  const [eventRows, setEventRows] = useState<MatchIndexRow[] | null>(null);
  const [eventName, setEventName] = useState("");
  const [replay, setReplay] = useState<MatchRecord | null>(null);
  const [detail, setDetail] = useState<MatchIndexRow | null>(null);
  useEffect(() => {
    let active = true;
    const local = dedupeRows([
      ...(save.tournamentArchivePending ?? []).flatMap((event) =>
        indexRowsFromEvent(save.career.id, event),
      ),
      ...matches.flatMap((match) => indexRowsFromMatch(save.career.id, match)),
    ]).filter((row) => row.npcId === npcId);
    void (async () => {
      try {
        await ensureMatchIndex(save.career.id);
        const stored = await readNpcIndex(save.career.id, npcId);
        if (!active) return;
        setRows(sortRows(dedupeRows([...stored, ...local])));
        setError("");
      } catch {
        if (!active) return;
        setRows(sortRows(local));
        setError(
          "Stored history could not be read. Matches still waiting to be saved are shown, and nothing was deleted.",
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [matches, npcId, save.career.id, save.tournamentArchivePending]);
  const summary = useMemo(() => summarizeRows(rows ?? []), [rows]);
  const events = useMemo(() => {
    const map = new Map<string, { id: string; name: string; games: number }>();
    for (const row of rows ?? []) {
      const item = map.get(row.eventId) ?? { id: row.eventId, name: row.eventName, games: 0 };
      item.games++;
      map.set(row.eventId, item);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);
  const filtered = useMemo(
    () =>
      (rows ?? []).filter((row) =>
        rowMatches(row, {
          ...filter,
          opponentId: opponentId === "all" ? undefined : opponentId,
        }),
      ),
    [filter, opponentId, rows],
  );
  const replayMatches = useMemo(
    () =>
      matches.filter((match) =>
        indexRowsFromMatch(save.career.id, match).some(
          (row) => row.npcId === npcId && row.replay,
        ),
      ),
    [matches, npcId, save.career.id],
  );
  const open = (row: MatchIndexRow) => {
    if (row.replay && row.replayMatchId) {
      const match = matches.find((item) => item.id === row.replayMatchId);
      if (match && (match.moves.length || match.recording?.ucis.length)) {
        setReplay(match);
        return;
      }
    }
    setDetail(row);
  };
  const openEvent = (id: string) => {
    const name = events.find((event) => event.id === id)?.name ?? id;
    setEventName(name);
    void readEventIndex(save.career.id, id)
      .then((stored) => {
        const pending = (save.tournamentArchivePending ?? [])
          .filter((event) => event.id === id)
          .flatMap((event) => indexRowsFromEvent(save.career.id, event));
        const unique = sortRows(dedupeRows([...stored, ...pending])).filter(
          (row, index, all) => all.findIndex((item) => item.matchId === row.matchId) === index,
        );
        setEventRows(unique.length ? unique : (rows ?? []).filter((row) => row.eventId === id));
      })
      .catch(() => setEventRows((rows ?? []).filter((row) => row.eventId === id)));
  };
  if (replay) return <Replay match={replay} onClose={() => setReplay(null)} />;
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-sm font-semibold text-ink">Match history</h3>
      {rows === null ? (
        <p className="text-sm text-ink-muted">Loading match history…</p>
      ) : (
        <>
          {error && (
            <p role="alert" className="mb-2 text-sm text-gold-300">
              {error}
            </p>
          )}
          <p className="mb-3 text-xs text-ink-muted">
            {summary.games} games · {summary.wins}W {summary.draws}D {summary.losses}L
            · win rate {pct(summary.winRate)} · score {pct(summary.scoreRate)} · white{" "}
            {summary.byColor.white.games} · black {summary.byColor.black.games}
            {summary.eloMissing
              ? ` · Elo per game unavailable for ${summary.eloMissing}`
              : ""}
          </p>
          <Filters
            filter={filter}
            times={summary.byTime.map((item) => item.timeControl)}
            years={summary.byYear.map((item) => item.year)}
            onChange={(next) => {
              setFilter(next);
              setEventRows(null);
            }}
          />
          <label className="mb-3 block text-xs text-ink-muted">
            Head-to-head
            <select
              aria-label="Head-to-head opponent"
              value={opponentId}
              onChange={(e) => setOpponentId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-navy-900 p-3 text-sm text-ink"
            >
              <option value="all">All opponents</option>
              {summary.opponents.map((opponent) => (
                <option key={opponent.id} value={opponent.id}>
                  {opponent.name} · {opponent.wins}W {opponent.draws}D {opponent.losses}L
                </option>
              ))}
            </select>
          </label>
          <MatchRows key={`${filter.outcome ?? ""}|${opponentId}|${filter.query ?? ""}`} rows={filtered} onOpen={open} />
          <div className="mt-4">
            <p className="mb-1 text-sm text-ink-muted">Openings from real games</p>
            <OpeningReport matches={replayMatches} perspective={npcId} />
          </div>
          <label className="mt-4 block text-xs text-ink-muted">
            Tournament board list
            <select
              aria-label="Tournament"
              defaultValue=""
              onChange={(e) => e.target.value && openEvent(e.target.value)}
              className="mt-1 w-full rounded-lg bg-navy-900 p-3 text-sm text-ink"
            >
              <option value="">Choose a tournament</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} · {event.games}
                </option>
              ))}
            </select>
          </label>
          {eventRows && (
            <div className="mt-2">
              <p className="mb-1 text-xs text-ink-muted">{eventName}</p>
              <MatchRows rows={eventRows} onOpen={open} />
            </div>
          )}
          <ul className="mt-3 divide-y divide-white/[0.06] text-xs text-ink-muted">
            {summary.byYear.map((year) => (
              <li key={year.year} className="py-1">
                {year.year}: {year.games} games · {year.wins}W {year.draws}D {year.losses}L
              </li>
            ))}
          </ul>
        </>
      )}
      {detail && (
        <div className="mt-3 rounded-lg bg-navy-900 p-3 text-sm" role="dialog" aria-label="Match detail">
          <p className="font-semibold text-ink">
            {npcName} vs {detail.opponentName}
          </p>
          <p className="mt-1 text-ink-muted">
            {detail.replay
              ? "Replay is stored on the match record."
              : "Result only. This game was scored without moves, so it cannot be replayed."}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            {detail.eventName} · round {detail.round} · {detail.color} ·{" "}
            {outcomeOfScore(detail.score)} · {detail.timeControl}
            {detail.eloBefore !== undefined && detail.eloAfter !== undefined
              ? ` · Elo ${detail.eloBefore} → ${detail.eloAfter}`
              : " · no per-game Elo snapshot"}
          </p>
          <button type="button" className="mt-2 text-gold-300 underline" onClick={() => setDetail(null)}>
            Close
          </button>
        </div>
      )}
    </section>
  );
}
