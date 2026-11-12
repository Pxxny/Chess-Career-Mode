import type { GameSave } from "@/types";
import type { EntryEvent } from "./entries";
import { stampIndex } from "./catalog";
import { hashString } from "@/utils/format";

/** Opens 35–63 days before closing, matching NPC arrivals; both dates are inclusive. */
export function registrationWindow(save: GameSave, event: EntryEvent) {
  const reg = save.registrations.find((r) => r.eventId === event.id);
  const deadline =
    event.registrationDeadline ??
    (event.year && event.week
      ? { year: event.year, week: event.week - 1 }
      : save.world.date);
  const close = reg?.registrationCloseDay ?? (stampIndex(deadline) + 1) * 7 - 1;
  const seed = hashString(
    `${save.world.seed}:${save.career.id}:${event.id}:arrivals`,
  );
  const days = 35 + (seed % 29);
  const open = close - days;
  const now = stampIndex(save.world.date) * 7 + (save.world.day ?? 1) - 1;
  return {
    open,
    close,
    days,
    status:
      now < open
        ? ("upcoming" as const)
        : now > close
          ? ("closed" as const)
          : ("open" as const),
  };
}
