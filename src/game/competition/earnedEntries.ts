import type { GameSave } from "@/types";
import type { ScheduledEvent } from "@/game/world/schedule";
import { competitionOf } from "./preparation";
import { stampIndex } from "./catalog";
import { registrationWindow } from "./registrationWindow";

/** The next edition for each earned qualification, including old saves with no news metadata.
 * These are invitations to register, not paid bookings: normal entry checks still apply.
 */
export function earnedEntries(save: GameSave, events: ScheduledEvent[]) {
  const qualifications = [...competitionOf(save).qualifications]
    .filter((q) => q.year <= save.world.date.year && q.year >= save.world.date.year - 2)
    .sort((a, b) => b.year - a.year);
  const kinds = new Set(qualifications.map((q) => q.kind));
  return [...kinds].flatMap((kind) => {
    const qualification = qualifications.find((q) => q.kind === kind)!;
    if (save.registrations.some((r) => r.details?.qualification === kind &&
      stampIndex(r) >= stampIndex(save.world.date)) ||
      (save.tournament?.status === "playing" && save.tournament.details?.qualification === kind)) return [];
    const event = events.filter((e) => e.details?.qualification === kind &&
      e.year >= qualification.year && e.year <= qualification.year + 2 &&
      stampIndex(e) >= stampIndex(save.world.date) &&
      registrationWindow(save, e).status !== "closed")
      .sort((a, b) => stampIndex(a) - stampIndex(b))[0];
    // Pick the edition before excluding bookings, so a booked edition isn't listed again as next year's invitation.
    if (!event || save.registrations.some((r) => r.eventId === event.id) ||
      save.tournament?.eventId === event.id ||
      save.history.tournaments.some((t) => t.tournamentId === event.id)) return [];
    return [{ event, qualification }];
  }).sort((a, b) => stampIndex(a.event) - stampIndex(b.event));
}
