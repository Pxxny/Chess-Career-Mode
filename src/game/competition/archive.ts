import { maximumPlayerGames } from "./agenda";
import { getCountry } from "@/data/world/countries";
import { teamSpec } from "@/data/chess/nationalTeamEvents";
import { teamHost } from "./hosts";
import type {
  ActiveTournament,
  GameSave,
  TournamentPairing,
  TournamentPlayer,
} from "@/types";
import { standings } from "@/game/match/tournament";
export type EventKind = "regular" | "national";
export interface ArchivedEvent {
  qualificationTarget?: string;
  qualifiedIds?: string[];
  id: string;
  year: number;
  week: number;
  name: string;
  kind: EventKind;
  source: "career" | "world-circuit" | "national-team" | "calendar";
  datePrecision?: "day" | "week";
  location?: string;
  country?: string;
  startDay: number;
  endDay: number;
  fieldSize: number;
  rounds: number;
  format: string;
  timeControl: string;
  players: Array<
    Pick<TournamentPlayer, "id" | "name" | "elo" | "countryCode" | "title"> & {
      points: number;
      rank: number;
      members?: Array<{ id: string; name: string; elo: number }>;
      boardPoints?: number;
    }
  >;
  pairings: Array<
    Array<
      Pick<
        TournamentPairing,
        "white" | "black" | "result" | "tiebreakWinner" | "broadcast"
      >
    >
  >;
  gamesPerEntrant?: number;
  teamBoards?: Array<{
    round: number;
    white: string;
    black: string;
    score: number;
  }>;
}
export const eventKind = (e: {
  details?: { format?: string; teamEvent?: unknown };
}): EventKind =>
  e.details?.format === "team" || e.details?.teamEvent ? "national" : "regular";
