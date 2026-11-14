import { esportsStandings } from "@/game/esports/core";
import { standings } from "@/game/match/tournament";
import { hasOpeningCeremony } from "@/game/competition/presentation";
import { z } from "zod";
import type { GameSave, Npc } from "@/types";
import { registrationStates } from "@/game/match/registration";
import { buildEventTeams } from "@/game/competition/teamEvents";
import { teamInfoOf } from "@/data/chess/nationalTeamEvents";
import { CIRCUIT_LABELS } from "@/game/competition/qualificationCircuit";

export const ceremonySchema = z.object({phase:z.enum(['opening','award']),sponsor:z.string().optional(),location:z.string().optional(),podium:z.array(z.object({name:z.string(),rank:z.number(),points:z.number().optional()})),playerRank:z.number().optional(),prize:z.number().optional()});
export const articleSchema = z.object({
  id: z.string(), kind: z.enum(["trophy", "national", "title", "qualification", "opening", "award"]),
  year: z.number().int(), week: z.number().int().min(1).max(52), day: z.number().int().min(1).max(7),
  headline: z.string(), body: z.string(), event: z.string(),
  eventId: z.string().optional(),
  ceremony: ceremonySchema.optional(),
  qualification: z.enum(["continental", "world-cup", "grand-swiss", "candidates", "world-championship", "super-invitation", "circuit-national", "circuit-continental", "circuit-world"]).optional(),
});
export type CareerArticle = z.infer<typeof articleSchema>;
export const highlightsSchema = z.object({ items: z.array(articleSchema), seen: z.array(z.string()), unread: z.array(z.string()) });
export type CareerHighlights = z.infer<typeof highlightsSchema>;
export const highlightsOf = (save: GameSave): CareerHighlights => highlightsSchema.safeParse(save.highlights).data ?? { items: [], seen: [], unread: [] };
export function acknowledgeArticle(save: GameSave, id: string): GameSave {
  const state = highlightsOf(save);
  return { ...save, highlights: { ...state, unread: state.unread.filter((key) => key !== id) } };
}

