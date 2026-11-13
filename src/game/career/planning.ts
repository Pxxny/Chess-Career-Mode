import type { GameSave } from "@/types";
import { yearReviewOf } from "./yearReview";
import { preserveBookedVenues, regionForSave, getSchedule } from "@/game/world/schedule";
import { registrationIssue } from "@/game/competition/eligibility";
import { registrationWindow } from "@/game/competition/registrationWindow";
import { bookedStart, calendarBookings } from "@/game/competition/agenda";
export type AnnualFocus = "balanced" | "rating" | "competition" | "learning";
export interface AnnualPlan {
  year: number;
  focus: AnnualFocus;
}
export interface PlanResult {
  year: number;
  focus: AnnualFocus;
  completed: number;
  total: number;
  ratingChange: number;
}
export interface PlanningState {
  current: AnnualPlan;
  archive: PlanResult[];
}
export const FOCUS_LABELS: Record<AnnualFocus, string> = {
  balanced: "Balanced season",
  rating: "Rating growth",
  competition: "Tournament experience",
  learning: "Learning season",
};
export function planningOf(save: GameSave): PlanningState {
  return {
    current:
      save.planning?.current.year === save.world.date.year
        ? save.planning.current
        : { year: save.world.date.year, focus: "balanced" },
    archive: save.planning?.archive ?? [],
  };
}
export function annualGoals(save: GameSave) {
  const year = yearReviewOf(save).current,
    f = planningOf(save).current.focus;
  return [
    {
      id: "rating",
      label: "Improve peak Elo this year",
      value: Math.max(0, year.peakRating - year.startRating),
      target: f === "rating" ? 150 : 75,
    },
    {
      id: "games",
      label: "Play rated games this year",
      value: year.rated.wins + year.rated.draws + year.rated.losses,
      target: f === "competition" ? 60 : 30,
    },
    {
      id: "events",
      label: "Complete tournaments this year",
      value: year.tournaments,
      target: f === "competition" ? 6 : 3,
    },
    {
      id: "training",
      label: "Complete training sessions this year",
      value: year.sessions,
      target: f === "learning" ? 100 : 60,
    },
  ];
}
export function chooseAnnualFocus(save: GameSave, focus: AnnualFocus) {
  if (!(focus in FOCUS_LABELS))
    return { ok: false as const, error: "Choose a valid annual focus." };
  if (
    save.planning?.current.year === save.world.date.year &&
    save.world.date.week > 4
  )
    return {
      ok: false as const,
      error: "Annual focus is locked after week 4. Choose again next year.",
    };
  return {
    ok: true as const,
    save: {
      ...save,
      planning: {
        ...planningOf(save),
        current: { year: save.world.date.year, focus },
      },
    },
  };
}
export function advancePlanning(before: GameSave, after: GameSave): GameSave {
  if (before.world.date.year === after.world.date.year) return after;
  const p = planningOf(before),
    goals = annualGoals(before),
    y = yearReviewOf(before).current;
  return {
    ...after,
    planning: {
      current: { year: after.world.date.year, focus: p.current.focus },
      archive: [
        ...p.archive.filter((a) => a.year !== p.current.year),
        {
          year: p.current.year,
          focus: p.current.focus,
          completed: goals.filter((g) => g.value >= g.target).length,
          total: goals.length,
          ratingChange: before.player.rating - y.startRating,
        },
      ].slice(-60),
    },
  };
}
export function careerSchedule(save: GameSave, horizon = 26) {
  return preserveBookedVenues(save, getSchedule(save.world.date, regionForSave(save), save.career.id, horizon));
}
export function recommendedEvents(save: GameSave) {
  const focus = planningOf(save).current.focus;
  return careerSchedule(save, 16)
    .filter(
      (e) =>
        e.details?.format !== "team" &&
        !e.details?.showcase &&
        registrationIssue(save, e) === null,
    )
    .map((e) => ({
      event: e,
      score:
        Math.abs(save.player.rating - (e.minElo + 200)) +
        e.weeksUntilStart * 6 +
        (e.details?.travelCost ?? 0) * 0.4 +
        (focus === "competition" ? -Math.min(e.fieldSize, 24) : 0),
      reason:
        e.details?.travelCost === 0
          ? "No travel cost and entry requirements met."
          : "Entry and travel fit your current budget and eligibility.",
    }))
    .sort(
      (a, b) =>
        a.score - b.score || bookedStart(a.event) - bookedStart(b.event),
    )
    .slice(0, 4);
}
export const plannedBookings = (save: GameSave) => calendarBookings(save);
export const upcomingOpenings = (save: GameSave) =>
  careerSchedule(save, 16)
    .filter((e) => registrationWindow(save, e).status === "upcoming")
    .slice(0, 3);
