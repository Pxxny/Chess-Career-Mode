import type { Appearance } from './appearance';
import type { ArchetypeId, Tendencies } from './archetype';
import type { PlayerCity } from './geo';
import type { SkillTier } from './npc';
import type { Attributes } from './training';

export type SkillKey =
  | 'opening'
  | 'middlegame'
  | 'endgame'
  | 'tactics'
  | 'calculation'
  | 'strategy'
  | 'timeManagement'
  | 'psychology';

export type Skills = Record<SkillKey, number>;

export interface ActionPoints {
  current: number;
  max: number;
}

export type PlayerGender = 'male' | 'female' | 'nonbinary' | 'undisclosed';

export interface Player {
  id: string;
  name: string;
  avatarSeed: string;
  gender: PlayerGender;
  archetype: ArchetypeId;
  appearance: Appearance;
  tendencies: Tendencies;
  dateOfBirth: string;
  age: number;
  /** Country code from the world database (permanent) */
  country: string;
  /** Home city (permanent) */
  city: PlayerCity;
  careerStartYear: number;
  rating: number;
  peakRating: number;
  ratedGames: number;
  league: SkillTier;
  morale: number;
  reputation: number;
  ap: ActionPoints;
  money: number;
  skills: Skills;
  /** Trained attributes beyond the eight core skills */
  attributes: Attributes;
  createdAt: number;
}

export interface SkillDefinition {
  key: SkillKey;
  label: string;
  description: string;
}
