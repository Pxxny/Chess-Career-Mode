import { getWorldRank } from "@/game/npc/rankings";
import { highestTitle } from "@/game/match/setup";
import type { ChessTitle, GameSave, Npc, SkillTier } from "@/types";

export interface PlayerDirectoryEntry {
  kind: "player";
  id: string;
  name: string;
  nationality: string;
  city: string;
  currentElo: number;
  worldRank: number;
  tier: SkillTier;
  title: ChessTitle;
}
export type DirectoryEntry =
  | PlayerDirectoryEntry
  | {
      kind: "npc";
      npc: Npc;
      id: string;
      name: string;
      nationality: string;
      city: string;
      currentElo: number;
      worldRank: number | null;
      tier: SkillTier;
      title: ChessTitle;
    };
export function playerDirectoryEntry(
  save: GameSave,
  npcs: Npc[],
): PlayerDirectoryEntry {
  const p = save.player;
  return {
    kind: "player",
    id: p.id,
    name: p.name,
    nationality: p.country,
    city: p.city.name,
    currentElo: p.rating,
    worldRank: getWorldRank(
      p.rating,
      npcs.filter((n) => n.worldRank !== null),
    ),
    tier: p.league,
    title: highestTitle(save),
  };
}
export const npcDirectoryRank = (
  npc: Npc,
  playerRank: number,
): number | null =>
  npc.worldRank === null
    ? null
    : npc.worldRank + Number(npc.worldRank >= playerRank);
export function directoryEntries(
  save: GameSave,
  npcs: Npc[],
): DirectoryEntry[] {
  const player = playerDirectoryEntry(save, npcs);
  return [
    player,
    ...npcs.map((npc) => ({
      kind: "npc" as const,
      npc,
      id: npc.id,
      name: npc.name,
      nationality: npc.nationality,
      city: npc.city,
      currentElo: npc.currentElo,
      worldRank: npcDirectoryRank(npc, player.worldRank),
      tier: npc.tier,
      title: npc.title,
    })),
  ].sort(
    (a, b) =>
      (a.worldRank ?? 1e9) - (b.worldRank ?? 1e9) ||
      b.currentElo - a.currentElo ||
      a.id.localeCompare(b.id),
  );
}


/** Bounded, stable IDs; old saves simply start with an empty watchlist. */
export function watchlistIds(save: Pick<GameSave, 'npcWatchlist'>): string[] {
  return [...new Set((Array.isArray(save.npcWatchlist) ? save.npcWatchlist : [])
    .filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200))].slice(0, 500);
}
export function toggleWatchlist(save: GameSave, npcId: string): GameSave {
  if (!npcId || npcId.length > 200 || npcId === save.player.id || npcId === 'player') return save;
  const ids = watchlistIds(save);
  if (!ids.includes(npcId) && ids.length >= 500) return save;
  return {...save, npcWatchlist: ids.includes(npcId) ? ids.filter(id=>id!==npcId) : [...ids,npcId]};
}
export function watchlistEntries(save:GameSave, entries:DirectoryEntry[]):DirectoryEntry[] {
  const pinned=new Set(watchlistIds(save));
  return entries.filter(entry=>entry.kind==='npc'&&pinned.has(entry.id));
}
export function npcWatchSummary(npc:Npc) {
  const latest=npc.tournamentHistory.map((result,index)=>({result,index})).sort((a,b)=>b.result.year-a.result.year||(b.result.week??0)-(a.result.week??0)||b.index-a.index).find(({result})=>result.rank>0)?.result;
  return {latest,recent:(npc.recentGames??[]).slice(-5).map(g=>g.outcome)};
}
