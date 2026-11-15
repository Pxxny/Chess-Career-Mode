import type { GameSave } from '@/types';
import type { ScheduledEvent } from '@/game/world/schedule';
import { annualEvents } from './worldCalendar';
import { competitionOf } from './preparation';
import { eligibilityIssues } from './eligibility';
import { qualificationMatches,circuitVisible } from './qualificationCircuit';
import { registrationWindow } from './registrationWindow';
import { CHAMPIONSHIP_ADVANCEMENTS } from './advancement';
export type RouteStatus='playing'|'registered'|'qualified'|'completed'|'available'|'locked'|'closed';
export interface PathStep {id:string;title:string;event:ScheduledEvent;status:RouteStatus;rank?:number;issues:string[];qualificationSource?:string;}
export interface PathLink {id:string;source:string;target:string;top:number;rollDown:boolean;earned:boolean;playerAlreadyQualified:boolean;}
export interface QualificationPath {steps:PathStep[];links:PathLink[];currentId?:string;year:number;sponsored:boolean;}
export function seasonPreview(save:GameSave,year:number):GameSave {
 return year===save.world.date.year?save:{...save,world:{...save.world,date:{year,week:1},day:1}};
}
export function qualificationPath(save:GameSave,year=save.world.date.year,series?:string,localId?:string,openId?:string):QualificationPath {
 const events=annualEvents(save,year),preview=seasonPreview(save,year),state=competitionOf(save),sponsored=series!==undefined;
 let selected:ScheduledEvent[];
 if(sponsored){
  const route=events.filter(e=>e.details?.qualificationCircuit?.seriesId===series&&circuitVisible(save.player.country,e.details));
  const locals=route.filter(e=>e.details?.qualificationCircuit?.stage==='local');
  const selectedLocal=locals.find(e=>e.id===localId)??locals.find(e=>save.tournament?.status==='playing'&&save.tournament.eventId===e.id)??locals.find(e=>save.registrations.some(r=>r.eventId===e.id))??locals.find(e=>registrationWindow(save,e).status!=='closed')??locals[0];
  selected=route.filter(e=>e.details?.qualificationCircuit?.stage!=='local'||e===selectedLocal).sort((a,b)=>a.week-b.week);
 }else {
  selected=['Open Tournaments','National Championships','Continental Championships','World Cup','Grand Swiss','Candidates Tournament','World Chess Championship'].flatMap(category=>{
   const choices=events.filter(e=>e.details?.category===category);
   const event=category==='Open Tournaments'?(choices.find(e=>e.id===openId)??choices.find(e=>save.tournament?.status==='playing'&&e.id===save.tournament.eventId)??choices.find(e=>save.registrations.some(r=>r.eventId===e.id))??choices.find(e=>registrationWindow(save,e).status!=='closed'&&!eligibilityIssues(preview,e).length)??choices[0]):choices.find(e=>e.id.startsWith('career-'));
   return event?[event]:[];
  });
 }
 const steps=selected.map((event):PathStep=>{
  const active=save.tournament?.eventId===event.id?save.tournament:undefined;
  const result=save.history.tournaments.find(t=>t.tournamentId===event.id&&t.year===year);
  const archive=state.archive.find(t=>t.eventId===event.id&&t.year===year&&!t.withdrawn);
  const qualification=state.qualifications.find(q=>qualificationMatches(q,event,year));
  const issues=eligibilityIssues(preview,event);
  const status:RouteStatus=active?.status==='playing'?'playing':save.registrations.some(r=>r.eventId===event.id)?'registered':result||archive?'completed':qualification?'qualified':registrationWindow(save,event).status==='closed'?'closed':issues.length?'locked':'available';
  return {id:event.id,title:event.details?.qualificationCircuit?.stage??event.details?.category??event.name,event,status,rank:result?.rank??archive?.finalRank??undefined,issues,qualificationSource:qualification?.source};
 });
 const links:PathLink[]=[];
 for(const source of steps){
  const circuit=source.event.details?.qualificationCircuit;
  for(const target of steps){
   const rule=sponsored?(circuit?.targetEventId===target.id&&circuit.advanceTop?{top:circuit.advanceTop}:undefined):CHAMPIONSHIP_ADVANCEMENTS.find(r=>r.category===source.event.details?.category&&r.kind===target.event.details?.qualification&&source.id!==target.id);
   if(!rule)continue;
   const earned=state.qualifications.some(q=>q.source===source.event.name&&qualificationMatches(q,target.event,year));
   links.push({id:`${source.id}:${target.id}`,source:source.id,target:target.id,top:rule.top,rollDown:sponsored,earned,playerAlreadyQualified:!!state.circuitAwards?.[target.id]?.includes("player")||state.qualifications.some(q=>qualificationMatches(q,target.event,year))});
  }
 }
 const current=steps.find(s=>s.status==='playing')??steps.find(s=>s.status==='registered')??[...steps].reverse().find(s=>s.status==='qualified')??steps.find(s=>s.status==='available')??[...steps].reverse().find(s=>s.status==='completed')??steps[0];
 return {steps,links,currentId:current?.id,year,sponsored};
}
