import { seriesFinalists } from "./seasonSeries";
import { travelQuote } from "./travel";
import { teamSpec,teamInfoOf } from "@/data/chess/nationalTeamEvents";
import { teamSelection } from "./teamSelection";
import { registrationWindow } from "./registrationWindow";
import { circuitVisible, qualificationMatches, CIRCUIT_LABELS } from "./qualificationCircuit";
import type { ScheduledEvent } from "@/game/world/schedule";
import type { ChessTitle, GameSave, SkillTier } from "@/types";
import { competitionOf } from "./preparation";
import { teamEntryIssues } from "./teamEligibility";
import { stampIndex } from "./catalog";
import { registrationCount } from "./entries";
import { showcaseSelection } from "./showcase";
import type { Npc } from "@/types";
import { bookingConflict } from "@/game/esports/core";
import { bookedStart, bookedEnd, reservedUntil } from "./agenda";
const titles: ChessTitle[] = ["none", "CM", "FM", "IM", "GM"];
const leagues: SkillTier[] = [
  "beginner",
  "amateur",
  "club",
  "professional",
  "international-master",
  "grandmaster",
  "elite-grandmaster",
  "legendary",
];
export function eligibilityIssues(
  save: GameSave,
  event: ScheduledEvent,
): string[] {
  const issues: string[] = [];
  if (save.retirement) issues.push("Your competitive career has ended.");
  const d = event.details;
  if (!circuitVisible(save.player.country, d)) issues.push("Your federation's qualification circuit only");
  if (save.player.rating < event.minElo) issues.push(`${event.minElo}+ Elo`);
  if (save.player.reputation < event.minReputation)
    issues.push(`Reputation ${event.minReputation}+`);
  const title = save.history.titles.reduce(
    (best, t) => Math.max(best, titles.indexOf(t.title)),
    0,
  );
  if (d?.minimumTitle && title < titles.indexOf(d.minimumTitle))
    issues.push(`${d.minimumTitle} title`);
  if (
    d?.minimumLeague &&
    leagues.indexOf(save.player.league) < leagues.indexOf(d.minimumLeague)
  )
    issues.push(`${d.minimumLeague} league`);
  if (d?.nationality && save.player.country !== d.nationality)
    issues.push(`${d.nationality} nationality`);
  if (d?.federation && save.expansion?.membershipYear !== save.world.date.year)
    issues.push("Current federation membership");
  issues.push(...teamEntryIssues(save, d?.teamEvent));
  if (d?.maxAge !== undefined && save.player.age > d.maxAge)
    issues.push(`Age ${d.maxAge} or younger`);
  if (d?.gender === "male" && save.player.gender !== "male") issues.push("Men only");
  if (d?.gender === "female" && save.player.gender !== "female")
    issues.push("Women only");
  if (
    d?.qualification &&
    !competitionOf(save).qualifications.some(
      (q) => qualificationMatches(q, event, save.world.date.year),
    )
  )
    issues.push(`Previous qualification: ${CIRCUIT_LABELS[d.qualification] ?? d.qualification}`);
  return issues;
}
export function registrationIssue(
  save: GameSave,
  event: ScheduledEvent,
  npcs?: Npc[],
): string | null {
  if (
    !Number.isFinite(event.details?.travelCost ?? 0) ||
    (event.details?.travelCost ?? 0) < 0 ||
    !Number.isFinite(event.entryFee) ||
    event.entryFee < 0 ||
    !Number.isInteger(event.fieldSize) ||
    event.fieldSize < 2 ||
    event.fieldSize > 256 ||
    !Number.isInteger(event.week) ||
    event.week < 1 ||
    event.week > 52
  )
    return "Invalid event data.";
  if (registrationWindow(save, event).status === "upcoming")
    return "Registration has not opened yet.";
  if (
    stampIndex(save.world.date) > stampIndex(event.registrationDeadline) ||
    stampIndex(save.world.date) > stampIndex(event)
  )
    return "Registration deadline has passed.";
  if (
    save.tournament?.eventId === event.id ||
    save.registrations.some((r) => r.eventId === event.id) ||
    save.history.tournaments.some((t) => t.tournamentId === event.id)
  )
    return "You are already registered or have played this event.";
  if (
    save.registrations.some(
      (r) =>
        stampIndex(r) === stampIndex(event) &&
        (!r.details?.agenda?.exactStart || !event.details?.agenda?.exactStart),
    )
  )
    return "You already entered another competition starting this week.";
  if (bookingConflict(save, bookedStart(event), reservedUntil(event)))
    return "Schedule conflict with another traditional or esports event.";
  if (event.details?.pointsSeries?.stage === "final") {
    if (!npcs || !seriesFinalists(save, npcs, event.details).some(row => row.id === "player"))
      return "Season Finals are restricted to the highest points scorers.";
  } else if (event.details?.bulgariaChess) {
    if (npcs && npcs.filter(npc => (!event.details?.gender || npc.gender === event.details.gender) &&
      (npc.careerStatus === "active" || npc.careerStatus === "semi-retired")).length < 5) return "A six-player field is required.";
  } else if (event.details?.leagueDivision) {
    if (!npcs || event.details.invitedNpcIds?.length !== event.fieldSize - 1) return "The league roster is incomplete.";
  } else if (event.details?.showcase) {
    if (!npcs || !showcaseSelection(save, event, npcs).invited)
      return "Invitation only: the organizer has not selected you.";
  } else if (
    event.details?.format !== "team" &&
    registrationCount(save, event, npcs) >= event.fieldSize
  )
    return "This tournament is full.";
  const issues = eligibilityIssues(save, event);
  if (issues.length) return `Requires ${issues.join(", ")}.`;
  if(npcs&&npcs.length===0)return "Wait for the NPC world to finish loading.";
  const selection=teamSelection(save,event,npcs);
  if(selection?.issue)return selection.issue;
  if (save.player.money < event.entryFee + travelQuote(save,event).cost)
    return `Need $${event.entryFee + travelQuote(save,event).cost - save.player.money} more for entry and travel.`;
  return null;
}
export const requirementsText = (e: ScheduledEvent): string => {
  const spec=e.details?.format==='team'?teamSpec(teamInfoOf(e.details).key):undefined,maxAge=e.details?.maxAge??spec?.maxAge;
  return [
    `${e.minElo}+ Elo`,
    e.minReputation ? `reputation ${e.minReputation}+` : null,
    e.details?.minimumTitle ? `${e.details.minimumTitle} title` : null,
    e.details?.qualification
      ? `qualified for ${CIRCUIT_LABELS[e.details.qualification] ?? e.details.qualification}`
      : null,
    e.details?.nationality ? `${e.details.nationality} nationality` : null,
    e.details?.minimumLeague ? `${e.details.minimumLeague} league` : null,
    e.details?.federation ? "federation member" : null,
    maxAge!==undefined?`age ${maxAge} or younger`:null,
    e.details?.gender==='female'?'women only':e.details?.gender==='male'?'men only':null,
    spec?.minAge!==undefined?`age ${spec.minAge}+`:null,
    e.details?.format==='team'?"national-team starting-roster selection":null,
  ]
    .filter(Boolean)
    .join(" · ");
};

