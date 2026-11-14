import { registrationWindow } from "./registrationWindow";
import { circuitVisible, qualificationMatches, CIRCUIT_LABELS } from "./qualificationCircuit";
import type { ScheduledEvent } from "@/game/world/schedule";
import type { ChessTitle, GameSave, SkillTier } from "@/types";
import { competitionOf } from "./preparation";
import { teamEntryIssues } from "./teamEligibility";
import { stampIndex } from "./catalog";
import { registrationCount } from "./entries";
import { showcaseSelection } from "./showcase";
import type { Npc } from "@/types";
import { bookingConflict } from "@/game/esports/core";
import { bookedStart, bookedEnd, reservedUntil } from "./agenda";
const titles: ChessTitle[] = ["none", "CM", "FM", "IM", "GM"];
const leagues: SkillTier[] = [
  "beginner",
  "amateur",
  "club",
  "professional",
  "international-master",
  "grandmaster",
  "elite-grandmaster",
  "legendary",
];
export function eligibilityIssues(
  save: GameSave,
  event: ScheduledEvent,
): string[] {
  const issues: string[] = [];
  const d = event.details;
  if (!circuitVisible(save.player.country, d)) issues.push("Your federation's qualification circuit only");
  if (save.player.rating < event.minElo) issues.push(`${event.minElo}+ Elo`);
  if (save.player.reputation < event.minReputation)
    issues.push(`Reputation ${event.minReputation}+`);
  const title = save.history.titles.reduce(
    (best, t) => Math.max(best, titles.indexOf(t.title)),
    0,
  );
  if (d?.minimumTitle && title < titles.indexOf(d.minimumTitle))
    issues.push(`${d.minimumTitle} title`);
  if (
    d?.minimumLeague &&
    leagues.indexOf(save.player.league) < leagues.indexOf(d.minimumLeague)
  )
    issues.push(`${d.minimumLeague} league`);
  if (d?.nationality && save.player.country !== d.nationality)
    issues.push(`${d.nationality} nationality`);
  if (d?.federation && save.expansion?.membershipYear !== save.world.date.year)
    issues.push("Current federation membership");
  issues.push(...teamEntryIssues(save, d?.teamEvent));
  if (d?.maxAge !== undefined && save.player.age > d.maxAge)
    issues.push(`Age ${d.maxAge} or younger`);
  if (
    d?.qualification &&
    !competitionOf(save).qualifications.some(
      (q) => qualificationMatches(q, event, save.world.date.year),
    )
  )
    issues.push(`Previous qualification: ${CIRCUIT_LABELS[d.qualification] ?? d.qualification}`);
  return issues;
}
export function registrationIssue(
  save: GameSave,
  event: ScheduledEvent,
  npcs?: Npc[],
): string | null {
  if (
    !Number.isFinite(event.details?.travelCost ?? 0) ||
    (event.details?.travelCost ?? 0) < 0 ||
    !Number.isFinite(event.entryFee) ||
    event.entryFee < 0 ||
    !Number.isInteger(event.fieldSize) ||
    event.fieldSize < 2 ||
    event.fieldSize > 256 ||
    !Number.isInteger(event.week) ||
    event.week < 1 ||
    event.week > 52
  )
    return "Invalid event data.";
  if (registrationWindow(save, event).status === "upcoming")
    return "Registration has not opened yet.";
  if (
    stampIndex(save.world.date) > stampIndex(event.registrationDeadline) ||
    stampIndex(save.world.date) > stampIndex(event)
  )
    return "Registration deadline has passed.";
  if (
    save.tournament?.eventId === event.id ||
    save.registrations.some((r) => r.eventId === event.id) ||
    save.history.tournaments.some((t) => t.tournamentId === event.id)
  )
    return "You are already registered or have played this event.";
  if (
    save.registrations.some(
      (r) =>
        stampIndex(r) === stampIndex(event) &&
        (!r.details?.agenda?.exactStart || !event.details?.agenda?.exactStart),
    )
  )
    return "You already entered another competition starting this week.";
  if (bookingConflict(save, bookedStart(event), reservedUntil(event)))
    return "Schedule conflict with another traditional or esports event.";
  if (event.details?.showcase) {
    if (!npcs || !showcaseSelection(save, event, npcs).invited)
      return "Invitation only: the organizer has not selected you.";
  } else if (
    event.details?.format !== "team" &&
    registrationCount(save, event, npcs) >= event.fieldSize
  )
    return "This tournament is full.";
  const issues = eligibilityIssues(save, event);
  if (issues.length) return `Requires ${issues.join(", ")}.`;
  if (save.player.money < event.entryFee + (event.details?.travelCost ?? 0))
    return "You cannot afford the entry fee and travel.";
  return null;
}
export const requirementsText = (e: ScheduledEvent): string =>
  [
    `${e.minElo}+ Elo`,
    e.minReputation ? `reputation ${e.minReputation}+` : null,
    e.details?.minimumTitle ? `${e.details.minimumTitle} title` : null,
    e.details?.qualification
      ? `qualified for ${CIRCUIT_LABELS[e.details.qualification] ?? e.details.qualification}`
      : null,
    e.details?.nationality ? `${e.details.nationality} nationality` : null,
    e.details?.minimumLeague ? `${e.details.minimumLeague} league` : null,
    e.details?.federation ? "federation member" : null,
  ]
    .filter(Boolean)
    .join(" · ");
