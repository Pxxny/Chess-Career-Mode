import { UpcomingPredictions } from "@/features/prediction/CareerPrediction";
import { Badge, Card, CardTitle } from "@/components/ui";
import { getTier } from "@/data/chess/tiers";
import type { Rankings } from "@/game/world/standings";
import {
  isEligible,
  registrationOpen,
  type ScheduledEvent,
} from "@/game/world/schedule";
import type { Player } from "@/types";
import { formatMoney } from "@/utils/format";

interface Props {
  player: Player;
  schedule: ScheduledEvent[];
  rankings: Rankings;
}

const UPCOMING = 4;

const startsIn = (weeks: number): string =>
  weeks <= 0 ? "this week" : weeks === 1 ? "next week" : `in ${weeks} weeks`;

export function CompetitionsSection({ player, schedule, rankings }: Props) {
  const upcoming = schedule.slice(0, UPCOMING);
  const eligible = (e: ScheduledEvent) =>
    isEligible(e, player.rating, player.reputation);
  return (
    <Card className="mb-4">
      <CardTitle>Competitions</CardTitle>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-navy-700/60 p-3">
          <dt className="text-xs text-ink-muted">Current league</dt>
          <dd className="mt-1 font-semibold text-ink">
            {getTier(player.league).leagueName}
          </dd>
        </div>
        <div className="rounded-lg bg-navy-700/60 p-3">
          <dt className="text-xs text-ink-muted">Current standing</dt>
          <dd className="mt-1 font-semibold tabular-nums text-ink">
            #{rankings.league.rank}{" "}
            <span className="text-sm font-normal text-ink-muted">
              of {rankings.league.of}
            </span>
          </dd>
        </div>
      </dl>

      <h3 className="mb-2 mt-5 text-sm font-semibold text-ink-muted">
        Current tournament
      </h3>
      <UpcomingPredictions />

      <h3 className="mb-2 mt-5 text-sm font-semibold text-ink-muted">
        Upcoming tournaments
      </h3>
      {upcoming.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No tournaments are scheduled yet.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {upcoming.map((e) => {
            const ok = eligible(e);
            const open = registrationOpen(e);
            return (
              <li key={e.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{e.name}</p>
                    <p className="text-xs capitalize text-ink-muted">
                      {e.level} · {e.fieldSize} players · entry{" "}
                      {formatMoney(e.entryFee)}
                    </p>
                  </div>
                  <Badge tone={ok ? "gold" : "neutral"}>
                    {ok ? "Eligible" : `Needs ${e.minElo} Elo`}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  Starts year {e.year}, week {e.week} (
                  {startsIn(e.weeksUntilStart)}).{" "}
                  {open
                    ? `Register by week ${e.registrationDeadline.week} (${startsIn(e.weeksUntilDeadline)}).`
                    : "Registration closed."}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
