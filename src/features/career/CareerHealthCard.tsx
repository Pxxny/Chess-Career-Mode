import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
import { Card, CardTitle } from "@/components/ui";
import { recoveryDays } from "@/game/career/health";
import { useSave } from "@/hooks/useGame";

export function CareerHealthCard() {
  const save = useSave();
  const days = recoveryDays(save);
  const fatigue = save.training.fatigue;
  if (!days && fatigue < 70 && !save.careerSystems?.jetlag) return null;
  return <Card className="mb-4" data-testid="career-health">
    <CardTitle aside={<Activity size={20} aria-hidden className="text-gold-300" />}>Health & recovery</CardTitle>
    <p className={days ? "font-semibold text-rose-300" : "text-sm text-ink-muted"}>
      {days ? <>{save.health?.condition === "illness" ? "Illness" : "Exhaustion"} · Mandatory recovery · {days} days remaining</> : "High fatigue or travel strain"}
    </p>
    <p className="mt-1 text-sm text-ink-muted">Fatigue {Math.round(fatigue)} / 100</p>
    {days > 0 && <p className="mt-2 text-sm text-ink-muted">End days to recover. If a round is due before you recover, you can withdraw from the event.</p>}
    <div className="mt-2 flex flex-wrap gap-3 text-sm text-gold-300">
      <Link className="inline-flex min-h-11 items-center underline" to="/train">Open training & rest</Link>
      {save.tournament?.status === "playing" && <Link className="inline-flex min-h-11 items-center underline" to="/complete">Open current tournament</Link>}
    </div>
  </Card>;
}
