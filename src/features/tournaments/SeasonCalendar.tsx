import { useContext, useMemo, useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import thLocale from '@fullcalendar/core/locales/th';
import { LanguageContext } from '@/i18n/context';
import { useSave } from '@/hooks/useGame';
import { formatMoney } from '@/utils/format';
import { registrationWindow } from '@/game/competition/registrationWindow';
import { dayLabel } from '@/game/competition/agenda';
import { Button } from '@/components/ui';
import { eventAccent } from '@/game/competition/visuals';
import type { ScheduledEvent } from '@/game/world/schedule';
import type { EventDetails } from '@/game/competition/types';
interface CalendarItem {id:string;name:string;start:number;end:number;details?:EventDetails;level?:string;event?:ScheduledEvent;}
export default function SeasonCalendar({year,events,onSelect}:{year:number;events:CalendarItem[];onSelect:(id:string)=>void}) {
 const save=useSave();
 const [displayMonth,setDisplayMonth]=useState(`${year}-01`);
 const language=useContext(LanguageContext),[view,setView]=useState<'month'|'timeline'>('month'),[month,setMonth]=useState(0);
 const [visible,setVisible]=useState(100);
 useEffect(()=>setVisible(100),[month,year,events,displayMonth]);
 const from=year*364+month*28,to=Math.min((year+1)*364-1,from+27);
 const rows=useMemo(()=>events.filter(e=>e.start<=to&&e.end>=from).sort((a,b)=>a.start-b.start||b.end-a.end),[events,from,to]);
 const monthEvents=useMemo(()=>events.filter(event=>dayLabel(event.start).slice(0,7)===displayMonth)
   .sort((a,b)=>a.start-b.start),[events,displayMonth]);
 return <div className="career-calendar surface-card rounded-2xl border border-white/10 bg-navy-800 p-2 sm:p-5" data-testid="season-month-calendar">
 <div className="mb-4 flex flex-wrap justify-between gap-2"><div className="flex gap-2"><Button variant={view==='month'?'primary':'secondary'} onClick={()=>setView('month')}>Calendar</Button><Button variant={view==='timeline'?'primary':'secondary'} onClick={()=>setView('timeline')}>Timeline</Button></div>{view==='timeline'&&<div className="flex items-center gap-2"><Button variant="secondary" aria-label="Previous timeline period" disabled={month===0} onClick={()=>setMonth(month-1)}>←</Button><span className="text-sm">{dayLabel(from).slice(0,10)} — {dayLabel(to).slice(0,10)}</span><Button variant="secondary" aria-label="Next timeline period" disabled={month===12} onClick={()=>setMonth(month+1)}>→</Button></div>}</div>
 {view==='month'?<FullCalendar key={year} plugins={[dayGridPlugin,interactionPlugin]} initialView="dayGridMonth" initialDate={`${year}-01-01`} locales={[thLocale]} locale={language==='th'?'th':'en'} validRange={{start:`${year}-01-01`,end:`${year+1}-01-01`}} height="auto" fixedWeekCount={false} dayMaxEvents={2} headerToolbar={{left:'prev,next',center:'title',right:''}} events={events.map(e=>({id:e.id,title:e.name,start:dayLabel(e.start).slice(0,10),end:dayLabel(e.end+1).slice(0,10),allDay:true,backgroundColor:eventAccent(e.details,e.level).color,borderColor:eventAccent(e.details,e.level).color,textColor:'#14221a'}))} datesSet={info=>{const date=info.view.currentStart;setDisplayMonth(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`);}} eventClick={info=>{info.jsEvent.preventDefault();onSelect(info.event.id);}}/>:
 <div className="max-h-[36rem] overflow-auto" data-testid="season-timeline"><div className="min-w-[700px]"><div className="sticky top-0 z-10 grid grid-cols-[220px_1fr] bg-navy-800 pb-2 text-xs"><span>Tournament</span><div className="grid grid-cols-4">{[0,7,14,21].map(n=><span key={n}>{dayLabel(from+n).slice(5,10)}</span>)}</div></div>{rows.slice(0,visible).map(e=>{const accent=eventAccent(e.details,e.level),start=Math.max(from,e.start),end=Math.min(to,e.end);return <button key={e.id} onClick={()=>onSelect(e.id)} className="grid min-h-12 w-full grid-cols-[220px_1fr] items-center border-t border-white/5 text-left" title={`${e.name} · ${dayLabel(e.start)} – ${dayLabel(e.end)}`}><span className="truncate pr-3 text-xs">{e.name}</span><span className="relative h-9 bg-[repeating-linear-gradient(90deg,transparent,transparent_calc(25%_-_1px),#8882_calc(25%_-_1px),#8882_25%)]"><span className="absolute top-1 h-7 min-w-2 truncate rounded px-2 py-1 text-xs font-semibold text-[#14221a]" style={{background:accent.color,left:`${(start-from)/28*100}%`,width:`${(end-start+1)/28*100}%`}}>{accent.label}</span></span></button>})}{visible<rows.length&&<Button variant="secondary" onClick={()=>setVisible(visible+100)}>Show more tournaments</Button>}{!rows.length&&<p className="py-8 text-center text-ink-muted">No tournaments in this period</p>}</div></div>}
 {view === "month" && <section className="mt-5">
   <h2 className="mb-2 font-display text-xl">Scheduled events</h2>
   {monthEvents.length ? <ul className="max-h-80 divide-y divide-navy-600 overflow-y-auto">
     {monthEvents.slice(0,visible).map(event => <li key={event.id}>
       <button onClick={()=>onSelect(event.id)} className="grid min-h-14 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg p-2 text-left hover:bg-navy-700">
         <span className="rounded-lg bg-navy-700 p-2 text-sm font-bold text-gold-300">{dayLabel(event.start).slice(8,10)}</span>
         <span className="min-w-0"><strong className="block text-sm" translate="no">{event.name}</strong>
         <span className="text-xs text-ink-muted">{eventAccent(event.details,event.level).label}
           {event.details?.prize !== undefined && ` · ${formatMoney(event.details.prize)}`}
           {save.registrations.some(entry=>entry.eventId===event.id) ? <span> · Registered</span>
             : event.event && registrationWindow(save, event.event).status === "open" && <span> · Registration open</span>}
         </span></span>
       </button>
     </li>)}
   </ul> : <p className="text-sm text-ink-muted">No tournaments in this period</p>}
   {visible < monthEvents.length && <Button variant="secondary" onClick={()=>setVisible(visible+100)}>Show more tournaments</Button>}
 </section>}
 <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-ink-muted">{[{color:'#8eaa84',label:'Open'},{color:'#b0b96d',label:'National'},{color:'#7aa6d1',label:'International'},{color:'#d6b65b',label:'Elite'},{color:'#c29be8',label:'Qualification'},{color:'#70a6da',label:'National teams'},{color:'#e29b70',label:'Sponsor'}].map(item=><span key={item.label} className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{background:item.color}}/>{item.label}</span>)}</div>
 </div>;
}
