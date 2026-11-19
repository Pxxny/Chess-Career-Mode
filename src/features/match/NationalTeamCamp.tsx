import { useState } from "react";
import { Button } from "@/components/ui";
import { getCountry } from "@/data/world/countries";
import { teamInfoOf } from "@/data/chess/nationalTeamEvents";
import { bookedStart, gameDay } from "@/game/competition/agenda";
import { recordOpeningStudy } from "@/game/play/practice";
import { useGameStore } from "@/store/gameStore";
import { useOpeningDb } from "@/store/openingStore";
import type { EventRegistration, GameSave } from "@/types";

export function NationalTeamCamp({ save, entry }: { save: GameSave; entry: EventRegistration }) {
  const db = useOpeningDb();
  const days = bookedStart(entry) - gameDay(save);
  const boards = teamInfoOf(entry.details).boards;
  const prior = save.teamCamps?.[entry.eventId];
  const country = getCountry(save.player.country)?.name ?? save.player.country;
  const [openingId, setOpeningId] = useState("");
  const [goals, setGoals] = useState(() => Array.from({ length: boards }, () => .5));
  const [message, setMessage] = useState("");
  const opening = db.byId.get(openingId);
  return <details className="mt-3 rounded-lg border border-navy-600 p-2">
    <summary className="cursor-pointer font-semibold">National federation training camp</summary>
    <div className="mt-2 space-y-2 text-sm">
      <p className="text-ink-muted">{country} · Opens 14 days before the tournament · 2 AP</p>
      {prior ? <><p>{db.byId.get(prior.openingId)?.name ?? prior.openingId}</p><p>Board targets · {prior.goals.join(" / ")}</p></> :
        days < 1 || days > 14 ? <p>The camp is available in the two weeks before play starts.</p> :
        <>
          <select aria-label="Team camp opening" value={openingId} onChange={event => setOpeningId(event.target.value)} className="w-full rounded-lg bg-navy-900 p-2">
            <option value="">Choose an opening to study</option>
            {db.entries.slice(0, 80).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <div className="flex flex-wrap gap-2">{goals.map((goal, index) => <label key={index}>
            Board {index + 1} <select value={goal} onChange={event => setGoals(current => current.map((value, i) => i === index ? Number(event.target.value) : value))} className="rounded-lg bg-navy-900 p-2">
              <option value={.5}>Draw · ½</option><option value={1}>Win · 1</option>
            </select>
          </label>)}</div>
          <Button disabled={!opening || save.player.ap.current < 2} onClick={() => {
            const state = useGameStore.getState();
            const current = state.save;
            if (!current || current.career.id !== save.career.id || !opening || current.teamCamps?.[entry.eventId]) return;
            if (current.retirement || state.calendarProgress || current.player.ap.current < 2) return;
            const booking = current.registrations.find(reg => reg.eventId === entry.eventId && reg.details?.format === "team");
            if (!booking) return;
            const remaining = bookedStart(booking) - gameDay(current);
            if (remaining < 1 || remaining > 14) return;
            const next = recordOpeningStudy(current, opening.id, opening.name, .75);
            useGameStore.setState({ save: {
              ...next, teamCamps: { ...next.teamCamps, [entry.eventId]: { openingId, goals } },
              player: { ...next.player, ap: { ...next.player.ap, current: next.player.ap.current - 2 } },
            } });
            setMessage("Team preparation completed.");
          }}>Attend camp</Button>
        </>}
      {message && <p role="status">{message}</p>}
    </div>
  </details>;
}
