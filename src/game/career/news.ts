import { getEventsForYear } from "@/data/chess/historicalEvents";
import { SPONSORSHIPS } from "@/data/reputation";
import { TITLE_LADDER } from "@/data/titles";
import type { GameSave, NewsItem, Npc } from "@/types";
import { showcaseSelection } from "@/game/competition/showcase";
import { eligibilityIssues } from "@/game/competition/eligibility";
import { newestFirst } from "../history/createHistory";
import {
  isEligible,
  registrationOpen,
  type ScheduledEvent,
} from "../world/schedule";

const CLOSE_TO_TITLE_POINTS = 50;

/** Stored career events plus live opportunities computed from the current state. Newest first. */
export function buildNews(
  save: GameSave,
  schedule: ScheduledEvent[],
  npcs?: Npc[],
): NewsItem[] {
  const { player, world, history } = save;
  const now = world.date;
  const live: NewsItem[] = [];

  // Tournament invitations: invitational events the player qualifies for while registration is open.
  for (const e of schedule) {
    if (
      !e.invitational ||
      !isEligible(e, player.rating, player.reputation) ||
      !registrationOpen(e)
    )
      continue;
    if (
      eligibilityIssues(save, e).length ||
      (e.details?.showcase &&
        (!npcs || !showcaseSelection(save, e, npcs).invited))
    )
      continue;
    live.push({
      id: `live-invite-${e.id}`,
      kind: "invitation",
      headline: `Invitation: ${e.name}`,
      detail: `Starts year ${e.year}, week ${e.week}. ${e.details?.showcase ? "Accept your organizer invitation in Complete > Tournament" : "Register"} by week ${e.registrationDeadline.week}. Entry $${e.entryFee}.`,
      ...now,
    });
  }

  // Sponsorship opportunities the player now qualifies for.
  for (const s of SPONSORSHIPS) {
    if (player.reputation >= s.minReputation && player.rating >= s.minElo) {
      live.push({
        id: `live-sponsor-${s.id}`,
        kind: "sponsorship",
        headline: s.name,
        detail: `Offer worth about $${s.monthly} a month.`,
        ...now,
      });
    }
  }

  // Close to a title.
  const next = TITLE_LADDER.find((t) => player.peakRating < t.minElo);
  if (next && next.minElo - player.peakRating <= CLOSE_TO_TITLE_POINTS) {
    live.push({
      id: `live-title-${next.id}`,
      kind: "title",
      headline: `${next.minElo - player.peakRating} Elo points from ${next.label}`,
      detail: `The title needs a peak Elo of ${next.minElo}.`,
      ...now,
    });
  }

  // Real chess history for the current year.
  for (const event of getEventsForYear(now.year).slice(0, 3)) {
    live.push({
      id: `live-history-${event.id}-${now.year}`,
      kind: "history",
      headline: event.name,
      detail: `Running in ${now.year}${event.city !== "Host city varies" ? ` in ${event.city}` : ""}.`,
      ...now,
    });
  }

  return [...[...history.news].reverse(), ...live].sort((a, b) =>
    newestFirst(a, b),
  );
}
