import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, CardTitle, ProgressBar } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { useGameStore } from "@/store/gameStore";
import {
  annualGoals,
  planningOf,
  FOCUS_LABELS,
  recommendedEvents,
  plannedBookings,
  upcomingOpenings,
  type AnnualFocus,
} from "@/game/career/planning";
import { dayLabel, bookedStart } from "@/game/competition/agenda";
import { registrationWindow } from "@/game/competition/registrationWindow";
export function SeasonPlan() {
  const save = useSave(),
    plan = planningOf(save),
    goals = annualGoals(save),
    [focus, setFocus] = useState<AnnualFocus>(plan.current.focus),
    [error, setError] = useState("");
  const bookings = plannedBookings(save),
    recommendations = recommendedEvents(save),
    openings = upcomingOpenings(save);
  const action = useGameStore((s) => s.careerAction);
  return (
    <div className="space-y-4" data-testid="season-plan">
      <Card>
        <CardTitle>Annual goals</CardTitle>
        <p className="mb-3 text-sm text-ink-muted">
          Choose a season focus. Goals track your actual games, tournaments,
          training and peak rating this year.
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Annual focus"
            className="min-w-0 flex-1 rounded-lg bg-navy-900 p-3"
            value={focus}
            onChange={(e) => setFocus(e.target.value as AnnualFocus)}
          >
            {Object.entries(FOCUS_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <Button
            onClick={() => {
              const r = action({ type: "focus", focus });
              setError(r.ok ? "" : r.error);
            }}
          >
            Save annual focus
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Focus can be changed in weeks 1–4. Goals do not grant automatic Elo or
          prize money.
        </p>
        {error && (
          <p role="alert" className="mt-2 text-red-300">
            {error}
          </p>
        )}
        <ul className="mt-4 space-y-4">
          {goals.map((g) => (
            <li key={g.id} data-testid={`goal-${g.id}`}>
              <div className="flex justify-between gap-2 text-sm">
                <span>{g.label}</span>
                <span>
                  {g.value} / {g.target}
                </span>
              </div>
              <ProgressBar
                value={Math.min(100, (g.value / g.target) * 100)}
                label={g.label}
              />
            </li>
          ))}
        </ul>
      </Card>
      <Card data-testid="career-calendar">
        <CardTitle>Your competition calendar</CardTitle>
        {bookings.length ? (
          <ul className="space-y-3">
            {bookings.map((b) => (
              <li key={b.eventId} className="text-sm">
                <p translate="no" className="font-semibold">
                  {b.name}
                </p>
                <p>{dayLabel(b.day).slice(0, 10)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            No booked tournaments. Choose an event below and register when
            ready.
          </p>
        )}
      </Card>
      <Card data-testid="recommended-events">
        <CardTitle>Recommended individual events</CardTitle>
        <p className="mb-3 text-xs text-ink-muted">
          Ranked by eligibility, budget, timing and rating fit. Registration is
          open; NPC entries can still fill up.
        </p>
        {recommendations.length ? (
          <ul className="divide-y divide-white/10">
            {recommendations.map(({ event: e, reason }) => (
              <li key={e.id} className="py-3 text-sm">
                <p translate="no" className="font-semibold">
                  {e.name}
                </p>
                <p>{reason}</p>
                <p className="text-xs text-ink-muted">
                  {dayLabel(bookedStart(e)).slice(0, 10)} · {e.fieldSize}{" "}
                  players · ${e.entryFee + (e.details?.travelCost ?? 0)}
                </p>
                <Link
                  className="mt-2 inline-block text-gold-300 underline"
                  to={`/complete?event=${encodeURIComponent(e.id)}`}
                >
                  View tournament
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            No suitable open individual event right now. Review your budget,
            entry requirements or upcoming registration windows.
          </p>
        )}
      </Card>
      <Card>
        <CardTitle>Upcoming registration windows</CardTitle>
        <ul className="space-y-3">
          {openings.map((e) => (
            <li key={e.id} className="text-sm">
              <p translate="no">{e.name}</p>
              <p className="text-xs text-ink-muted">
                {dayLabel(registrationWindow(save, e).open).slice(0, 10)} –{" "}
                {dayLabel(registrationWindow(save, e).close).slice(0, 10)} ·{" "}
                {e.minElo}+ Elo
              </p>
              <Link
                className="text-gold-300 underline"
                to={`/complete?event=${encodeURIComponent(e.id)}`}
              >
                View tournament
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      {plan.archive.length > 0 && (
        <Card>
          <CardTitle>Past annual goals</CardTitle>
          <ul>
            {[...plan.archive].reverse().map((p) => (
              <li key={p.year}>
                {p.year} · {p.completed}/{p.total} · Elo{" "}
                {p.ratingChange > 0 ? "+" : ""}
                {p.ratingChange}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
