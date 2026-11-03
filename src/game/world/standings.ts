import { getTier } from '@/data/chess/tiers';
import type { Npc, Player } from '@/types';

export interface Standing {
  rank: number;
  /** Players ranked in this group, including the player */
  of: number;
}

const rankIn = (rating: number, group: Npc[]): Standing => ({
  rank: group.reduce((r, n) => (n.currentElo > rating ? r + 1 : r), 1),
  of: group.length + 1,
});

export interface Rankings {
  world: Standing;
  national: Standing;
  city: Standing;
  league: Standing & { name: string };
}

/** Rankings among the NPCs that hold a world ranking in the current era. `ranked` must already be filtered. */
export function computeRankings(player: Player, ranked: Npc[]): Rankings {
  const national = ranked.filter((n) => n.nationality === player.country);
  const city = national.filter((n) => n.city.trim().toLowerCase() === player.city.name.trim().toLowerCase());
  const league = ranked.filter((n) => n.league === player.league);
  return {
    world: rankIn(player.rating, ranked),
    national: rankIn(player.rating, national),
    city: rankIn(player.rating, city),
    league: { ...rankIn(player.rating, league), name: getTier(player.league).leagueName },
  };
}
