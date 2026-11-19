import { confirmUI } from "@/i18n/translate";
import { Moon } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardTitle } from "@/components/ui";
import { restBlock, restInfo, type RestKind } from "@/game/training/engine";
import { useSave } from "@/hooks/useGame";
import { useGameStore } from "@/store/gameStore";
import { esportsOf, esportsRoundDay } from "@/game/esports/core";
import { gameDay, tournamentSlot } from "@/game/competition/agenda";

const OPTIONS: RestKind[] = ["break", "nap"];

export function RestCard({ compact = false }: { compact?: boolean } = {}) {
  const save = useSave();
  const rest = useGameStore((s) => s.rest);
  const endDay = useGameStore((s) => s.endDay);
  const [message, setMessage] = useState("");
  const restDay = save.training.hoursUsedToday === 0;

  const doRest = (kind: RestKind) => {
    const result = rest(kind);
    setMessage(
      result.ok
        ? `${restInfo(kind).label}: recovered ${result.recovered}% fatigue.`
        : result.error,
    );
  };
  const sleep = () => {
    const esports = esportsOf(save).active;
    const missedEsports =
      esports?.status === "playing" &&
      esportsRoundDay(esports) <= gameDay(save);
    const missedTraditional =
      save.tournament?.status === "playing" &&
      save.tournament.startedOnDay !== undefined &&
      tournamentSlot(save.tournament).absoluteDay <= gameDay(save);
    if (
      (missedEsports || missedTraditional) &&
      !confirmUI(
        missedEsports
          ? "You still have an esports game today. Ending the day forfeits the remaining esports event without a prize. Continue?"
          : "You still have tournament games today. Ending the day forfeits the unplayed games scheduled for today. Continue?",
      )
    )
      return;
    const report = endDay();
    if (!report) {
      setMessage("Finish the running match before ending the day.");
      return;
    }
    setMessage(
      `${report.restDay ? "A full rest day. " : ""}You slept and recovered ${report.recovered}% fatigue. It is now ${report.newWeek ? `week ${report.newDay.week}, ` : ""}day ${report.newDay.day}. Action points restored.`,
    );
  };

  const endDayButton = <Button className="col-span-2 sm:col-span-1" onClick={sleep}>
    <Moon size={16} aria-hidden />
    {restDay ? "Rest day: end day" : "End day & sleep"}
  </Button>;
  const breaks = OPTIONS.map(kind => {
    const info = restInfo(kind);
    const block = restBlock(save, kind);
    return <Button key={kind} className="min-w-0 px-2 text-xs sm:px-4 sm:text-sm"
      variant="secondary" onClick={() => doRest(kind)} disabled={block !== null} title={block ?? undefined}>
      {info.label} ({info.hours} h, -{info.recovery}%)
    </Button>;
  });

  return <Card className="mb-4">
    {!compact && <CardTitle>Rest &amp; recovery</CardTitle>}
    {compact ? <>
      {endDayButton}
      <details className="mt-2">
        <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-ink-muted">Short break or nap</summary>
        <div className="grid grid-cols-2 gap-2">{breaks}</div>
      </details>
    </> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{breaks}{endDayButton}</div>}
    <p role="status" aria-live="polite" className="mt-2 text-sm text-ink-muted empty:hidden">{message}</p>
  </Card>;
}
