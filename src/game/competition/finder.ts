import { matchesVenueContinent } from "./venues";
import type { ScheduledEvent } from "@/game/world/schedule";
import { eventAgenda } from "./agenda";
export interface TournamentSearch {
  qualification?: "all" | "required" | "qualifier" | "circuit";
  organizer?: "all" | "Official" | "Unofficial";
  duration?: "all" | "single" | "multi" | "3" | "7";
  pairing?: "all" | "rotation" | "bo3";
  fromWeek: number;
  toWeek: number;
  minElo: number;
  maxElo: number;
  continent: string;
  minPlayers: number;
  maxPlayers: number;
  availableOnly: boolean;
}
export function matchesTournamentSearch(
  event: ScheduledEvent,
  search: TournamentSearch,
): boolean {
  return (
    matchesQualificationFilter(event, search.qualification) &&
    (!search.organizer ||
      search.organizer === "all" ||
      event.details?.organizer?.status === search.organizer) &&
    (!search.duration ||
      search.duration === "all" ||
      (search.duration === "single"
        ? eventAgenda(event).days === 1
        : search.duration === "multi"
          ? eventAgenda(event).days > 1
          : eventAgenda(event).days === Number(search.duration))) &&
    (!search.pairing ||
      search.pairing === "all" ||
      (search.pairing === "bo3"
        ? event.details?.format === "round-robin-bo3"
        : !!event.details?.format.includes("round-robin"))) &&
    event.weeksUntilStart >= search.fromWeek &&
    event.weeksUntilStart <= search.toWeek &&
    event.minElo >= search.minElo &&
    event.minElo <= search.maxElo &&
    event.fieldSize >= search.minPlayers &&
    event.fieldSize <= search.maxPlayers &&
    matchesVenueContinent(event.details?.country, search.continent)
  );
}
export function matchesQualificationFilter(event: ScheduledEvent, filter: TournamentSearch["qualification"] = "all") {
  return filter === "all" || (filter === "required" ? !!event.details?.qualification : filter === "qualifier" ? !!event.details?.qualificationCircuit?.advanceTop : !!event.details?.qualificationCircuit);
}