export function eligibilityFeedback(save:GameSave,event:ScheduledEvent,npcs?:Npc[]):Array<{text:string;to?:string;action?:string}> {
 if(!circuitVisible(save.player.country,event.details))return [{text:"Your federation's qualification circuit only"}];
 const result:Array<{text:string;to?:string;action?:string}>=[];
 if(save.player.rating<event.minElo)result.push({text:`Need ${event.minElo-save.player.rating} more Elo · ${event.minElo} required`,to:'/train',action:'Train'});
 if(save.player.reputation<event.minReputation)result.push({text:`Need ${event.minReputation-save.player.reputation} more reputation`,to:'/complete',action:'Find a tournament'});
 const owned=save.history.titles.reduce((best,t)=>Math.max(best,titles.indexOf(t.title)),0);
 if(event.details?.minimumTitle&&owned<titles.indexOf(event.details.minimumTitle))result.push({text:`Requires ${event.details.minimumTitle} title`,to:'/career?view=championship',action:'Title requirements'});
 if(event.details?.qualification&&!competitionOf(save).qualifications.some(q=>qualificationMatches(q,event,save.world.date.year)))result.push({text:`Qualification required · ${CIRCUIT_LABELS[event.details.qualification]??event.details.qualification}`,to:'/career?view=championship',action:'Qualification path'});
 if(event.details?.federation&&save.expansion?.membershipYear!==save.world.date.year)result.push({text:'Renew federation membership for this year',to:'/complete?section=teams',action:'Federation & national teams'});
 const selection=teamSelection(save,event,npcs);if(selection?.issue)result.push({text:selection.issue,to:'/complete?section=teams',action:'Team selection & boards'});
 const cost=event.entryFee+travelQuote(save,event).cost;if(save.player.money<cost)result.push({text:`Need $${cost-save.player.money} more · entry & travel $${cost}`,to:'/train?tab=work',action:'Work & earn money'});
 const issue=registrationIssue(save,event,npcs);
 if(issue&&!result.length)result.push({text:issue});
 return result;
}
