import { registrationIssue } from "@/game/competition/eligibility";
import { playTeamCup, federationTeams } from "@/game/career/expansion";
import { news } from "@/game/career/expansion";
import { pickField } from "./tournament";
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
  event: Pick<ScheduledEvent, "id" | "level" | "fieldSize" | "details">,
  npcs: Npc[],
): Npc[] {
  const reg = save.registrations.find((r) => r.eventId === event.id);
  if (reg?.entrantIds) {
    const byId = new Map(npcs.map((n) => [n.id, n]));
    return reg.entrantIds
      .map((id) => byId.get(id))
      .filter((n): n is Npc => !!n);
  }
  if (event.details?.format === "team") {
    const teams = federationTeams(save, npcs),
      home = teams.find((t) => t.country === save.player.country),
      chosen = home
        ? [home, ...teams.filter((t) => t !== home).slice(0, 7)]
        : teams.slice(0, 8);
    const ids = new Set(chosen.flatMap((t) => t.players.map((p) => p.id)));
    return npcs.filter((n) => ids.has(n.id));
  }
  return pickField(
    event.details?.nationality
      ? npcs.filter((n) => n.nationality === event.details!.nationality)
      : npcs,
    save.player.rating,
    event.level,
    Math.max(1, event.fieldSize - 1),
    createRng(mixSeed(eventFieldSeed(save, event.id), 0x7001)),
  );
}
export function registerForEvent(
  save: GameSave,
  event: ScheduledEvent,
  npcs?: Npc[],
): Result<GameSave> {
  const error = registrationIssue(save, event);
  if (error) return { ok: false, error };
  if (npcs && !npcs.length)
    return { ok: false, error: "Wait for the NPC world to finish loading." };
  if (
    event.details?.format === "team" &&
    npcs &&
    !federationTeams(save, npcs)
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
    name: event.name,
    level: event.level,
    year: event.year,
    week: event.week,
    fieldSize: event.fieldSize,
    entryFee: event.entryFee,
    minElo: event.minElo,
    minReputation: event.minReputation,
    details: event.details,
    ...(npcs
      ? {
          entrantIds: previewEntrants(save, event, npcs).map((n) => n.id),
          entrantSeed: eventFieldSeed(save, event.id),
        }
      : {}),
  };
  return {
    ok: true,
    save: {
      ...save,
      player: addMoney(save.player, -event.entryFee),
      registrations: [...save.registrations, entry],
    },
  };
}

/** Cancels a registration and refunds the fee while the event has not started. */
export function cancelRegistration(save: GameSave, eventId: string): GameSave {
  const reg = save.registrations.find((r) => r.eventId === eventId);
  if (!reg) return save;
  const refund = weekIndex(reg) > weekIndex(save.world.date) ? reg.entryFee : 0;
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
  if (save.tournament && save.tournament.status === "playing")
    return { ok: false, error: "You are already playing a tournament." };
  const reg = save.registrations.find((r) => r.eventId === eventId);
  if (!reg)
    return { ok: false, error: "You are not registered for this event." };
  const diff = weekIndex(reg) - weekIndex(save.world.date);
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
  const eligible = npcs.filter(
    (n) =>
      (n.careerStatus === "active" || n.careerStatus === "semi-retired") &&
      (!reg.entrantIds || reg.entrantIds.includes(n.id)),
  );
  if (!eligible.length) {
    const refunded = {
      ...save,
      player: addMoney(save.player, reg.entryFee),
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
  const t: ActiveTournament = createTournament({
    event,
    player: {
      name: save.player.name,
      rating: save.player.rating,
      country: save.player.country,
      title: highestTitle(save),
    },
    npcs,
    seed: reg.entrantSeed ?? seed,
    fieldIds: reg.entrantIds,
  });
  return {
    ok: true,
    save: {
      ...save,
      registrations: save.registrations.filter((r) => r.eventId !== eventId),
      tournament: t,
    },
  };
}
