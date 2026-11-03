import type { ChessTitle, SkillTier } from '@/types';

export interface TierDefinition {
  id: SkillTier;
  label: string;
  leagueName: string;
  minElo: number;
  maxElo: number;
  /** Share of the generated fictional NPCs */
  share: number;
  age: [number, number];
  /** Exponent applied to the age roll; above 1 skews the tier younger */
  ageSkew: number;
  femaleShare: number;
  weeklyHours: [number, number];
  /** Age range at which the player started serious chess */
  startAge: [number, number];
  /** How fast young players of this tier improve */
  growthFactor: number;
  /** How much past-prime players have declined from their peak */
  peakFactor: number;
  coachChance: number;
  engineChance: number;
  /** Exponent applied to country weights (higher = favours strong federations) */
  countryBias: number;
  /** First year such players exist in the fictional world (2700+ players did not exist in 1950) */
  minYear: number;
  /** Whether the share shrinks in earlier eras */
  scalesWithEra: boolean;
}

export const TIERS: TierDefinition[] = [
  { id: 'beginner', label: 'Beginner', leagueName: 'Beginner League', minElo: 800, maxElo: 1199, share: 0.12, age: [9, 65], ageSkew: 1.6, femaleShare: 0.38, weeklyHours: [1, 5], startAge: [6, 65], growthFactor: 3, peakFactor: 0.1, coachChance: 0.05, engineChance: 0.1, countryBias: 0.8, minYear: 0, scalesWithEra: false },
  { id: 'amateur', label: 'Amateur', leagueName: 'Amateur League', minElo: 1200, maxElo: 1599, share: 0.22, age: [10, 62], ageSkew: 1.3, femaleShare: 0.3, weeklyHours: [3, 9], startAge: [6, 40], growthFactor: 2.4, peakFactor: 0.2, coachChance: 0.15, engineChance: 0.25, countryBias: 0.9, minYear: 0, scalesWithEra: false },
  { id: 'club', label: 'Club player', leagueName: 'Club League', minElo: 1600, maxElo: 1999, share: 0.26, age: [11, 64], ageSkew: 1.2, femaleShare: 0.2, weeklyHours: [6, 16], startAge: [6, 16], growthFactor: 1.8, peakFactor: 0.4, coachChance: 0.3, engineChance: 0.5, countryBias: 1, minYear: 0, scalesWithEra: false },
  { id: 'professional', label: 'Experienced professional', leagueName: 'Professional League', minElo: 2000, maxElo: 2399, share: 0.24, age: [13, 66], ageSkew: 1.1, femaleShare: 0.13, weeklyHours: [14, 30], startAge: [5, 12], growthFactor: 1.3, peakFactor: 0.7, coachChance: 0.55, engineChance: 0.8, countryBias: 1.1, minYear: 0, scalesWithEra: false },
  { id: 'international-master', label: 'International Master', leagueName: 'International Masters League', minElo: 2400, maxElo: 2499, share: 0.08, age: [15, 62], ageSkew: 1.05, femaleShare: 0.08, weeklyHours: [25, 40], startAge: [4, 9], growthFactor: 0.9, peakFactor: 0.9, coachChance: 0.8, engineChance: 0.95, countryBias: 1.4, minYear: 0, scalesWithEra: true },
  { id: 'grandmaster', label: 'Grandmaster', leagueName: 'Grandmaster League', minElo: 2500, maxElo: 2699, share: 0.065, age: [16, 60], ageSkew: 1, femaleShare: 0.06, weeklyHours: [30, 45], startAge: [4, 9], growthFactor: 0.7, peakFactor: 1, coachChance: 0.9, engineChance: 1, countryBias: 1.5, minYear: 0, scalesWithEra: true },
  { id: 'elite-grandmaster', label: 'Elite Grandmaster', leagueName: 'Elite Super League', minElo: 2700, maxElo: 2799, share: 0.013, age: [20, 46], ageSkew: 1, femaleShare: 0.04, weeklyHours: [35, 50], startAge: [4, 8], growthFactor: 0.4, peakFactor: 1, coachChance: 0.95, engineChance: 1, countryBias: 1.6, minYear: 1990, scalesWithEra: true },
  { id: 'legendary', label: 'Legendary', leagueName: 'Legends League', minElo: 2800, maxElo: 2835, share: 0.002, age: [23, 40], ageSkew: 1, femaleShare: 0, weeklyHours: [40, 55], startAge: [4, 7], growthFactor: 0.2, peakFactor: 1, coachChance: 1, engineChance: 1, countryBias: 1.6, minYear: 2010, scalesWithEra: true },
];

const TIER_BY_ID = new Map(TIERS.map((t) => [t.id, t]));
export const getTier = (id: SkillTier): TierDefinition => TIER_BY_ID.get(id)!;

/** League membership follows current Elo. */
export function tierForElo(elo: number): SkillTier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (elo >= TIERS[i].minElo) return TIERS[i].id;
  }
  return 'beginner';
}

export const TITLE_ORDER: ChessTitle[] = ['none', 'CM', 'FM', 'IM', 'GM'];
const TITLE_THRESHOLDS: Array<[number, ChessTitle]> = [[2500, 'GM'], [2400, 'IM'], [2300, 'FM'], [2200, 'CM']];

/** Titles are for life, so they follow peak Elo. */
export function titleForPeak(peakElo: number): ChessTitle {
  return TITLE_THRESHOLDS.find(([min]) => peakElo >= min)?.[1] ?? 'none';
}

export const higherTitle = (a: ChessTitle, b: ChessTitle): ChessTitle =>
  TITLE_ORDER.indexOf(a) >= TITLE_ORDER.indexOf(b) ? a : b;

/** Highest rating a fictional player can reach in a given year (the very top belongs to the legends). */
export function eraEloCeiling(year: number): number {
  if (year < 1970) return 2650;
  if (year < 1990) return 2699;
  if (year < 2000) return 2760;
  if (year < 2010) return 2790;
  return 2835;
}
