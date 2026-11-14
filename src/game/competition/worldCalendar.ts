import type { ActiveTournament, GameSave, Npc } from "@/types";
import type { NationalTeam } from "@/game/career/expansion";
import { getCountry } from "@/data/world/countries";
import { teamInfoOf } from "@/data/chess/nationalTeamEvents";
import { preserveBookedVenues, regionForSave, getSchedule, type ScheduledEvent } from "@/game/world/schedule";
import { createRng, mixSeed } from "@/game/rng";
import { hashString } from "@/utils/format";
import { createTournament, completeRound } from "@/game/match/tournament";
import { previewEntrants, eventFieldSeed } from "@/game/match/registration";
import {
  predictionEnvironment,
  tournamentObservations,
} from "@/game/prediction/adapters";
import { recordPredictions } from "@/game/prediction/statistics";
import { applyNpcResult } from "@/game/npc/results";
import { buildEventTeams, simulateTeamEvent } from "./teamEvents";
import {
  archiveTournament,
  queueArchives,
  retainedArchives,
  type ArchivedEvent,
} from "./archive";
import {
  bookedStart,
  bookedEnd,
  gameDay,
  dayStamp,
  tournamentSlot,
  reservedUntil,
} from "./agenda";

export interface CalendarTournamentState {
  /** Last completed day. Page visits never simulate results or move this cursor. */
  lastDay: number;
  active: ActiveTournament[];
  national: Array<{ event: ScheduledEvent; teams: NationalTeam[] }>;
}

export function annualEvents(save: GameSave, year: number): ScheduledEvent[] {
  return preserveBookedVenues(save, getSchedule(
    { year: year - 1, week: 52 }, regionForSave(save), save.career.id, 53,
  ).filter((e) => e.year === year));
}

/** Same NPC cannot play two overlapping calendar events or a reserved player event. */
export function calendarBusyIds(
  save: GameSave,
  event?: ScheduledEvent,
): Set<string> {
  const ids = new Set<string>();
  const start = event ? bookedStart(event) : gameDay(save);
  const end = event ? bookedEnd(event) : start;
  const overlaps = (a: number, b: number) => a <= end && b >= start;
  for (const t of [
    ...(save.calendarTournaments?.active ?? []),
    ...(save.tournament?.status === "playing" ? [save.tournament] : []),
  ])
    if (
      t.eventId !== event?.id &&
      overlaps(
        t.startedOnDay ?? bookedStart(t),
        (t.startedOnDay ?? bookedStart(t)) +
          Math.max(
            0,
            bookedEnd({ ...t, fieldSize: t.players.length }) - bookedStart(t),
          ),
      )
    )
      t.players.forEach((p) => ids.add(p.id));
  for (const n of save.calendarTournaments?.national ?? [])
    if (
      n.event.id !== event?.id &&
      overlaps(bookedStart(n.event), bookedEnd(n.event))
    )
      n.teams.forEach((t) =>
        [...t.players, ...(t.reserves ?? [])].forEach((p) => ids.add(p.id)),
      );
  for (const r of save.registrations)
    if (r.eventId !== event?.id && overlaps(bookedStart(r), reservedUntil(r)))
      r.entrantIds?.forEach((id) => ids.add(id));
  if (save.esports?.active?.status === "playing")
    save.esports.active.teams.forEach((t) =>
      t.members.forEach((p) => ids.add(p.id)),
    );
  return ids;
}

export function calendarField(
  save: GameSave,
  event: ScheduledEvent,
  npcs: Npc[],
): Npc[] {
  const busy = calendarBusyIds(save, event);
  // Qualify against the full population first. A busy finalist must not promote a failed qualifier.
  if (event.details?.qualificationCircuit)
    return previewEntrants(save, event, npcs).filter((n) => !busy.has(n.id) && n.currentElo >= event.minElo);
  const available = npcs.filter(
    (n) => !busy.has(n.id) && n.currentElo >= event.minElo,
  );
  return previewEntrants(save, event, available);
}

