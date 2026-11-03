import type { PlayStyle } from './npc';
import type { SkillKey } from './player';

export type ArchetypeId = 'attacker' | 'tactician' | 'balanced' | 'universal' | 'positional' | 'defender';

/** Gameplay tendencies from 0 to 100. They bias match decisions and can drift as the player develops. */
export interface Tendencies {
  aggression: number;
  /** Preference for complicated, double-edged positions */
  complexity: number;
  riskTaking: number;
  /** Ability to hold under pressure */
  resilience: number;
  adaptability: number;
}

export interface ArchetypeDefinition {
  id: ArchetypeId;
  label: string;
  tagline: string;
  traits: string[];
  playStyle: PlayStyle;
  /** Added to the base starting skill (can be negative, never below the minimum skill) */
  skillBonuses: Partial<Record<SkillKey, number>>;
  tendencies: Tendencies;
  /** Training in these skills pays off faster. Every skill stays trainable. */
  trainingAffinity: SkillKey[];
  suggestedOpenings: string[];
}
