import type { Npc } from '@/types';
import { generateFictionalNpcs } from './fictional';
import { buildLegendNpcs } from './legends';
import type { WorldGenContext } from './types';
import { applyWorldState } from './worldState';

/** Builds the full NPC database (legends + fictional players) in its initial seeded state. */
export function buildNpcDatabase(ctx: WorldGenContext): Npc[] {
  const all = [...buildLegendNpcs(), ...generateFictionalNpcs(ctx)];
  return applyWorldState(all, { year: ctx.startYear, week: 1, alternateHistory: false });
}
