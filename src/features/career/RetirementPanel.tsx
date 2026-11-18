import { useState } from "react";
import { Medal } from "lucide-react";
import { Button, Card, CardTitle } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { useGameStore } from "@/store/gameStore";
import { retirementIssue } from "@/game/career/retirement";
import { EliteStats } from "@/features/elite/ElitePresentation";

export function RetirementPanel() {
  const save = useSave();
  const retire = useGameStore(state => state.retireCareer);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const issue = retirementIssue(save);
  const plaque = save.retirement;
  return <Card className={plaque ? "elite-hero" : ""} data-testid="career-retirement">
    <CardTitle aside={<Medal className="text-gold-300" size={22} aria-hidden />}>{plaque ? "Personal Hall of Fame plaque" : "Retirement"}</CardTitle>
    {plaque ? <>
      <h3 className="font-display text-2xl" translate="no">{save.player.name}</h3>
      <p className="mb-3 text-sm text-ink-muted">{save.career.startYear} – {plaque.year} · W{plaque.week}</p>
      <EliteStats items={[["Peak Elo", plaque.peakElo], ["Tournament wins", plaque.wins], ["Rated games", plaque.ratedGames], ["Career titles", save.history.titles.length]]} />
    </> : <>
      <p className="text-sm text-ink-muted">End competitive play and preserve your final career record in a personal plaque.</p>
      {issue && <p className="mt-2 text-sm text-ink-muted">{issue}</p>}
      {confirm ? <div className="mt-3 space-y-2">
        <p className="text-sm font-semibold">Retirement is permanent for this save.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { const result = retire(); if (!result.ok) setError(result.error); }}>Confirm retirement</Button>
          <Button variant="secondary" onClick={() => { setConfirm(false); setError(""); }}>Keep competing</Button>
        </div>
      </div> : <Button className="mt-3" variant="secondary" disabled={Boolean(issue)} onClick={() => setConfirm(true)}>Retire from competition</Button>}
      {error && <p role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
    </>}
  </Card>;
}
