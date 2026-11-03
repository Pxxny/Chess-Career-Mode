import type { Npc } from '@/types';

/** NPCs that currently hold a world ranking, best first. */
export function getRankedNpcs(npcs: Npc[]): Npc[] {
  return npcs.filter((n) => n.worldRank !== null).sort((a, b) => a.worldRank! - b.worldRank!);
}

/** 1-based world rank a rating would hold among ranked NPCs. */
export function getWorldRank(rating: number, ranked: Npc[]): number {
  return ranked.reduce((rank, npc) => (npc.currentElo > rating ? rank + 1 : rank), 1);
}