/** Compare completed actions, never infer a win from ratings or replay an old headline. */
export function captureHighlights(before: GameSave, after: GameSave, npcs: Npc[] = []): GameSave {
  if (before.career.id !== after.career.id) return after;
  const previous = highlightsOf(after), state = { items: [...previous.items], seen: [...previous.seen], unread: [...previous.unread] };
  const add = (id: string, kind: CareerArticle["kind"], event: string, headline: string, body: string, destination: Pick<CareerArticle, "eventId" | "qualification" | "ceremony"> = {}) => {
    if (state.seen.includes(id)) return;
    state.seen.push(id);
    state.items.push({ id, kind, event, headline, body, ...destination, ...after.world.date, day: after.world.day ?? 1 });
    state.unread.push(id);
  };
  const active=after.tournament;
  if(active?.status==='playing'&&hasOpeningCeremony(active)&&(before.tournament?.eventId!==active.eventId||active.round===1)){
    add(`opening:${active.year}:${active.eventId}`,'opening',active.name,`Opening ceremony · ${active.name}`,`The players gather for the opening ceremony at ${active.details?.location??'the tournament venue'}. The competition is ready to begin.`,{eventId:active.eventId,ceremony:{phase:'opening',sponsor:active.details?.sponsorship?.name??active.details?.qualificationCircuit?.sponsor,location:active.details?.location,podium:[]}});
  }
  for (const t of after.history.tournaments) {
    if (before.history.tournaments.some((old) => old.tournamentId === t.tournamentId && old.year === t.year)) continue;
    const finished=[...(after.competition?.archive??[]),...(active?.status==='finished'?[active]:[])].find(x=>x.eventId===t.tournamentId);
    if(finished?.withdrawn)continue;
    const podium=finished?standings(finished).slice(0,3).map(r=>({name:r.player.name,rank:r.rank,points:r.player.points})):[];
    add(t.rank===1?`win:${t.year}:${t.tournamentId}`:`award:${t.year}:${t.tournamentId}`,t.rank===1?'trophy':'award',t.name,
      t.rank===1?`${after.player.name} wins ${t.name}`:`Award ceremony · ${t.name}`,
      `${after.player.name} finished #${t.rank} out of ${t.fieldSize} players at ${t.name}, scoring ${t.points} points. ${podium.length?`Champion: ${podium[0].name}. `:''}Career Elo: ${after.player.rating}. The tournament result is saved.`,{eventId:t.tournamentId,ceremony:{phase:'award',podium,playerRank:t.rank,prize:finished?.prize??0,sponsor:finished?.details?.sponsorship?.name??finished?.details?.qualificationCircuit?.sponsor,location:finished?.details?.location}});
  }
  for (const t of after.history.titles) {
    if (before.history.titles.some((old) => old.title === t.title)) continue;
    add(`title:${t.title}`, "title", t.title, `${after.player.name} earns the ${t.title} title`,
      `A new career title has been confirmed: ${t.title}. Peak Elo: ${after.player.peakRating}. This achievement is recorded in your career history.`);
  }
  const qualificationNames = { continental: "Continental Championship", "world-cup": "World Cup", "grand-swiss": "Grand Swiss", candidates: "Candidates", "world-championship": "World Championship", "super-invitation": "Super-tournament invitation" };
  for (const q of after.competition?.qualifications ?? []) {
    if ((before.competition?.qualifications ?? []).some((old) => old.kind === q.kind && old.year === q.year && old.source === q.source)) continue;
    add(`qualification:${q.year}:${q.kind}:${q.source}`, "qualification", q.source,
      `${after.player.name} qualifies for ${CIRCUIT_LABELS[q.kind] ?? qualificationNames[q.kind as keyof typeof qualificationNames]}`,
      `Your result at ${q.source} earned qualification for ${CIRCUIT_LABELS[q.kind] ?? qualificationNames[q.kind as keyof typeof qualificationNames]}. Check the championship path for entry requirements and the qualification expiry.`, { qualification: q.kind, eventId: q.eventId });
  }
  const ea=after.esports?.active;
  if(ea?.status==='playing'&&['A','S'].includes(ea.event.tier)&&before.esports?.active?.event.id!==ea.event.id)add(`esports-opening:${ea.event.id}`,'opening',ea.event.name,`Opening ceremony · ${ea.event.name}`,`The teams gather for the opening of ${ea.event.name}.`,{eventId:ea.event.id,ceremony:{phase:'opening',podium:[]}});
  const esports = [...(after.esports?.history ?? []), ...(after.esports?.active?.status === "finished" ? [after.esports.active] : [])];
  for (const c of esports) {
    const old = [...(before.esports?.history ?? []), ...(before.esports?.active ? [before.esports.active] : [])];
    if(c.status!=='finished'||c.withdrawn||old.some(t=>t.event.id===c.event.id&&t.status==='finished'))continue;
    const ceremony={phase:'award' as const,podium:esportsStandings(c).slice(0,3).map((r,i)=>({name:r.team.name,rank:i+1,points:r.points})),playerRank:c.rank??undefined,prize:c.playerPrize};
    if(c.rank!==1){add(`esports-award:${c.event.id}`,'award',c.event.name,`Award ceremony · ${c.event.name}`,`Your team finished #${c.rank} at ${c.event.name}. Your prize share: $${c.playerPrize}.`,{eventId:c.event.id,ceremony});continue;}
    add(`esports:${c.event.id}`, "trophy", c.event.name, `${after.player.name} wins ${c.event.name}`,
      `Your team finished first at ${c.event.name}. Your prize share: $${c.playerPrize}. The team result is saved in your career.`,{eventId:c.event.id,ceremony});
  }
  for (const cup of after.expansion?.cups ?? []) {
    if (!cup.represented || (before.expansion?.cups ?? []).some((c) => c.year === cup.year && c.key === cup.key)) continue;
    const home = cup.teams.findIndex((t) => t.country === after.player.country);
    add(`team-award:${cup.year}:${cup.key??'olympiad'}`,'award',cup.name??'National team event',`Award ceremony · ${cup.name??'National team event'}`,`The national teams gather for the medal presentation. Your federation finished #${home+1}.`,{ceremony:{phase:'award',podium:cup.teams.slice(0,3).map((team,i)=>({name:team.country,rank:i+1})),playerRank:home+1}});
    if (!state.items.some((a) => a.kind === "national" && a.year === cup.year && a.event.includes(cup.name ?? "National team event"))) add(`national-played:${cup.year}:${cup.key ?? "olympiad"}`, "national", cup.name ?? "National team event",
      `${after.player.name} represents the national team`,
      `You represented your federation at ${cup.name ?? "National team event"}. Your team finished #${home + 1}. National team results are saved separately from individual Elo.`);
    if (home === 0) add(`national-win:${cup.year}:${cup.key ?? "olympiad"}`, "trophy", cup.name ?? "National team event",
      `${after.player.name} wins ${cup.name ?? "National team event"}`,
      `Your national team finished first at ${cup.name ?? "National team event"}. Your contribution and the team standings are recorded in your career.`);
  }
  // Stop BEFORE starting a registered national event, while the selected roster is current.
  for (const r of registrationStates(after)) {
    const id = `national-selected:${r.eventId}`;
    if (r.status !== "ready" || r.details?.format !== "team" || state.seen.includes(id) || !npcs.length) continue;
    const home = buildEventTeams(after, npcs, teamInfoOf(r.details)).find((t) => t.country === after.player.country);
    if (!home?.players.some((p) => p.id === "player")) continue;
    if(hasOpeningCeremony({details:r.details}))add(`team-opening:${r.eventId}`,'opening',r.name,`Opening ceremony · ${r.name}`,`Your selected national team joins the opening ceremony. The registered competition is ready to begin.`,{eventId:r.eventId,ceremony:{phase:'opening',podium:[],location:r.details?.location,sponsor:r.details?.sponsorship?.name??r.details?.qualificationCircuit?.sponsor}});
    add(id, "national", r.name, `${after.player.name} selected for the national team`,
      `You have been selected for the starting roster at ${r.name}. The registered event is ready to begin. Simulation paused before the team competition starts.`, { eventId: r.eventId });
  }
  if (state.items.length === previous.items.length) return after;
  const keep = state.items.filter((a, i) => i >= state.items.length - 300 || state.unread.includes(a.id));
  return { ...after, highlights: { ...state, items: keep } };
}
