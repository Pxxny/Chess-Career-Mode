import type { SkillKey } from "./player";

export type Gender = "male" | "female";

export type PlayStyle =
  | "attacking"
  | "positional"
  | "tactical"
  | "defensive"
  | "universal"
  | "dynamic"
  | "solid"
  | "prophylactic";

export type Personality =
  | "calm"
  | "fiery"
  | "methodical"
  | "creative"
  | "stubborn"
  | "sociable"
  | "reserved"
  | "ambitious"
  | "perfectionist"
  | "fearless";

export type SkillTier =
  | "beginner"
  | "amateur"
  | "club"
  | "professional"
  | "international-master"
  | "grandmaster"
  | "elite-grandmaster"
  | "legendary";

export type ChessTitle = "none" | "CM" | "FM" | "IM" | "GM";

export type CareerStatus =
  | "active"
  | "semi-retired"
  | "retired"
  | "inactive"
  | "deceased"
  | "not-yet-active";

export type TrainingIntensity =
  | "minimal"
  | "casual"
  | "regular"
  | "intense"
  | "obsessive";

export interface TrainingHabits {
  intensity: TrainingIntensity;
  weeklyHours: number;
  focus: SkillKey;
  hasCoach: boolean;
  usesEngine: boolean;
}

export interface TournamentResult {
  eventId?: string;
  week?: number;
  source?: "career" | "world-circuit" | "esports";
  rounds?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  ratingBefore?: number;
  ratingAfter?: number;
  year: number;
  event: string;
  rank: number;
  fieldSize: number;
  points?: number;
  games?: number;
}

export interface RatingPoint {
  year: number;
  elo: number;
}

export interface HistoricalProfile {
  birthYear: number;
  deathYear: number | null;
  /** First and last year of the active career (null = still active) */
  activeFrom: number;
  activeTo: number | null;
  peakYear: number;
  ratingHistory: RatingPoint[];
  /** "official" FIDE ratings or retrospective "estimate" values */
  eloSource: "official" | "estimate";
  historicalTitles: string[];
}

export interface Npc {
  /** Career simulation changes, kept separate from a legend's historical rating curve. */
  careerRatingDelta?: number;
  simulationPeakBase?: number;
  competitionStats?: {
    games: number;
    wins: number;
    draws: number;
    losses: number;
  };
  recordedPlayerEvents?: string[];
  id: string;
  kind: "fictional" | "legend";
  name: string;
  nameVersion?: number;
  /** Independent of current residence / represented federation. Missing for unverified historical figures. */
  birthPlace?: import("./geo").BirthPlace;
  /** Country code from the world database */
  nationality: string;
  city: string;
  gender: Gender;
  /** ISO date, YYYY-MM-DD */
  dateOfBirth: string;
  age: number;
  currentElo: number;
  peakElo: number;
  worldRank: number | null;
  /** League is derived from current Elo; tier is the NPC's identity bracket */
  league: SkillTier;
  tier: SkillTier;
  title: ChessTitle;
  style: PlayStyle;
  personality: Personality;
  strengths: SkillKey[];
  weaknesses: SkillKey[];
  preferredOpenings: string[];
  careerStartYear: number;
  careerStatus: CareerStatus;
  potentialRating: number;
  /** 0 to 100 */
  morale: number;
  /** 0 to 100 */
  form: number;
  training: TrainingHabits;
  tournamentHistory: TournamentResult[];
  historical?: HistoricalProfile;
}
