import { useContext } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import thLocale from "@fullcalendar/core/locales/th";
import { LanguageContext } from "@/i18n/context";
import { dayLabel } from "@/game/competition/agenda";

export default function SeasonCalendar({ year, events, onSelect }: {
  year: number; events: { id: string; name: string; start: number; end: number }[]; onSelect: (id: string) => void;
}) {
  const language = useContext(LanguageContext);
  return <div className="career-calendar surface-card rounded-2xl border border-white/10 bg-navy-800 p-2 sm:p-5" data-testid="season-month-calendar">
    <FullCalendar key={year} plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" initialDate={`${year}-01-01`} locales={[thLocale]} locale={language === "th" ? "th" : "en"}
      validRange={{ start: `${year}-01-01`, end: `${year + 1}-01-01` }} height="auto" fixedWeekCount={false} dayMaxEvents={2}
      headerToolbar={{ left: "prev,next", center: "title", right: "" }}
      events={events.map((event) => ({ id: event.id, title: event.name, start: dayLabel(event.start).slice(0, 10), end: dayLabel(event.end + 1).slice(0, 10), allDay: true }))}
      eventClick={(info) => { info.jsEvent.preventDefault(); onSelect(info.event.id); }} />
  </div>;
}
