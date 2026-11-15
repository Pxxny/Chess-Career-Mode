import { matchesVenueContinent } from "./venues";
import type { ScheduledEvent } from "@/game/world/schedule";
import { eventAgenda } from "./agenda";
export interface TournamentSearch {
  normOnly?:boolean;
  sort?:"date"|"value";
  qualification?: "all" | "required" | "qualifier" | "circuit";
  organizer?: "all" | "Official" | "Unofficial" | "Sponsor";
  duration?: "all" | "single" | "multi" | "3" | "7";
  pairing?: "all" | "rotation" | "bo3";
  fromWeek: number;
  toWeek: number;
  minElo: number;
  maxElo: number;
  continent: string;
  minPlayers: number;
  maxPlayers: number;
  availableOnly: boolean;
}
export function matchesTournamentSearch(
  event: ScheduledEvent,
  search: TournamentSearch,
): boolean {
  return (
    matchesQualificationFilter(event, search.qualification) &&
    matchesOrganizer(event,search.organizer) &&
    (!search.duration ||
      search.duration === "all" ||
      (search.duration === "single"
        ? eventAgenda(event).days === 1
        : search.duration === "multi"
          ? eventAgenda(event).days > 1
          : eventAgenda(event).days === Number(search.duration))) &&
    (!search.pairing ||
      search.pairing === "all" ||
      (search.pairing === "bo3"
        ? event.details?.format === "round-robin-bo3"
        : !!event.details?.format.includes("round-robin"))) &&
    event.weeksUntilStart >= search.fromWeek &&
    event.weeksUntilStart <= search.toWeek &&
    event.minElo >= search.minElo &&
    event.minElo <= search.maxElo &&
    event.fieldSize >= search.minPlayers &&
    event.fieldSize <= search.maxPlayers &&
    matchesVenueContinent(event.details?.country, search.continent)
  );
}
export function matchesQualificationFilter(event: ScheduledEvent, filter: TournamentSearch["qualification"] = "all") {
  return filter === "all" || (filter === "required" ? !!event.details?.qualification : filter === "qualifier" ? !!event.details?.qualificationCircuit?.advanceTop : !!event.details?.qualificationCircuit);
}

export function matchesOrganizer(event:ScheduledEvent,organizer:TournamentSearch['organizer']='all'){
 return organizer==='all'||(organizer==='Sponsor'?!!event.details?.organizer?.sponsorId:event.details?.organizer?.status===organizer);
}
export const isBackgroundCircuit=(record?:{source?:string;name?:string})=>record?.source==='world-circuit'||/^(World Circuit Open|World Masters|Simulated World Circuit)\b/i.test(record?.name??'');

/** Pre-event opportunity only; a norm still requires the actual opponents and performance. */
export function normOpportunity(save:import('@/types').GameSave,event:ScheduledEvent,npcs:import('@/types').Npc[]):boolean {
 if(event.details?.timeControl.category!=='classical'||(event.details?.rounds??7)<9||event.details?.format==='team')return false;
 const field=finderField(save,event,npcs);
 return field.length>=9&&new Set(field.map(n=>n.nationality)).size>=3&&field.filter(n=>['FM','IM','GM'].includes(n.title)).length>=3&&field.reduce((s,n)=>s+n.currentElo,0)/field.length>=2200;
}
export function tournamentValue(save:import('@/types').GameSave,event:ScheduledEvent):number {
 return (event.details?.prize??0)/Math.max(1,event.entryFee+finderTravel(save,event).cost)/Math.max(1,eventAgenda(event).days);
}
import { projectedEntrants as finderField } from '@/game/match/registration';
import { travelQuote as finderTravel } from './travel';
