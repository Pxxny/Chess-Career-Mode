import {
  predictionEnvironment,
  playerActor,
  recordTournamentPredictions,
} from "@/game/prediction/adapters";
import {
  gameDay,
  bookedStart,
  bookedEnd,
  dayStamp,
  eventAgenda,
} from "@/game/competition/agenda";
import { registrationIssue } from "@/game/competition/eligibility";
import { playTeamCup } from "@/game/career/expansion";
import { buildEventTeams } from "@/game/competition/teamEvents";
import { teamInfoOf } from "@/data/chess/nationalTeamEvents";
import { news } from "@/game/career/expansion";
import { pickEventField } from "./tournament";
import { createRng, mixSeed } from "@/game/rng";
import { hashString } from "@/utils/format";
import { addMoney } from "@/game/player/resources";
import { type ScheduledEvent } from "@/game/world/schedule";
import type {
  ActiveTournament,
  EventRegistration,
  GameSave,
  Npc,
} from "@/types";
import { createTournament } from "./tournament";
import { highestTitle } from "./setup";
import { entryDay, registrationCount } from "@/game/competition/entries";
import { showcaseSelection } from "@/game/competition/showcase";
import { stampIndex } from "@/game/competition/catalog";
import { circuitNpcField } from "@/game/competition/qualificationCircuit";

const rosters = new WeakMap<Npc[], Map<string, Npc[]>>();
export function projectedEntrants(
  save: GameSave,
  event: Pick<ScheduledEvent, "id" | "level" | "fieldSize" | "details"> & Partial<Pick<ScheduledEvent,"minElo">>,
  npcs: Npc[],
): Npc[] {
  let cache = rosters.get(npcs);
  if (!cache) {
    cache = new Map();
    rosters.set(npcs, cache);
  }
  const key = `${eventFieldSeed(save, event.id)}:${event.level}:${event.fieldSize}:${event.minElo??0}:${event.details?.country}:${event.details?.nationality}:${event.details?.location}:${event.details?.localShare}`;
  let field = cache.get(key);
  if (!field) {
    const target =
      event.level === "local"
        ? 1300
        : event.level === "national"
          ? 1800
          : event.level === "international"
            ? 2100
            : 2500;
    field = pickEventField(
      event.details?.qualificationCircuit ? circuitNpcField(event, npcs, save.world.seed) : npcs,
      target,
      { ...event, fieldSize: event.fieldSize + 1 },
      createRng(mixSeed(eventFieldSeed(save, event.id), 0x7001)),
    );
    if (cache.size >= 256) cache.clear();
    cache.set(key, field);
  }
  return field;
}

/** Weeks since year 0, to compare dates. */
export const weekIndex = (d: { year: number; week: number }): number =>
  d.year * 52 + (d.week - 1);

export type Registration = EventRegistration & {
  status: "upcoming" | "ready" | "missed";
};

/** Registrations with their state today: upcoming, ready to play (the event week), or missed (the week has passed). */
export function registrationStates(save: GameSave): Registration[] {
  const now = weekIndex(save.world.date);
  return save.registrations.map((r) => {
    const at = weekIndex(r);
    if (r.details?.agenda?.exactStart) {
      const diff = bookedStart(r) - gameDay(save);
      return {
        ...r,
        status:
          diff > 0
            ? ("upcoming" as const)
            : diff === 0
              ? ("ready" as const)
              : ("missed" as const),
      };
    }
    return {
      ...r,
      status: at > now ? "upcoming" : at === now ? "ready" : "missed",
    };
  });
}

export type Result<T> = { ok: true; save: T } | { ok: false; error: string };

/** Registers for an upcoming event: registration must be open, the player eligible and able to pay the entry fee. */
export const eventFieldSeed = (save: GameSave, eventId: string): number =>
  mixSeed(save.world.seed, hashString(eventId) ^ hashString(save.career.id));
export function previewEntrants(
  save: GameSave,
  event: import("@/game/competition/entries").EntryEvent,
  npcs: Npc[],
): Npc[] {
  const reg = save.registrations.find((r) => r.eventId === event.id);
  if (reg?.entrantIds) {
    const byId = new Map(npcs.map((n) => [n.id, n]));
    const entrants = reg.entrantIds
      .map((id) => byId.get(id))
      .filter((n): n is Npc => !!n);
    return reg.details?.showcase || reg.details?.format === "team"
      ? entrants
      : entrants.slice(0, registrationCount(save, event, npcs));
  }
  if (event.details?.showcase)
    return showcaseSelection(save, event, npcs).entrants;
  if (event.details?.format === "team") {
    const teams = buildEventTeams(save, npcs, teamInfoOf(event.details)),
      ids = new Set(
        teams.flatMap((t) =>
          [...t.players, ...(t.reserves ?? [])].map((p) => p.id),
        ),
      );
    return npcs.filter((n) => ids.has(n.id));
  }
  return projectedEntrants(save, event, npcs).slice(
    0,
    registrationCount(save, event, npcs),
  );
}
export function registerForEvent(
  save: GameSave,
  event: ScheduledEvent,
  npcs?: Npc[],
  acceptInvitation = false,
): Result<GameSave> {
  if (event.details?.showcase && !acceptInvitation)
    return {
      ok: false,
      error:
        "This is an invitation-only showmatch. Accept an organizer invitation instead.",
    };
  const error = registrationIssue(save, event, npcs);
  if (error) return { ok: false, error };
  if (npcs && !npcs.length)
    return { ok: false, error: "Wait for the NPC world to finish loading." };
  if (
    event.details?.format === "team" &&
    npcs &&
    !buildEventTeams(save, npcs, teamInfoOf(event.details))
      .find((t) => t.country === save.player.country)
      ?.players.some((p) => p.id === "player")
  )
    return {
      ok: false,
      error:
        "You must be selected among the top four eligible players of your national team.",
    };
  const entry: EventRegistration = {
    eventId: event.id,
    registrationDay: entryDay(save),
    registrationCloseDay: (stampIndex(event.registrationDeadline) + 1) * 7 - 1,
    ...(event.details?.showcase ? { invitationAccepted: true } : {}),
    name: event.name,
    level: event.level,
    year: event.year,
    week: event.week,
    fieldSize: event.fieldSize,
    entryFee: event.entryFee,
    travelCost: event.details?.travelCost ?? 0,
    minElo: event.minElo,
    minReputation: event.minReputation,
    details: event.details,
    ...(npcs
      ? {
          entrantIds: (event.details?.showcase ||
          event.details?.format === "team"
            ? previewEntrants(save, event, npcs)
            : projectedEntrants(save, event, npcs).slice(0, event.fieldSize - 1)
          ).map((n) => n.id),
          entrantSeed: eventFieldSeed(save, event.id),
        }
      : {}),
  };
  return {
    ok: true,
    save: {
      ...save,
      player: addMoney(
        save.player,
        -event.entryFee - (event.details?.travelCost ?? 0),
      ),
      registrations: [...save.registrations, entry],
    },
  };
}

