import type {
  ActiveTournament,
  GameSave,
  GameStamp,
  MatchTimeControl,
} from "@/types";
import type { ScheduledEvent, Region } from "@/game/world/schedule";
import { stampFromIndex, stampIndex } from "./catalog";

export const gameDay = (save: Pick<GameSave, "world">): number =>
  stampIndex(save.world.date) * 7 + (save.world.day ?? 1) - 1;
export const dayStamp = (day: number) => ({
  ...stampFromIndex(Math.floor(day / 7)),
  day: (((day % 7) + 7) % 7) + 1,
});
export const dayLabel = (day: number): string => {
  const s = dayStamp(day);
  const date = new Date(Date.UTC(s.year, 0, 1 + (s.week - 1) * 7 + s.day - 1))
    .toISOString()
    .slice(0, 10);
  return `${date} · W${s.week}, day ${s.day}`;
};
export const hhmm = (minute: number): string =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
/** Reserve a slot for a 60-move game plus ten minutes between rounds. This is an itinerary, not a chess clock. */
export const slotMinutes = (tc?: MatchTimeControl): number =>
  tc
    ? Math.max(15, Math.ceil((tc.base * 2 + tc.increment * 120) / 60) + 10)
    : 90;
export function roundSlot(
  round: number,
  rounds: number,
  days: number,
  minutes: number,
  start = 540,
  seriesSize = 1,
): { day: number; minute: number; endMinute: number } {
  if (seriesSize > 1) {
    const block = roundSlot(
      Math.ceil(round / seriesSize),
      Math.ceil(rounds / seriesSize),
      days,
      minutes * seriesSize,
      start,
    );
    const minute = block.minute + ((round - 1) % seriesSize) * minutes;
    return { day: block.day, minute, endMinute: minute + minutes };
  }
  const offset = (r: number) =>
    rounds <= days
      ? Math.floor(((r - 1) * (days - 1)) / Math.max(1, rounds - 1))
      : Math.floor(((r - 1) * days) / rounds);
  const day = offset(round);
  let earlier = 0;
  for (let r = round - 1; r >= 1 && offset(r) === day; r--) earlier++;
  return {
    day,
    minute: start + earlier * minutes,
    endMinute: start + (earlier + 1) * minutes,
  };
}
export function eventAgenda(
  event: Pick<ScheduledEvent, "details" | "fieldSize">,
) {
  const d = event.details,
    slots = slotMinutes(d?.timeControl);
  const rounds =
    d?.format === "round-robin"
      ? event.fieldSize % 2
        ? event.fieldSize
        : event.fieldSize - 1
      : d?.format === "double-round-robin"
        ? (event.fieldSize % 2 ? event.fieldSize : event.fieldSize - 1) * 2
        : d?.format === "round-robin-bo3"
          ? (event.fieldSize % 2 ? event.fieldSize : event.fieldSize - 1) * 3
          : (d?.rounds ?? 7);
  return {
    days: Math.max(1, Math.ceil(rounds / Math.max(1, Math.floor(600 / slots)))),
    startDay: 1,
    startMinute: 540,
    slotMinutes: slots,
    ...d?.agenda,
  };
}
/** Main games only; byes, withdrawals and early BO3 clinches can reduce the total. */
export function maximumPlayerGames(
  event: Pick<ScheduledEvent, "details" | "fieldSize">,
): number {
  const opponents = Math.max(0, event.fieldSize - 1);
  switch (event.details?.format) {
    case "round-robin":
      return opponents;
    case "double-round-robin":
      return opponents * 2;
    case "round-robin-bo3":
      return opponents * 3;
    case "knockout":
      return Math.ceil(Math.log2(Math.max(1, event.fieldSize)));
    case "match":
      return 14;
    default:
      return Math.max(1, Math.min(event.details?.rounds ?? 7, opponents));
  }
}
export function bookedStart(
  event: Pick<ScheduledEvent, "year" | "week" | "details">,
) {
  return stampIndex(event) * 7 + (event.details?.agenda?.startDay ?? 1) - 1;
}
export function bookedEnd(
  event: Pick<ScheduledEvent, "year" | "week" | "details" | "fieldSize">,
) {
  return bookedStart(event) + eventAgenda(event).days - 1;
}
/** Legacy bookings allow starting any day of the listed week, so reserve that whole flexible window. */
export function reservedUntil(
  event: Pick<ScheduledEvent, "year" | "week" | "details" | "fieldSize">,
) {
  return Math.max(
    bookedEnd(event),
    bookedStart(event) + (event.details?.agenda?.exactStart ? 0 : 6),
  );
}
export function tournamentSlot(t: ActiveTournament) {
  const a = eventAgenda({ details: t.details, fieldSize: t.players.length });
  const slot = roundSlot(
    t.round,
    t.rounds,
    a.days,
    a.slotMinutes,
    a.startMinute,
    t.details?.format === "round-robin-bo3" ? 3 : 1,
  );
  return {
    ...slot,
    absoluteDay: (t.startedOnDay ?? stampIndex(t) * 7) + slot.day,
    days: a.days,
  };
}
export function tournamentReady(save: GameSave): boolean {
  return (
    save.tournament?.startedOnDay === undefined ||
    tournamentSlot(save.tournament).absoluteDay === gameDay(save)
  );
}
export function calendarBookings(save: GameSave) {
  const today = gameDay(save);
  return [
    ...save.registrations.map((r) => ({
      eventId: r.eventId,
      name: r.name,
      day:
        !r.details?.agenda?.exactStart &&
        stampIndex(r) === stampIndex(save.world.date)
          ? today
          : bookedStart(r),
    })),
    ...(save.esports?.entries ?? []).map((r) => ({
      eventId: r.event.id,
      name: r.event.name,
      day: r.event.day,
    })),
  ].sort((a, b) => a.day - b.day || a.eventId.localeCompare(b.eventId));
}

