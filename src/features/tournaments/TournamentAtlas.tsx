import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Button, Card, CardTitle } from "@/components/ui";
import { getCountry } from "@/data/world/countries";
import { bookedStart, dayLabel } from "@/game/competition/agenda";
import { normalizeText } from "@/utils/text";
import { GameAtlas } from "./GameAtlas";
import type { ScheduledEvent } from "@/game/world/schedule";
import type { AtlasCity } from "@/game/world/gameAtlas";

type AtlasProps = { events: ScheduledEvent[]; onDetails: (event: ScheduledEvent) => void };

export default function TournamentAtlas({ events, onDetails }: AtlasProps) {
  const [eventId, setEventId] = useState("");
  const [limit, setLimit] = useState(30);
  const active = events.find(event => event.id === eventId) ?? events[0];
  return <div className="workspace-atlas grid items-start gap-3 lg:grid-cols-[minmax(225px,1fr)_minmax(0,2.2fr)]" data-testid="tournament-atlas">
    <Card className="p-4 sm:p-4">
      <CardTitle>Scheduled events</CardTitle>
      <ul className="max-h-56 overflow-y-auto lg:max-h-[30rem]">
        {events.slice(0, limit).map(event => <li key={event.id} className="border-b border-navy-600/60">
          <button type="button" aria-pressed={active?.id === event.id} onClick={() => setEventId(event.id)}
            className="flex min-h-12 w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-navy-700 aria-pressed:bg-navy-700 aria-pressed:text-gold-300">
            <MapPin size={15} aria-hidden className="shrink-0" />
            <span className="min-w-0">
              <span className="block break-words text-sm font-semibold" translate="no">{event.name}</span>
              <span className="block text-xs text-ink-muted">{dayLabel(bookedStart(event)).slice(0, 10)} · {event.details?.location}</span>
            </span>
          </button>
        </li>)}
      </ul>
      {limit < events.length && <Button className="mt-2" variant="secondary" onClick={() => setLimit(count => count + 30)}>Show more tournaments</Button>}
    </Card>
    {active ? <AtlasEvent key={active.id} event={active} onDetails={() => onDetails(active)} /> :
      <Card>No tournaments match these filters.</Card>}
  </div>;
}

function AtlasEvent({ event, onDetails }: { event: ScheduledEvent; onDetails: () => void }) {
  const [cities, setCities] = useState<AtlasCity[]>([]);
  const [selected, setSelected] = useState<AtlasCity | null>(null);
  const country = event.details?.country ?? "";
  const online = event.details?.host?.mode === "online";
  const host = cities.find(city => normalizeText(city[0]) === normalizeText(event.details?.location ?? "")) ?? null;

  useEffect(() => {
    if (online || !country) return;
    const request = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/venue-cities.json`, { signal: request.signal })
      .then(response => response.ok ? response.json() : {})
      .then((data: Record<string, AtlasCity[]>) => setCities(data[country] ?? []))
      .catch(() => {});
    return () => request.abort();
  }, [country, online]);

  return <Card className="p-4 sm:p-4">
    <CardTitle><span translate="no">{event.name}</span></CardTitle>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="min-w-0 text-sm text-ink-muted">{online ? "Online event" : [event.details?.location, getCountry(country)?.name].filter(Boolean).join(" · ")}</p>
      <Button variant="secondary" onClick={onDetails}>View tournament</Button>
    </div>
    {!online && <GameAtlas country={country} cities={cities} selected={selected ?? host} host={host} onSelect={setSelected} />}
  </Card>;
}
