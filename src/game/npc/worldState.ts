import { RETIREMENT_AGE } from './population';
import { higherTitle, tierForElo, titleForPeak } from '@/data/chess/tiers';
import type { Npc } from '@/types';
import { ageOn } from '@/utils/dates';
import { resolveLegend } from './legends';

export interface WorldClock {
  year: number;
  week: number;
  alternateHistory: boolean;
}

const RANKED_STATUSES: Npc['careerStatus'][] = ['active', 'semi-retired'];

export const isRanked = (npc: Npc): boolean => RANKED_STATUSES.includes(npc.careerStatus);

function sameState(a: Npc, b: Npc): boolean {
  return (
    a.worldRank === b.worldRank && a.currentElo === b.currentElo && a.careerStatus === b.careerStatus &&
    a.age === b.age && a.league === b.league && a.title === b.title
  );
}

/** Applies era/age rules and recomputes league, title and world ranking. Unchanged NPCs keep their object identity. */
export function applyWorldState(npcs: Npc[], clock: WorldClock): Npc[] {
  const updated = npcs.map((npc) => {
    if (npc.kind === 'legend') {
      const r = resolveLegend(npc, clock.year, clock.week, clock.alternateHistory);
      return { ...npc, ...r, league: tierForElo(r.currentElo) };
    }
    return {
      ...npc,
      age: ageOn(npc.dateOfBirth, clock.year, clock.week),
      careerStatus: ageOn(npc.dateOfBirth, clock.year, clock.week) >= RETIREMENT_AGE ? 'retired' : npc.careerStatus,
      league: tierForElo(npc.currentElo),
      title: higherTitle(npc.title, titleForPeak(npc.peakElo)),
    };
  });

  const ranked = updated
    .filter(isRanked)
    .sort((a, b) => b.currentElo - a.currentElo || b.peakElo - a.peakElo || a.id.localeCompare(b.id));
  const rankById = new Map(ranked.map((npc, i) => [npc.id, i + 1]));

  return updated.map((npc, i) => {
    const next = { ...npc, worldRank: rankById.get(npc.id) ?? null };
    return sameState(npcs[i], next) ? npcs[i] : next;
  });
}
