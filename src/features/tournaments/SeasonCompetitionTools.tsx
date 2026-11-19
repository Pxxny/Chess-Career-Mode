import { useState } from "react";
import { Button } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { useNpcs } from "@/hooks/useNpcs";
import { useGameStore } from "@/store/gameStore";
import { hostTournament } from "@/game/competition/hostTournament";
import { annualSeriesEvents, seriesStandings, type PointsSeries } from "@/game/competition/seasonSeries";
import { Link } from "react-router-dom";

export function SeasonCompetitionTools() {
  const save = useSave();
  const npcs = useNpcs();
  const year = save.world.date.year;
  const [series, setSeries] = useState<PointsSeries>("fide-season");
  const [name, setName] = useState("");
  const [budget, setBudget] = useState(300);
  const [size, setSize] = useState(8);
  const [format, setFormat] = useState<"swiss" | "round-robin">("swiss");
  const [query, setQuery] = useState("");
  const [inviteIds, setInvites] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [scoreOpen, setScoreOpen] = useState(false);
  const standings = scoreOpen ? seriesStandings(save, npcs, series, year) : [];
  const seats = annualSeriesEvents(year).find(event => event.details?.pointsSeries?.stage === "final")!.fieldSize;
  const finalLeg = annualSeriesEvents(year).filter(event => event.details?.pointsSeries?.id === "meridian-venues").at(-1);
  const champion = finalLeg && save.world.date.week > finalLeg.week ? standings[0] : undefined;
  const upcoming = (save.hostedEvents ?? []).find(event => event.year > year || (event.year === year && event.week >= save.world.date.week));
  return <div className="grid gap-2 lg:grid-cols-2">
    <details className="home-section p-3" onToggle={event => setScoreOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer font-semibold">Season points & home and away series</summary>
      {scoreOpen && <div className="mt-3 space-y-2">
        <select aria-label="Points series" className="w-full rounded-lg bg-navy-900 p-2" value={series} onChange={event => setSeries(event.target.value as PointsSeries)}>
          <option value="fide-season">FIDE Season Points Circuit</option><option value="meridian-venues">Meridian Home & Away Cup</option>
        </select>
        <p className="text-sm text-ink-muted">{year} · Top 10 in each leg score 25 / 18 / 15 / 12 / 10 / 8 / 6 / 4 / 2 / 1 points.</p>
        {series === "fide-season" ? <p className="text-sm text-gold-300">Top {seats} qualify for the FIDE Season Finals.</p> : <p className="text-sm text-gold-300">The leading player after four legs wins the series.</p>}
        {series === "meridian-venues" && champion && <p className="font-semibold">Series champion · <span translate="no">{champion.name}</span></p>}
        <div className="max-h-64 overflow-auto">
          <ol>{standings.map((row, index) => <li key={row.id} className={`flex justify-between gap-3 border-b border-navy-600 p-2 text-sm ${row.id === "player" ? "text-gold-300" : ""}`}>
            <span translate="no">{index + 1}. {row.country} {row.name}</span><strong>{row.points}</strong>
          </li>)}</ol>
          {!standings.length && <p>No points earned this season yet.</p>}
        </div>
      </div>}
    </details>
    <details className="home-section p-3">
      <summary className="cursor-pointer font-semibold">Host in your city · <span translate="no">{save.player.city.name}</span></summary>
      {upcoming ? <Link to={`/complete?event=${encodeURIComponent(upcoming.id)}`} className="mt-3 block text-gold-300">{upcoming.name} · W{upcoming.week}</Link>
        : <form className="mt-3 grid gap-2" onSubmit={event => {
          event.preventDefault();
          const state = useGameStore.getState();
          if (!state.save || state.save.career.id !== save.career.id) return;
          if (state.calendarProgress) {
            setMessage("Wait until simulation finishes.");
            return;
          }
          const result = hostTournament(state.save, { name, budget, size, format, inviteIds }, npcs);
          setMessage(result.error ?? `Published for week ${result.event?.week}.`);
          if (result.save) useGameStore.setState({ save: result.save });
        }}>
          <input required maxLength={56} value={name} onChange={event => setName(event.target.value)} aria-label="Tournament name" placeholder="Tournament name" className="rounded-lg bg-navy-900 p-2" />
          <label className="text-sm">Budget <input required type="number" min={300} value={budget} onChange={event => setBudget(event.target.valueAsNumber)} className="ml-2 w-24 rounded-lg bg-navy-900 p-2" /></label>
          <p className="text-xs text-ink-muted">80% goes to prizes. Published events start in four weeks.</p>
          <select aria-label="Tournament format" value={format} onChange={event => setFormat(event.target.value as typeof format)} className="rounded-lg bg-navy-900 p-2"><option value="swiss">Swiss</option><option value="round-robin">Round robin</option></select>
          <select aria-label="Field size" value={size} onChange={event => { setSize(Number(event.target.value)); setInvites(inviteIds.slice(0, Number(event.target.value) - 1)); }} className="rounded-lg bg-navy-900 p-2">{[8, 12, 16].map(n => <option key={n} value={n}>{n}</option>)}</select>
          <label className="text-sm">Invite players · {inviteIds.length}<input aria-label="Find a player to invite" value={query} onChange={event => setQuery(event.target.value)} className="block w-full rounded-lg bg-navy-900 p-2" /></label>
          {query.trim().length >= 2 && npcs.filter(npc => npc.careerStatus === "active" && npc.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 8).map(npc => (
            <label key={npc.id} className="text-sm"><input type="checkbox" checked={inviteIds.includes(npc.id)} disabled={!inviteIds.includes(npc.id) && inviteIds.length >= size - 1} onChange={event => setInvites(current => event.target.checked ? [...current, npc.id] : current.filter(id => id !== npc.id))} /> {npc.name}</label>
          ))}
          <Button type="submit" disabled={budget > save.player.money}>Publish tournament</Button>
        </form>}
      {message && <p className="mt-2 text-sm" role="status">{message}</p>}
    </details>
  </div>;
}
