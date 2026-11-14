import { Link } from "react-router-dom";
import { Card, CardTitle } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { careerSchedule } from "@/game/career/planning";
import { eligibilityIssues } from "@/game/competition/eligibility";
import { competitionOf } from "@/game/competition/preparation";
import { getTitleStatus } from "@/game/career/titles";
import { normCount } from "@/game/career/titleRules";
import { circuitAdvancement, CIRCUIT_LABELS } from "@/game/competition/qualificationCircuit";
const paths = [
  ["national", "Top 3 earn continental qualification."],
  ["continental", "Top 3 earn World Cup and Grand Swiss qualifications."],
  ["world-cup", "Top 2 earn Candidates qualification."],
  ["grand-swiss", "Top 2 earn Candidates qualification."],
  ["candidates", "The winner earns a World Championship match."],
  [
    "world-championship",
    "Win the match to become champion and earn a title defence.",
  ],
] as const;
export function ChampionshipPath() {
  const save = useSave(),
    events = careerSchedule(save, 52),
    state = competitionOf(save),
    titles = getTitleStatus(save.player, save.history);
  return (
    <div className="space-y-4" data-testid="championship-path">
      <Card data-testid="qualification-circuit-path">
        <CardTitle>Qualification circuit</CardTitle>
        <p className="text-sm text-ink-muted">Sponsored qualification circuits: Local → National → Continental → World. Each event publishes its advancing places and named World Finals destination. Places vary by event and season; federation and continent restrictions still apply.</p>
        <ol className="mt-4 space-y-3">{events.filter((e) => e.details?.qualificationCircuit).map((event) => <li key={event.id} className="rounded-xl bg-navy-900 p-3 text-sm">
          <p translate="no" className="font-semibold">{event.name}</p><p className="mt-2 text-gold-300">{event.details?.qualificationCircuit?.worldFinalName && <span translate="no" className="block text-xs text-ink-muted">{event.details.qualificationCircuit.worldFinalName}</span>}{circuitAdvancement(event.details) || "Final stage · qualifiers from all continents"}</p>
          <Link className="mt-2 inline-block text-gold-300 underline" to={`/complete?event=${encodeURIComponent(event.id)}`}>View tournament</Link>
        </li>)}</ol>
      </Card>
      <Card>
        <CardTitle>Road to World Champion</CardTitle>
        <p className="text-sm text-ink-muted">
          Earn qualification through results, then satisfy the rating, title and
          reputation requirements. Career qualifications remain valid for two
          following seasons.
        </p>
        {state.champion && (
          <p className="mt-3 font-semibold text-gold-300">
            Reigning champion: <span translate="no">{state.champion.name}</span>{" "}
            · {state.champion.year}
          </p>
        )}
        <ol className="mt-4 space-y-4">
          {paths.map(([key, description]) => {
            const event = events.find((e) => e.id.startsWith(`career-${key}-`));
            if (!event) return null;
            const issues = eligibilityIssues(save, event);
            return (
              <li
                key={key}
                className="rounded-lg border border-white/10 p-3 text-sm"
              >
                <p translate="no" className="font-semibold">
                  {event.name}
                </p>
                <p className="mt-1">{description}</p>
                <p className="mt-2 text-xs text-ink-muted">
                  {issues.length
                    ? `Missing: ${issues.join(" · ")}`
                    : "Entry requirements met"}
                </p>
                <Link
                  className="mt-2 inline-block text-gold-300 underline"
                  to={`/complete?event=${encodeURIComponent(event.id)}`}
                >
                  View tournament
                </Link>
              </li>
            );
          })}
        </ol>
        <h3 className="mt-4 font-semibold">Earned qualifications</h3>
        {state.qualifications.length ? (
          <ul className="mt-2 text-sm">
            {state.qualifications.map((q, i) => (
              <li key={i}>
                {CIRCUIT_LABELS[q.kind] ?? q.kind} · {q.year}–{q.eventId ? q.year : q.year + 2} ·{" "}
                <span translate="no">{q.source}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            No qualifications earned yet.
          </p>
        )}
      </Card>
      <Card data-testid="title-requirements">
        <CardTitle>Career title requirements</CardTitle>
        <p className="mb-3 text-sm text-ink-muted">
          Simplified career rules, not official FIDE certification. Titles
          already earned in an older save remain yours.
        </p>
        <p>
          {titles.currentLabel} · {save.player.ratedGames} rated games · peak{" "}
          {save.player.peakRating}
        </p>
        <ul className="mt-3 space-y-2">
          {titles.requirements.map((r) => (
            <li key={r.id} className="text-sm">
              {r.earned ? "✓" : "○"} <span>{r.requirement}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          IM norms: {normCount(save.history, "IM")} / 3 · GM norms:{" "}
          {normCount(save.history, "GM")} / 3
        </p>
        <p className="mt-3 text-xs text-ink-muted">
          A norm needs a finished classical tournament, at least 9 played games,
          5 different opponents and 3 opposing federations. IM: average
          opposition 2200+, performance 2450+, at least 3 titled opponents. GM:
          average opposition 2400+, performance 2600+, at least 3 GM opponents.
          Byes and withdrawn events do not qualify.
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Performance is estimated from your score and average opponent Elo.
        </p>
        <ul className="mt-3 space-y-2 text-xs">
          {(save.history.titleNorms ?? []).map((n) => (
            <li key={`${n.title}-${n.eventId}`}>
              {n.title} · <span translate="no">{n.event}</span> · {n.games}{" "}
              games · {n.performance}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
