import { z } from "zod";
import type { GameSave, Npc } from "@/types";
import { registrationStates } from "@/game/match/registration";
import { buildEventTeams } from "@/game/competition/teamEvents";
import { teamInfoOf } from "@/data/chess/nationalTeamEvents";

export const articleSchema = z.object({
  id: z.string(), kind: z.enum(["trophy", "national", "title", "qualification"]),
  year: z.number().int(), week: z.number().int().min(1).max(52), day: z.number().int().min(1).max(7),
  headline: z.string(), body: z.string(), event: z.string(),
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
  const add = (id: string, kind: CareerArticle["kind"], event: string, headline: string, body: string) => {
    if (state.seen.includes(id)) return;
    state.seen.push(id);
    state.items.push({ id, kind, event, headline, body, ...after.world.date, day: after.world.day ?? 1 });
    state.unread.push(id);
  };
  for (const t of after.history.tournaments) {
    if (t.rank !== 1 || before.history.tournaments.some((old) => old.tournamentId === t.tournamentId && old.year === t.year)) continue;
    add(`win:${t.year}:${t.tournamentId}`, "trophy", t.name,
      `${after.player.name} wins ${t.name}`,
      `${after.player.name} finished first out of ${t.fieldSize} players at ${t.name}, scoring ${t.points} points. Career Elo: ${after.player.rating}. The tournament result is saved.`);
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
      `${after.player.name} qualifies for ${qualificationNames[q.kind]}`,
      `Your result at ${q.source} earned qualification for ${qualificationNames[q.kind]}. Check the championship path for entry requirements and the qualification expiry.`);
  }
  const esports = [...(after.esports?.history ?? []), ...(after.esports?.active?.status === "finished" ? [after.esports.active] : [])];
  for (const c of esports) {
    const old = [...(before.esports?.history ?? []), ...(before.esports?.active ? [before.esports.active] : [])];
    if (c.rank !== 1 || c.withdrawn || old.some((t) => t.event.id === c.event.id && t.status === "finished")) continue;
    add(`esports:${c.event.id}`, "trophy", c.event.name, `${after.player.name} wins ${c.event.name}`,
      `Your team finished first at ${c.event.name}. Your prize share: $${c.playerPrize}. The team result is saved in your career.`);
  }
  for (const cup of after.expansion?.cups ?? []) {
    if (!cup.represented || (before.expansion?.cups ?? []).some((c) => c.year === cup.year && c.key === cup.key)) continue;
    const home = cup.teams.findIndex((t) => t.country === after.player.country);
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
    add(id, "national", r.name, `${after.player.name} selected for the national team`,
      `You have been selected for the starting roster at ${r.name}. The registered event is ready to begin. Simulation paused before the team competition starts.`);
  }
  if (state.items.length === previous.items.length) return after;
  const keep = state.items.filter((a, i) => i >= state.items.length - 300 || state.unread.includes(a.id));
  return { ...after, highlights: { ...state, items: keep } };
}
