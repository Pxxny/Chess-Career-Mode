import { getTier } from '@/data/chess/tiers';
import type { CareerStatus, SkillKey } from '@/types';

const SKILL_LABELS: Record<SkillKey, string> = {
  opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame', tactics: 'Tactics',
  calculation: 'Calculation', strategy: 'Strategy', timeManagement: 'Time management', psychology: 'Psychology',
};

export const skillLabel = (key: SkillKey): string => SKILL_LABELS[key];
export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
export const leagueName = (tier: Parameters<typeof getTier>[0]): string => getTier(tier).leagueName;
export const tierLabel = (tier: Parameters<typeof getTier>[0]): string => getTier(tier).label;

export const STATUS_LABELS: Record<CareerStatus, string> = {
  active: 'Active',
  'semi-retired': 'Semi-retired',
  retired: 'Retired',
  inactive: 'Inactive',
  deceased: 'Deceased',
  'not-yet-active': 'Not yet active',
};
