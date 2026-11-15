import { QualificationMap } from "./QualificationMap";
import { Card, CardTitle } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { competitionOf } from "@/game/competition/preparation";
import { getTitleStatus } from "@/game/career/titles";
import { normCount } from "@/game/career/titleRules";
import { CIRCUIT_LABELS } from "@/game/competition/qualificationCircuit";
export function ChampionshipPath() {
  const save = useSave(),
    state = competitionOf(save),
    titles = getTitleStatus(save.player, save.history);
  return (
    <div className="space-y-4" data-testid="championship-path">
      <QualificationMap/>
      <Card><details><summary className="cursor-pointer font-semibold">Earned qualifications ({state.qualifications.length})</summary>{state.qualifications.length?<ul className="mt-3 space-y-2 text-sm">{state.qualifications.map((q,i)=><li key={i}><span>{CIRCUIT_LABELS[q.kind]??q.kind}</span> · {q.year}–{q.eventId?q.year:q.year+2} · <span translate="no">{q.source}</span></li>)}</ul>:<p className="mt-3 text-sm text-ink-muted">No qualifications earned yet.</p>}</details></Card>
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