/** Apply exactly the recorded boards; never give a free random rating change. */
function recordNpcBoards(
  event: ArchivedEvent,
  boards: Array<{ white: string; black: string; score: number }>,
  npcs: Map<string, Npc>,
  ranks: Map<string, { rank: number; points: number }>,
) {
  const totals = new Map<
    string,
    {
      games: number;
      wins: number;
      draws: number;
      losses: number;
      before: number;
    }
  >();
  for (const b of boards) {
    const w = npcs.get(b.white),
      bl = npcs.get(b.black);
    if (!w || !bl) continue;
    for (const [n, score, opponent] of [
      [w, b.score, bl],
      [bl, 1 - b.score, w],
    ] as const) {
      // Also protects imports/replays that already contain these results.
      if (n.tournamentHistory.some((h) => h.eventId === event.id)) continue;
      const s = totals.get(n.id) ?? {
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        before: n.currentElo,
      };
      s.games++;
      s.wins += Number(score === 1);
      s.draws += Number(score === 0.5);
      s.losses += Number(score === 0);
      totals.set(n.id, s);
      npcs.set(
        n.id,
        applyNpcResult(
          n,
          score === 1 ? "win" : score === 0.5 ? "draw" : "loss",
          opponent.currentElo,
        ),
      );
    }
  }
  for (const [id, s] of totals) {
    const npc = npcs.get(id)!,
      rank = ranks.get(id);
    npcs.set(id, {
      ...npc,
      tournamentHistory: [
        ...npc.tournamentHistory,
        {
          eventId: event.id,
          event: event.name,
          year: event.year,
          week: event.week,
          source: "calendar" as const,
          rank: rank?.rank ?? 0,
          fieldSize: event.fieldSize,
          points: rank?.points ?? s.wins + s.draws / 2,
          rounds: event.rounds,
          games: s.games,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          ratingBefore: s.before,
          ratingAfter: npc.currentElo,
        },
      ].slice(-120),
    });
  }
}

