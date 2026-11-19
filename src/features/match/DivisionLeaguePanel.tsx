import { useState } from "react";
import { Button, Card, CardTitle } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { useNpcs } from "@/hooks/useNpcs";
import { useGameStore } from "@/store/gameStore";
import { divisionFixture, divisionName, divisionState } from "@/game/competition/divisionLeague";
import { bookedStart, dayLabel } from "@/game/competition/agenda";
import { registrationIssue } from "@/game/competition/eligibility";
import type { MatchSetup } from "@/game/match/session";
import { TournamentPanel } from "./TournamentPanel";

export function DivisionLeaguePanel({ onStart }: { onStart: (setup: MatchSetup) => void }) {
  const save = useSave();
  const npcs = useNpcs();
  const register = useGameStore(state => state.registerForEvent);
  const [message, setMessage] = useState("");
  const { division } = divisionState(save);
  const regular = divisionFixture(save, npcs, false);
  const playoff = divisionFixture(save, npcs, true);
  const fixture = playoff ?? regular;
  const issue = fixture ? registrationIssue(save, fixture, npcs) : null;
  return <div className="space-y-3">
    <Card>
      <CardTitle>{divisionName(division)} League</CardTitle>
      <p className="text-sm text-ink-muted">Newcomer I–X · 10 players per division · Round robin</p>
      <p className="my-2 text-sm">1st moves up · 10th moves down · 2nd and 9th may play for a division seat.</p>
      {fixture ? <>
        <p>{fixture.name} · {dayLabel(bookedStart(fixture))}</p>
        <Button className="mt-2" disabled={!!issue} onClick={() => {
          const result = register(fixture);
          setMessage(result.ok ? "League fixture registered." : result.error);
        }}>Join league fixture</Button>
        {issue && <p className="mt-2 text-sm text-ink-muted">{issue}</p>}
      </> : <p className="text-sm text-ink-muted">No new fixture is open for this half-season.</p>}
      {message && <p role="status" className="mt-2">{message}</p>}
      <details className="mt-3 text-sm"><summary className="cursor-pointer">League results</summary>
        {[...save.history.tournaments].reverse().filter(result => result.tournamentId.startsWith("division-league-")).map(result => <p key={result.tournamentId}>{result.year} · {result.name} · #{result.rank}</p>)}
      </details>
    </Card>
    <TournamentPanel onStart={onStart} leagueOnly />
  </div>;
}
