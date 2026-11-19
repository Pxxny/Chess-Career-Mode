import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { earnedEntries } from "@/game/competition/earnedEntries";
import { bookedStart, dayLabel, gameDay, tournamentSlot } from "@/game/competition/agenda";
import { registrationWindow } from "@/game/competition/registrationWindow";
import { seriesFinalists } from "@/game/competition/seasonSeries";
import { useNpcs } from "@/hooks/useNpcs";
import { systemsOf } from "@/game/career/systems";
import { registrationStates } from "@/game/match/registration";
import type { ScheduledEvent } from "@/game/world/schedule";
import type { GameSave } from "@/types";

export function CareerInbox({ save, schedule }: { save: GameSave; schedule: ScheduledEvent[] }) {
  const today = gameDay(save);
  const npcs = useNpcs();
  const registration = "/complete?section=registrations";
  const registrations = registrationStates(save).filter(item => item.status !== "missed")
    .sort((a, b) => bookedStart(a) - bookedStart(b));
  const active = save.tournament?.status === "playing" ? save.tournament : null;
  const invitations = earnedEntries(save, schedule);
  const pointsInvitations = schedule.filter(event => event.details?.pointsSeries?.stage === "final" &&
    registrationWindow(save, event).status === "open" &&
    !save.registrations.some(entry => entry.eventId === event.id) &&
    seriesFinalists(save, npcs, event.details).some(row => row.id === "player"));
  const queued = new Set(systemsOf(save).queue.map(item => item.eventId));
  const deadlines = new Map([...schedule.filter(event => queued.has(event.id)), ...invitations.map(item => item.event), ...pointsInvitations].map(event => [event.id, event]));
  const groups = [
    { label: "Play next", rows: [
      ...(active ? [{ id: active.eventId, name: active.name, detail: dayLabel(tournamentSlot(active).absoluteDay), to: active.details?.leagueDivision ? "/complete?tab=league" : "/complete" }] : []),
      ...registrations.map(item => ({ id: item.eventId, name: item.name, detail: dayLabel(bookedStart(item)), to: item.details?.leagueDivision ? "/complete?tab=league" : registration })),
    ] },
    { label: "Qualified · Claim entry", rows: [
      ...invitations.map(({ event }) => ({ id: event.id, name: event.name, detail: dayLabel(bookedStart(event)), to: registration })),
      ...pointsInvitations.map(event => ({ id: event.id, name: event.name, detail: dayLabel(bookedStart(event)), to: `/complete?event=${encodeURIComponent(event.id)}` })),
    ] },
    { label: "Registration deadlines", rows: [...deadlines.values()].flatMap(event => {
      const window = registrationWindow(save, event);
      if (window.close < today) return [];
      return [{ id: event.id, name: event.name, detail: dayLabel(window.close), to: `/complete?event=${encodeURIComponent(event.id)}` }];
    }) },
  ];
  const count = groups.reduce((total, group) => total + group.rows.length, 0);
  return <details className="mb-3 rounded-xl border border-navy-600 bg-navy-800 p-3">
    <summary className="min-h-9 cursor-pointer list-none font-semibold"><Bell size={17} className="mr-2 inline" aria-hidden /> Career inbox · {count}</summary>
    <div className="mt-2 grid gap-3 sm:grid-cols-3">
      {groups.map(group => <section key={group.label} className="rounded-lg bg-navy-900 p-3">
        <h2 className="mb-1 text-sm font-semibold">{group.label}</h2>
        {group.rows.length ? group.rows.map(row => <Link key={row.id} to={row.to} className="block rounded-lg py-2 text-sm hover:text-gold-300">
          <span translate="no">{row.name}</span><span className="block text-xs text-ink-muted">{row.detail}</span>
        </Link>) : <p className="text-xs text-ink-muted">Nothing due here.</p>}
      </section>)}
    </div>
  </details>;
}