/** Cancels a registration and refunds the fee while the event has not started. */
export function cancelRegistration(save: GameSave, eventId: string): GameSave {
  const reg = save.registrations.find((r) => r.eventId === eventId);
  if (!reg) return save;
  const refund =
    weekIndex(reg) > weekIndex(save.world.date)
      ? reg.entryFee + (reg.travelCost ?? 0)
      : 0;
  return {
    ...save,
    player: addMoney(save.player, refund),
    registrations: save.registrations.filter((r) => r.eventId !== eventId),
  };
}

/** Starts the tournament of a registration in its week. The fee was paid at registration. */
export function startRegisteredTournament(
  save: GameSave,
  eventId: string,
  npcs: Npc[],
  seed: number,
): Result<GameSave> {
  if (save.esports?.active?.status === "playing")
    return {
      ok: false,
      error:
        "Finish the esports event before starting a traditional tournament.",
    };
  if (save.tournament && save.tournament.status === "playing")
    return { ok: false, error: "You are already playing a tournament." };
  const reg = save.registrations.find((r) => r.eventId === eventId);
  if (!reg)
    return { ok: false, error: "You are not registered for this event." };
  const diff = reg.details?.agenda?.exactStart
    ? bookedStart(reg) - gameDay(save)
    : weekIndex(reg) - weekIndex(save.world.date);
  if (diff > 0)
    return {
      ok: false,
      error: `The event starts in ${diff} week${diff === 1 ? "" : "s"}. End days in Train to move the calendar forward.`,
    };
  if (diff < 0)
    return { ok: false, error: "The event has already taken place." };
  if (reg.details?.format === "team") {
    const result = playTeamCup(
      save,
      reg.entrantIds
        ? npcs.filter((n) => reg.entrantIds!.includes(n.id))
        : npcs,
      { eventId },
    );
    return result.ok
      ? {
          ok: true,
          save: {
            ...result.save,
            registrations: result.save.registrations.filter(
              (r) => r.eventId !== eventId,
            ),
          },
        }
      : result;
  }
  const event = {
    minElo: reg.minElo ?? 0,
    minReputation: reg.minReputation ?? 0,
    details: reg.details,
    id: reg.eventId,
    name: reg.name,
    level: reg.level,
    year: reg.year,
    week: reg.week,
    fieldSize: reg.fieldSize,
    entryFee: reg.entryFee,
  } as ScheduledEvent;
  const finalIds =
    reg.details?.showcase || !reg.entrantIds
      ? reg.entrantIds
      : reg.entrantIds.slice(0, registrationCount(save, event, npcs));
  const eligible = npcs.filter(
    (n) =>
      (n.careerStatus === "active" || n.careerStatus === "semi-retired") &&
      (!finalIds || finalIds.includes(n.id)),
  );
  if (!eligible.length) {
    const refunded = {
      ...save,
      player: addMoney(save.player, reg.entryFee + (reg.travelCost ?? 0)),
      registrations: save.registrations.filter((r) => r.eventId !== eventId),
    };
    return {
      ok: true,
      save: news(
        refunded,
        `cancelled-${eventId}`,
        `${reg.name} cancelled`,
        "No eligible opponents remain. Your entry fee was refunded.",
      ),
    };
  }
  const created: ActiveTournament = createTournament({
    predictionEnvironment: predictionEnvironment(save),
    playerActor: playerActor(save),
    event,
    player: {
      name: save.player.name,
      rating: save.player.rating,
      country: save.player.country,
      title: highestTitle(save),
    },
    npcs,
    seed: reg.entrantSeed ?? seed,
    fieldIds: finalIds,
  });
  const agenda = eventAgenda(event);
  const lastDay = dayStamp(gameDay(save) + agenda.days - 1);
  const t = {
    ...created,
    startedOnDay: gameDay(save),
    details: created.details
      ? { ...created.details, agenda, end: lastDay }
      : undefined,
  };
  return {
    ok: true,
    save: recordTournamentPredictions(
      {
        ...save,
        registrations: save.registrations.filter((r) => r.eventId !== eventId),
        tournament: t,
      },
      t,
    ),
  };
}