/** Three non-overlapping multi-day rotations per calendar month. Single-day circuits remain available. */
export function rotatingEvents(
  now: GameStamp,
  region: Region,
  horizon: number,
): ScheduledEvent[] {
  const from = stampIndex(now) * 7,
    until = (stampIndex(now) + horizon + 1) * 7 - 1;
  const list: ScheduledEvent[] = [];
  for (let year = now.year; year <= Math.floor(until / 364); year++)
    for (let month = 0; month < 12; month++)
      for (const [i, date] of [3, 12, 21].entries()) {
        const offset = Math.floor(
          (Date.UTC(year, month, date) - Date.UTC(year, 0, 1)) / 86400000,
        );
        const at = year * 364 + offset;
        if (at < from || at > until) continue;
        const stamp = dayStamp(at),
          days = i === 0 ? 3 : 7,
          // Expanded editions keep their existing dates/formats; shorter editions
          // remain available throughout the year. Stored registrations keep their snapshot.
          expanded = i === 0 ? month % 2 === 1 : month % 3 === 2,
          count = expanded ? [12, 24, 12][i] : i === 1 ? 8 : 6,
          bo3 = i === 2;
        const slots = 40,
          end = dayStamp(at + days - 1),
          deadline = stampFromIndex(Math.floor(at / 7) - 1);
        const rounds = (count - 1) * (bo3 ? 3 : 1);
        list.push({
          id: `rotation-${year}-${month + 1}-${i}`,
          name: `${["Open Board Rotation", "Seven Days Masters", "Triple Crown Series"][i]} · ${stamp.year}/${month + 1}`,
          year: stamp.year,
          week: stamp.week,
          level: "local",
          fieldSize: count,
          entryFee: bo3 ? 35 : 20,
          minElo: 0,
          minReputation: 0,
          invitational: false,
          registrationDeadline: deadline,
          weeksUntilStart: Math.floor(at / 7) - stampIndex(now),
          weeksUntilDeadline: stampIndex(deadline) - stampIndex(now),
          details: {
            category: "Rotating Round Robin",
            location: region.city,
            country: region.countryCode,
            end,
            format: bo3 ? "round-robin-bo3" : "round-robin",
            rounds,
            agenda: {
              days,
              startDay: stamp.day,
              startMinute: 540,
              slotMinutes: slots,
              exactStart: true,
            },
            timeControl: {
              id: "rotation-10+3",
              label: "10+3",
              base: 600,
              increment: 3,
              category: "rapid",
            },
            prize: bo3 ? 1500 : 750,
            prestige: bo3 ? 35 : 20,
            provenance: "fictional",
            localShare: 0.6,
            organizer: {
              name: [
                "Open Board Club",
                "Career Chess Federation",
                "Triple Crown Chess Club",
              ][i],
              status: i === 1 ? "Official" : "Unofficial",
              simulated: true,
            },
          },
        });
      }
  return list;
}
