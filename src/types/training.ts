import type { GameStamp } from './history';
import type { SkillKey } from './player';

export type AttributeKey =
  | 'patternRecognition'
  | 'visualization'
  | 'concentration'
  | 'openingPreparation'
  | 'positionalUnderstanding'
  | 'mentalStability'
  | 'stamina'
  | 'physicalFitness'
  | 'resilience'
  | 'pressure';

export type Attributes = Record<AttributeKey, number>;

/** Anything training can improve: the eight core skills and the ten attributes. */
export type StatKey = SkillKey | AttributeKey;

export type TrainingCategory = 'chess' | 'mind' | 'body' | 'career';

/** Sessions that open a secondary menu before they start. */
export type TrainingChoice = 'opening' | 'opponent' | 'tournament' | 'master';

export interface TrainingSessionDef {
  id: string;
  category: TrainingCategory;
  name: string;
  description: string;
  /** 1 Beginner to 4 Expert */
  difficulty: 1 | 2 | 3 | 4;
  /** In-game hours the session takes */
  hours: number;
  ap: number;
  money: number;
  /** Minimum levels needed to take part */
  requires: Array<{ stat: StatKey; min: number }>;
  /** Experience points at average quality, before diminishing returns */
  effects: Array<{ stat: StatKey; xp: number }>;
  /** Fatigue added (negative = restful) */
  fatigue: number;
  morale: number;
  benefits: string[];
  choice?: TrainingChoice;
  dailyLimit?: number;
  /** Needs the whole training day */
  needsFullDay?: boolean;
  /** Needs a game that has not been analysed yet */
  needsGame?: boolean;
}

export interface ScoutingPrep extends GameStamp {
  opponentId: string;
  opponentName: string;
  opponentElo: number;
}

export interface TournamentPrep extends GameStamp {
  eventId: string;
  name: string;
}

export interface TrainingState {
  /** 0 (fresh) to 100 (exhausted) */
  fatigue: number;
  hoursUsedToday: number;
  /** Sessions and rests done today, by id */
  todayCounts: Record<string, number>;
  /** Experience progress towards the next level of each stat */
  xp: Partial<Record<StatKey, number>>;
  sessionCounter: number;
  /** Games played (rated or thematic) that have not been analysed */
  unanalyzedGames: number;
  scouting: ScoutingPrep | null;
  tournamentPrep: TournamentPrep | null;
}

export interface SessionGain {
  stat: StatKey;
  xp: number;
  levels: number;
  value: number;
}

export interface SessionRecord extends GameStamp {
  day: number;
  sessionId: string;
  name: string;
  quality: number;
  qualityLabel: string;
  gains: SessionGain[];
  fatigueAfter: number;
  moraleDelta: number;
  detail?: string;
}
