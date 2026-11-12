import { GAME_CONFIG } from "@/data/config";
import type { GameSave, Npc } from "@/types";
import { gameDay } from "@/game/competition/agenda";
export interface SharedMemory {
  id: string;
  npcId: string;
  day: number;
  kind: "rated" | "talk" | "study" | "friendly";
  outcome?: string;
  event?: string;
}
export function remember(
  s: GameSave,
  memory: Omit<SharedMemory, "day">,
): GameSave {
  if (!s.social || s.social.memories?.some((m) => m.id === memory.id)) return s;
  return {
    ...s,
    social: {
      ...s.social,
      memories: [
        ...(s.social.memories ?? []),
        { ...memory, day: gameDay(s) },
      ].slice(-2000),
    },
  };
}
export function sharedMemories(s: GameSave, npcId: string) {
  const saved = s.social?.memories ?? [];
  const ids = new Set(saved.map((m) => m.id));
  const retained = s.history.games
    .filter((g) => g.opponentId === npcId && !ids.has(`rated-${g.id}`))
    .map((g) => ({
      id: `rated-${g.id}`,
      npcId,
      day: (g.year * 52 + g.week - 1) * 7,
      kind: "rated" as const,
      outcome: g.outcome,
      event: g.tournamentName ?? undefined,
    }));
  return [...retained, ...saved.filter((m) => m.npcId === npcId)]
    .sort((a, b) => b.day - a.day)
    .slice(0, 12);
}
export function rivalryLabel(s: GameSave, npcId: string) {
  const r = s.social?.relationships[npcId];
  if (!r || r.ratedGames < 3) return "No established rivalry";
  if (r.ratedGames >= 5 && Math.abs(r.wins - r.losses) <= 2)
    return "Closely matched rivals";
  return r.ratedGames >= 8 ? "Long-running rivalry" : "Emerging rivalry";
}
/** News is based on completed world results, prioritising known people and elite players. */
export function personalWorldNews(s: GameSave, changed: Npc[]): GameSave {
  const candidates = changed
    .map((n) => ({
      n,
      t: n.tournamentHistory.at(-1),
      relation: s.social?.relationships[n.id],
    }))
    .filter(
      ({ n, t, relation }) =>
        t?.source === "world-circuit" &&
        t.year === s.world.date.year &&
        t.week === s.world.date.week &&
        ((relation?.ratedGames ?? 0) >= 3 ||
          (relation?.closeness ?? 0) >= 10 ||
          n.currentElo >= 2650),
    )
    .sort(
      (a, b) =>
        Number(!!b.relation) - Number(!!a.relation) ||
        b.n.currentElo - a.n.currentElo,
    )
    .slice(0, 3);
  let news = [...s.history.news];
  for (const { n, t } of candidates) {
    if (!t) continue;
    const id = `world-person-${t.eventId}-${n.id}`;
    if (news.some((x) => x.id === id)) continue;
    news.push({
      ...s.world.date,
      id,
      kind: "history",
      headline: `${n.name}: #${t.rank} in ${t.event}`,
      detail: `Elo ${t.ratingBefore ?? n.currentElo} → ${t.ratingAfter ?? n.currentElo} · ${t.wins ?? 0}W ${t.draws ?? 0}D ${t.losses ?? 0}L`,
    });
  }
  return {
    ...s,
    history: { ...s.history, news: news.slice(-GAME_CONFIG.history.maxNews) },
  };
}
