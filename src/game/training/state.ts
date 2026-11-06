import { GAME_CONFIG } from '@/data/config';
import { ATTRIBUTE_DEFINITIONS } from '@/data/stats';
import type { AttributeKey, Attributes, PracticeState, RepertoireState, Skills, TrainingState } from '@/types';

export function createTrainingState(): TrainingState {
  return { fatigue: 0, hoursUsedToday: 0, todayCounts: {}, xp: {}, sessionCounter: 0, unanalyzedGames: 0, scouting: null, tournamentPrep: null };
}

/** Attributes start at the base level, shifted by half of the related skill's archetype bonus. */
export function createStartingAttributes(skills: Skills): Attributes {
  const { startingSkill, minSkill, maxSkill } = GAME_CONFIG.player;
  return Object.fromEntries(
    ATTRIBUTE_DEFINITIONS.map((a) => {
      const bonus = skills[a.related] - startingSkill;
      return [a.key, Math.min(maxSkill, Math.max(minSkill, startingSkill + Math.trunc(bonus / 2)))];
    }),
  ) as Record<AttributeKey, number>;
}

export function createPracticeState(startRating: number): PracticeState {
  const step = GAME_CONFIG.practice.blitzStep;
  const rating = Math.max(400, Math.round(startRating / step) * step);
  return { games: [], blitzRating: rating, blitzPeak: rating, blitzGames: 0, onlineDelta: {}, gameCounter: 0 };
}

export function createRepertoireState(): RepertoireState {
  return {
    preferences: { white: [], black: [], 'vs-e4': [], 'vs-d4': [], 'vs-c4': [], 'vs-nf3': [], 'vs-aggressive': [], 'vs-defensive': [], critical: [] },
    study: [],
  };
}