/** Runs only while ending a day, including fast-forward. Existing past years are never fabricated. */
export function advanceCalendarTournaments(
  before: GameSave,
  after: GameSave,
  population: Npc[],
): { save: GameSave; changed: Npc[] } {
  if (!population.length || before.career.id !== after.career.id)
    return { save: after, changed: [] };
  const day = gameDay(before);
  const previous = before.calendarTournaments;
  if (previous && previous.lastDay >= day) return { save: after, changed: [] };
  let state: CalendarTournamentState = {
    lastDay: day,
    active: [...(previous?.active ?? [])],
    national: [...(previous?.national ?? [])],
  };
  let next = { ...after, calendarTournaments: state };
  const byNpc = new Map(population.map((n) => [n.id, n]));
  const records: ArchivedEvent[] = [];
  const reserved = new Set([
    ...before.registrations.map((r) => r.eventId),
    ...(before.tournament ? [before.tournament.eventId] : []),
    ...retainedArchives(before).map((r) => r.id),
  ]);
  const already = new Set([
    ...state.active.map((t) => t.eventId),
    ...state.national.map((n) => n.event.id),
  ]);
  const sameDay = { ...before, calendarTournaments: state };
  for (const event of annualEvents(before, before.world.date.year)) {
    if (
      bookedStart(event) !== day ||
      reserved.has(event.id) ||
      already.has(event.id)
    )
      continue;
    const busy = calendarBusyIds(sameDay, event);
    const available = [...byNpc.values()].filter((n) => !busy.has(n.id));
    if (event.details?.format === "team") {
      const teams = buildEventTeams(
        before,
        available,
        teamInfoOf(event.details),
        false,
      );
      if (teams.length >= 2) state.national.push({ event, teams });
    } else {
      const field = calendarField(sameDay, event, [...byNpc.values()]);
      if (field.length < 2) continue;
      state.active.push({
        ...createTournament({
          npcOnly: true,
          event: { ...event, fieldSize: field.length },
          player: {
            name: "",
            rating: event.minElo,
            country: event.details?.country ?? before.player.country,
            title: "none",
          },
          npcs: field,
          fieldIds: field.map((n) => n.id),
          seed: eventFieldSeed(before, event.id),
          predictionEnvironment: {
            ...predictionEnvironment(before),
            player: undefined,
          },
        }),
        startedOnDay: day,
      });
    }
  }
  const active: ActiveTournament[] = [];
  for (let t of state.active) {
    while (t.status === "playing" && tournamentSlot(t).absoluteDay <= day)
      t = completeRound(t, null, {
        ...predictionEnvironment(before),
        player: undefined,
      });
    if (t.status === "playing") {
      active.push(t);
      continue;
    }
    const record: ArchivedEvent = {
      ...archiveTournament(t),
      source: "calendar",
    };
    const ranks = new Map(
      record.players.map((p) => [p.id, { rank: p.rank, points: p.points }]),
    );
    recordNpcBoards(
      record,
      t.pairings
        .flat()
        .flatMap((p) =>
          p.result === null || p.black === "bye"
            ? []
            : [{ white: p.white, black: p.black, score: p.result }],
        ),
      byNpc,
      ranks,
    );
    records.push(record);
    next = {
      ...recordPredictions(next, tournamentObservations(t)),
      calendarTournaments: state,
    };
  }
  const national: CalendarTournamentState["national"] = [];
  for (const entry of state.national) {
    const { event } = entry;
    if (bookedEnd(event) > day) {
      national.push(entry);
      continue;
    }
    const result = simulateTeamEvent(
      before,
      [...byNpc.values()],
      teamInfoOf(event.details),
      structuredClone(entry.teams),
      createRng(
        mixSeed(
          before.world.seed,
          hashString(`${before.career.id}:${event.id}`),
        ),
      ),
      true,
    );
    const record: ArchivedEvent = {
      id: event.id,
      name: event.name,
      year: event.year,
      week: event.week,
      kind: "national",
      source: "calendar",
      startDay: bookedStart(event),
      endDay: bookedEnd(event),
      datePrecision: "day",
      location: event.details?.location,
      country: event.details?.country,
      fieldSize: result.teams.length,
      rounds:
        result.format === "round-robin"
          ? result.teams.length - 1
          : result.rounds,
      gamesPerEntrant:
        result.format === "round-robin"
          ? result.teams.length - 1
          : result.rounds,
      format: result.format,
      timeControl: event.details?.timeControl.label ?? "Classical",
      pairings: [],
      teamBoards: result.boards.map((b) => ({
        round: b.round,
        white: b.white,
        black: b.black,
        score: b.score,
      })),
      players: result.teams.map((t, i) => ({
        id: t.country,
        name: getCountry(t.country)?.name ?? t.country,
        countryCode: t.country,
        title: "none",
        elo: 0,
        rank: i + 1,
        points: t.points,
        boardPoints: t.boardPoints,
        members: [...t.players, ...(t.reserves ?? [])],
      })),
    };
    const ranks = new Map(
      result.teams.flatMap((t, i) =>
        [...t.players, ...(t.reserves ?? [])].map(
          (p) => [p.id, { rank: i + 1, points: t.points }] as const,
        ),
      ),
    );
    recordNpcBoards(
      record,
      result.boards
        .filter((b) => !b.forfeit)
        .map((b) => ({ white: b.whiteId!, black: b.blackId!, score: b.score })),
      byNpc,
      ranks,
    );
    records.push(record);
    next = {
      ...recordPredictions(next, result.samples),
      calendarTournaments: state,
    };
  }
  state = { ...state, active, national };
  return {
    save: queueArchives({ ...next, calendarTournaments: state }, records),
    changed: population.flatMap((n) =>
      byNpc.get(n.id) !== n ? [byNpc.get(n.id)!] : [],
    ),
  };
}