export function archiveTournament(t: ActiveTournament): ArchivedEvent {
  const start =
    (t.year * 52 + t.week - 1) * 7 + (t.details?.agenda?.startDay ?? 1) - 1;
  return {
    id: t.eventId,
    year: t.year,
    week: t.week,
    name: t.name,
    kind: "regular",
    source: "career",
    datePrecision:
      t.startedOnDay !== undefined || t.details?.agenda?.exactStart
        ? "day"
        : "week",
    location: t.details?.location,
    country: t.details?.country,
    startDay: t.startedOnDay ?? start,
    endDay: start + Math.max(1, t.details?.agenda?.days ?? 1) - 1,
    fieldSize: t.players.length,
    rounds: t.rounds,
    format: t.details?.format ?? "swiss",
    timeControl: t.timeControl.label,
    gamesPerEntrant: maximumPlayerGames({
      details: t.details,
      fieldSize: t.players.length,
    }),
    players: standings(t).map(({ player: p, rank }) => ({
      id: p.id,
      name: p.name,
      elo: p.elo,
      countryCode: p.countryCode,
      title: p.title,
      points: p.points,
      rank,
    })),
    pairings: t.pairings.map((r) =>
      r.map((p) => ({
        white: p.white,
        black: p.black,
        result: p.result,
        ...(p.tiebreakWinner ? { tiebreakWinner: p.tiebreakWinner } : {}),
        ...(p.broadcast ? { broadcast: p.broadcast } : {}),
      })),
    ),
  };
}
/** Outbox is flushed to per-career IndexedDB; finished snapshots do not disappear with the 30-event UI cache. */
export function queueArchives(
  save: GameSave,
  records: ArchivedEvent[],
): GameSave {
  if (!records.length) return save;
  const all = new Map(
    (save.tournamentArchivePending ?? []).map((e) => [e.id, e]),
  );
  for (const record of records) all.set(record.id, record);
  return { ...save, tournamentArchivePending: [...all.values()] };
}
export function retainedArchives(save: GameSave): ArchivedEvent[] {
  const map = new Map<string, ArchivedEvent>();
  for (const t of [
    ...(save.competition?.archive ?? []),
    ...(save.tournament ? [save.tournament] : []),
  ])
    if (t.status === "finished") map.set(t.eventId, archiveTournament(t));
  for (const e of save.tournamentArchivePending ?? []) map.set(e.id, e);
  for (const cup of save.expansion?.cups ?? []) {
    const spec = cup.key ?? "olympiad",
      id = `career-${spec}-${cup.year}`;
    if (map.has(id)) continue;
    const week = teamSpec(spec)?.week ?? 1,
      host = teamHost(spec, cup.year);
    map.set(id, {
      id,
      year: cup.year,
      week,
      name: cup.name ?? "National team event",
      kind: "national",
      source: "national-team",
      location: host.location,
      country: host.country,
      startDay: cup.playedOnDay ?? cup.year * 364 + (week - 1) * 7,
      endDay: cup.playedOnDay ?? cup.year * 364 + (week - 1) * 7,
      datePrecision: cup.playedOnDay === undefined ? "week" : "day",
      fieldSize: cup.teamCount ?? cup.teams.length,
      rounds:
        cup.format === "round-robin"
          ? Math.max(0, cup.teams.length - 1)
          : (cup.rounds ?? 0),
      gamesPerEntrant:
        cup.format === "round-robin"
          ? Math.max(0, cup.teams.length - 1)
          : (cup.rounds ?? 0),
      teamBoards: cup.boards.map((b) => ({
        round: b.round,
        white: b.white,
        black: b.black,
        score: b.score,
      })),
      format: cup.format ?? "team",
      timeControl: "Classical",
      players: cup.teams.map((t, i) => ({
        id: t.country,
        name: getCountry(t.country)?.name ?? t.country,
        members: [...t.players, ...(t.reserves ?? [])],
        boardPoints: t.boardPoints,
        countryCode: t.country,
        elo: 0,
        title: "none",
        points: t.points,
        rank: i + 1,
      })),
      pairings: [],
    });
  }
  return [...map.values()];
}
export function historyYears(save: GameSave) {
  const from = Math.min(2025, save.career.startYear, save.world.date.year);
  return Array.from(
    { length: save.world.date.year - from + 1 },
    (_, i) => from + i,
  );
}
/** Retained legacy summaries are factual; absent positions/pairings stay absent. */
export function legacyEventSummaries(
  save: GameSave,
  npcs: import("@/types").Npc[],
  year: number,
): ArchivedEvent[] {
  const map = new Map<string, ArchivedEvent>();
  for (const n of npcs)
    for (const h of n.tournamentHistory) {
      if (
        h.year !== year ||
        !["world-circuit", "calendar"].includes(h.source ?? "") ||
        !h.eventId
      )
        continue;
      let e = map.get(h.eventId);
      if (!e) {
        e = {
          id: h.eventId,
          year,
          week: h.week ?? 1,
          name: h.event,
          kind: "regular",
          source: h.source === "calendar" ? "calendar" : "world-circuit",
          datePrecision: "week",
          startDay: (year * 52 + (h.week ?? 1) - 1) * 7,
          endDay: (year * 52 + (h.week ?? 1) - 1) * 7,
          fieldSize: h.fieldSize,
          rounds: h.rounds ?? 0,
          format: "world-circuit",
          timeControl: "Rapid",
          players: [],
          pairings: [],
        };
        map.set(e.id, e);
      }
      if (!e.players.some((p) => p.id === n.id))
        e.players.push({
          id: n.id,
          name: n.name,
          elo: h.ratingBefore ?? 0,
          countryCode: n.nationality,
          title: n.title,
          points: h.points ?? 0,
          rank: h.rank,
        });
    }
  for (const h of save.history.tournaments) {
    if (h.year !== year || map.has(h.tournamentId)) continue;
    map.set(h.tournamentId, {
      id: h.tournamentId,
      year,
      week: h.week,
      name: h.name,
      kind: "regular",
      source: "career",
      datePrecision: "week",
      startDay: (year * 52 + h.week - 1) * 7,
      endDay: (year * 52 + h.week - 1) * 7,
      fieldSize: h.fieldSize,
      rounds: 0,
      format: "Not recorded",
      timeControl: "Not recorded",
      players: [
        {
          id: "player",
          name: save.player.name,
          elo: 0,
          countryCode: save.player.country,
          title: "none",
          points: h.points,
          rank: h.rank,
        },
      ],
      pairings: [],
    });
  }
  return [...map.values()];
}
