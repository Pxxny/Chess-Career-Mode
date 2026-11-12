import type { GameSave, TrainingCategory } from "@/types";
import {
  CATEGORY_INFO,
  CATEGORY_ORDER,
  sessionsIn,
} from "@/data/trainingSessions";
import {
  isEligible,
  registrationOpen,
  type ScheduledEvent,
} from "../world/schedule";
import { getStat } from "./engine";

export interface Recommendation {
  category: TrainingCategory;
  reason: string;
}

const CLOSE_EVENT_WEEKS = 2;

/** One category to focus on right now, with the reason, from fatigue, morale, the calendar and weakest areas. */
export function recommendCategory(
  save: GameSave,
  schedule: ScheduledEvent[],
): Recommendation {
  const { player, training } = save;
  const soon = schedule.find(
    (e) =>
      e.weeksUntilStart <= CLOSE_EVENT_WEEKS &&
      isEligible(e, player.rating, player.reputation) &&
      registrationOpen(e, save),
  );
  if (soon && training.tournamentPrep?.eventId !== soon.id)
    return {
      category: "career",
      reason: `${soon.name} starts ${soon.weeksUntilStart <= 0 ? "this week" : `in ${soon.weeksUntilStart} week${soon.weeksUntilStart === 1 ? "" : "s"}`}.`,
    };
  if (training.fatigue >= 60)
    return {
      category: "body",
      reason:
        "You are tired. Build stamina and recover before the next hard session.",
    };
  if (player.morale < 50)
    return {
      category: "mind",
      reason: "Morale is low. Work on focus and mental stability.",
    };

  // Otherwise the category with the lowest average level across the stats it trains.
  let best: { category: TrainingCategory; average: number } | null = null;
  for (const category of CATEGORY_ORDER) {
    const stats = [
      ...new Set(
        sessionsIn(category).flatMap((s) => s.effects.map((e) => e.stat)),
      ),
    ];
    const average =
      stats.reduce((sum, stat) => sum + getStat(save, stat), 0) / stats.length;
    if (!best || average < best.average - 0.001) best = { category, average };
  }
  const category = best!.category;
  return {
    category,
    reason: `${CATEGORY_INFO[category].label} has your lowest average level (${Math.round(best!.average)}).`,
  };
}
