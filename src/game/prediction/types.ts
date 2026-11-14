import type { GameOutcome, PieceColor, PlayStyle } from "@/types";

export type PredictionTime =
  | "none"
  | "bullet"
  | "blitz"
  | "rapid"
  | "classical";
export type PredictionSkill =
  | "tactics"
  | "calculation"
  | "opening"
  | "positional"
  | "endgame"
  | "visualization"
  | "timeManagement"
  | "concentration"
  | "mental"
  | "preparation";
export interface PredictionActor {
  id: string;
  name: string;
  elo: number;
  peakElo?: number;
  style?: PlayStyle;
  archetype?: string;
  openings?: { white: string[]; black: string[] };
  skills?: Partial<Record<PredictionSkill, number>>;
  form?: number;
  morale?: number;
  fatigue?: number;
  preparation?: number;
  openingFamiliarity?: number;
  openingFamiliarityBasis?: "planned" | "repertoire";
  openingUsage?: import("./openingEvidence").OpeningUsage[];
  /** NPC numeric skills are estimates from rating and declared strengths, not measured attributes. */
  data: "career" | "npc-estimate" | "rating-only";
}
export interface PredictionConditions {
  color: PieceColor | "unknown";
  timeControl: PredictionTime;
  tournamentType: string;
  tournamentName?: string;
  eventId?: string;
  round?: number;
  rounds?: number;
  importance: number;
  pressure: number;
  /** Only an opening known/planned BEFORE the game. Never the classified post-game opening. */
  opening: string;
  openingDrawBias?: number;
  headToHead?: { games: number; score: number; expected: number };
}
export interface Probabilities {
  win: number;
  draw: number;
  loss: number;
  expected: number;
}
export type MatchClassification =
  | "Narrow Underdog" | "Narrow Favorite"
  | "Solid Underdog" | "Solid Favorite"
  | "Clear Underdog" | "Clear Favorite"
  | "Dominant Underdog" | "Dominant Favorite"
  | "Overwhelming Underdog" | "Overwhelming Favorite"
  | "Heavy Underdog"
  | "Underdog"
  | "Slight Underdog"
  | "Even Match"
  | "Slight Favorite"
  | "Favorite"
  | "Heavy Favorite";
export interface PredictionConfig {
  drawBase: number;
  drawRatingSlope: number;
  drawGapScale: number;
  drawScoreShare: number;
  aggressiveDrawBias: number;
  solidDrawBias: number;
  timeDraw: Record<PredictionTime, number>;
  whiteElo: Record<PredictionTime, number>;
  skillElo: number;
  formElo: number;
  moraleElo: number;
  fatigueElo: number;
  preparationElo: number;
  peakElo: number;
  pressureElo: number;
  familiarityElo: number;
  headToHeadElo: number;
  maxAdjustment: number;
  historyPrior: number;
  historyMin: number;
  historyWeight: number;
  upsetGap: number;
}
export interface PredictionSnapshot {
  id: string;
  version: 1;
  stamp: { year: number; week: number; day: number };
  player: PredictionActor;
  opponent: PredictionActor;
  conditions: PredictionConditions;
  baseline: Probabilities;
  adjusted: Probabilities;
  eloDifference: number;
  modifierElo: number;
  factors: { name: string; elo: number }[];
  classification: MatchClassification;
  confidence: "Low" | "Moderate" | "High";
  support: {
    games: number;
    played: number;
    simulated: number;
    exact: number;
    total: number;
  };
  config: PredictionConfig;
}
export interface CalibrationCell {
  games: number;
  draws: number;
  priorDraw: number;
  played: number;
}
export interface ReliabilityBin {
  games: number;
  probability: number;
  observed: number;
}
export interface ScoreTotals {
  games: number;
  brier: number;
  logLoss: number;
  correct: number;
  bins: Record<GameOutcome, ReliabilityBin[]>;
}
export type PredictionScope = "career" | "practice" | "npc";
export type PredictionSource = "played" | "engine-simulated" | "abstract";
export interface PredictionObservation {
  prediction: PredictionSnapshot;
  result: GameOutcome;
  scope: PredictionScope;
  source: PredictionSource;
  /** Forfeits, abandoned games and nonstandard starting positions do not teach the draw model. */
  eligible: boolean;
}
export interface UpsetRecord {
  id: string;
  winner: string;
  loser: string;
  winnerElo: number;
  loserElo: number;
  gap: number;
  probability: number;
  career: boolean;
  source: PredictionSource;
  stamp: PredictionSnapshot["stamp"];
  event: string;
}
export interface PredictionState {
  version: 1;
  config: PredictionConfig;
  cells: Record<string, CalibrationCell>;
  learned: number;
  /** Lifetime totals survive detail retention limits. Separate scopes prevent simulated games inflating career accuracy. */
  metrics: Record<
    PredictionScope,
    { baseline: ScoreTotals; adjusted: ScoreTotals }
  >;
  recent: PredictionObservation[];
  seen: string[];
  upsets: {
    records: UpsetRecord[];
    biggestCareer: UpsetRecord | null;
    unexpectedCareer: UpsetRecord | null;
    biggestNpc: UpsetRecord | null;
    unexpectedNpc: UpsetRecord | null;
  };
}
export interface PredictionEnvironment {
  state: PredictionState;
  stamp: PredictionSnapshot["stamp"];
  player?: PredictionActor;
}

/** Tournament archives keep the original probabilities and conditions without repeating both full skill profiles on every NPC board. */
export type CompactPrediction = Pick<
  PredictionSnapshot,
  | "id"
  | "version"
  | "stamp"
  | "conditions"
  | "baseline"
  | "adjusted"
  | "eloDifference"
  | "modifierElo"
  | "classification"
  | "confidence"
  | "support"
>;
