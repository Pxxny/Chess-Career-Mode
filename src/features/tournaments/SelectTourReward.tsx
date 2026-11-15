import { Button, Card, CardTitle } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { useGameStore } from "@/store/gameStore";
import { pendingSelectChoices } from "@/game/competition/selectTours";

/** Shown after the player wins a sponsor select-tour World Final: pick next year's reward. */
export function SelectTourReward() {
  const save = useSave();
  const choose = useGameStore((s) => s.chooseSelectReward);
  const pending = pendingSelectChoices(save.competition);
  if (!pending.length) return null;
  return (
    <>
      {pending.map((reward) => (
        <Card key={reward.finalId} data-testid="select-tour-reward">
          <CardTitle>Champion's reward</CardTitle>
          <p className="text-sm">
            <span>You won the</span> <span translate="no">{reward.sponsorName}</span> <span>World Finals.</span> <span>Choose one reward for next year.</span>
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-navy-900/60 p-3">
              <h3 className="font-semibold">Host city</h3>
              <p className="mt-1 text-xs text-ink-muted">
                <span>Your city hosts the other tours of this sponsor next year:</span> <span translate="no">{reward.city}</span>
              </p>
              <Button className="mt-3" onClick={() => choose(reward.finalId, "host")}>Host next year</Button>
            </div>
            <div className="rounded-xl border border-white/10 bg-navy-900/60 p-3">
              <h3 className="font-semibold">Extra seat</h3>
              <p className="mt-1 text-xs text-ink-muted">
                Your country gets 2 seats instead of 1 in this tour's World Finals next year.
              </p>
              <Button className="mt-3" onClick={() => choose(reward.finalId, "quota")}>Add a seat</Button>
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}
