import { Button } from "@/components/ui";
import { useGameStore } from "@/store/gameStore";
import { useSave } from "@/hooks/useGame";
import {
  dayLabel,
  eventAgenda,
  gameDay,
  hhmm,
  roundSlot,
  tournamentSlot,
} from "@/game/competition/agenda";
import type { ActiveTournament } from "@/types";
import type { ScheduledEvent } from "@/game/world/schedule";

export function TournamentTimetable({
  event,
  tournament,
}: {
  event?: ScheduledEvent;
  tournament?: ActiveTournament;
}) {
  const data = tournament
    ? { details: tournament.details, fieldSize: tournament.players.length }
    : event;
  if (!data) return null;
  const a = eventAgenda(data),
    rounds = tournament?.rounds ?? data.details?.rounds ?? 7;
  const days = Array.from({ length: a.days }, (_, day) => {
    const slots = Array.from({ length: rounds }, (_, i) =>
      roundSlot(
        i + 1,
        rounds,
        a.days,
        a.slotMinutes,
        a.startMinute,
        data.details?.format === "round-robin-bo3" ? 3 : 1,
      ),
    ).filter((s) => s.day === day);
    return {
      day: day + 1,
      games: slots.length,
      from: slots[0]?.minute,
      to: slots.at(-1)?.endMinute,
    };
  });
  return (
    <details
      className="mt-3 rounded-lg border border-white/10 p-3 text-xs"
      data-testid="daily-timetable"
    >
      <summary className="cursor-pointer font-semibold text-ink">
        {a.days === 1 ? "Single day" : `${a.days} days`} · daily games & times
        {data.details?.format === "round-robin-bo3"
          ? " · BO3 per opponent"
          : data.details?.format?.includes("round-robin")
            ? " · all-player rotation"
            : ""}
      </summary>
      <p className="my-2 text-ink-muted">
        Maximum scheduled games per player; byes and a decided BO3 reduce the
        total. Slots include a break and are separate from each game's chess
        clock.
      </p>
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-left text-ink-muted">
          <thead>
            <tr>
              <th className="py-2">Day</th>
              <th>Max games / player</th>
              <th>Scheduled times</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <td className="py-1">{d.day}</td>
                <td>{d.games}</td>
                <td>
                  {d.from === undefined || d.to === undefined
                    ? "Rest day"
                    : `${hhmm(d.from)}–${hhmm(d.to)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
export function TournamentDayClock({
  tournament,
  round,
  interactive = false,
}: {
  tournament: ActiveTournament;
  round?: number;
  interactive?: boolean;
}) {
  const save = useSave(),
    advance = useGameStore((s) => s.advanceCompetitionDay);
  const view = round ? { ...tournament, round } : tournament,
    slot = tournamentSlot(view),
    today = gameDay(save),
    waiting = slot.absoluteDay > today;
  return (
    <div
      className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-navy-900 p-3 text-sm"
      data-testid="tournament-day-clock"
    >
      <div>
        <p className="font-semibold text-ink">
          {waiting ? "Next match day" : "Tournament time"} ·{" "}
          {dayLabel(slot.absoluteDay)} · {hhmm(slot.minute)}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Day {slot.day + 1} / {slot.days} · round {view.round} · slot ends{" "}
          {hhmm(slot.endMinute)}
        </p>
      </div>
      {interactive && waiting && (
        <Button variant="secondary" onClick={() => advance("traditional")}>
          Advance to next match day
        </Button>
      )}
    </div>
  );
}
