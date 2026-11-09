import type { GameSave, Npc } from "@/types";
import type { ScheduledEvent } from "@/game/world/schedule";
import { hashString } from "@/utils/format";
import { stampIndex } from "./catalog";

export type EntryEvent = Pick<
  ScheduledEvent,
  "id" | "level" | "fieldSize" | "details"
> &
  Partial<Pick<ScheduledEvent, "registrationDeadline" | "year" | "week">>;
export const entryDay = (save: GameSave) =>
  stampIndex(save.world.date) * 7 + (save.world.day ?? 1) - 1;
const population = new WeakMap<
  Npc[],
  { active: number; byCountry: Map<string, number> }
>();
function eligibleCount(npcs: Npc[], nationality?: string): number {
  let counts = population.get(npcs);
  if (!counts) {
    counts = { active: 0, byCountry: new Map() };
    for (const n of npcs)
      if (n.careerStatus === "active" || n.careerStatus === "semi-retired") {
        counts.active++;
        counts.byCountry.set(
          n.nationality,
          (counts.byCountry.get(n.nationality) ?? 0) + 1,
        );
      }
    population.set(npcs, counts);
  }
  return nationality ? (counts.byCountry.get(nationality) ?? 0) : counts.active;
}
/** Deterministic daily arrivals, independent of page visits, player Elo and registration actions. */
export function registrationCount(
  save: GameSave,
  event: EntryEvent,
  npcs?: Npc[],
): number {
  const reg = save.registrations.find((r) => r.eventId === event.id);
  if (reg && reg.registrationDay === undefined && reg.entrantIds)
    return reg.entrantIds.length;
  const deadline =
    event.registrationDeadline ??
    (event.year && event.week
      ? { year: event.year, week: event.week - 1 }
      : null);
  // A stored registration keeps its original closing day, even when the catalogue falls outside the horizon.
  const close =
    reg?.registrationCloseDay ??
    (deadline ? (stampIndex(deadline) + 1) * 7 - 1 : entryDay(save));
  const key = hashString(
    `${save.world.seed}:${save.career.id}:${event.id}:arrivals`,
  );
  const window = 35 + (key % 29);
  const progress = Math.max(
    0,
    Math.min(1, (entryDay(save) - (close - window)) / window),
  );
  const popularity = key % 3 === 0 ? 1 : 0.65 + (key % 31) / 100;
  const fillAt = key % 3 === 0 ? 0.65 + (key % 20) / 100 : 1;
  const capacity = Math.max(0, event.fieldSize - (reg ? 1 : 0));
  const poolSize =
    reg?.entrantIds?.length ??
    (npcs ? eligibleCount(npcs, event.details?.nationality) : capacity);
  return Math.min(
    capacity,
    poolSize,
    Math.floor(event.fieldSize * Math.min(1, progress / fillAt) * popularity),
  );
}
