import type {
  ActiveTournament,
  ChessTitle,
  GameStamp,
  MatchTimeControl,
  SkillTier,
} from "@/types";
export type CompetitionFormat =
  | "swiss"
  | "round-robin"
  | "double-round-robin"
  | "match"
  | "knockout"
  | "team";
export type Qualification =
  | "continental"
  | "world-cup"
  | "grand-swiss"
  | "candidates"
  | "world-championship"
  | "super-invitation";
export interface EventDetails {
  historicalSchedule?: { startDate: string; endDate: string; source: string };
  category: string;
  location: string;
  country: string;
  end: GameStamp;
  format: CompetitionFormat;
  rounds: number;
  timeControl: MatchTimeControl;
  prize: number;
  prestige: number;
  provenance: "fictional" | "inspired";
  minimumTitle?: ChessTitle;
  qualification?: Qualification;
  nationality?: string;
  minimumLeague?: SkillTier;
  federation?: boolean;
}
export type Approach =
  | "Rock Solid"
  | "Careful"
  | "Balanced"
  | "Ambitious"
  | "All Out Attacks";
export type DecisionMode = "Play Fast" | "Normal" | "Think Deeply";
export interface GamePlan {
  approach: Approach;
  decision: DecisionMode;
  earlyDraw: boolean;
}
export interface EventRepertoire {
  white: string[];
  black: string[];
  "vs-e4": string[];
  "vs-d4": string[];
  "vs-c4": string[];
  "vs-nf3": string[];
  backups: string[];
}
export interface PreparedEvent {
  eventId: string;
  stamp: number;
  plan: GamePlan;
  repertoire: EventRepertoire;
  depth: number;
}
export interface ScoutingReport {
  eventId: string;
  npcId: string;
  stamp: number;
}
export interface CompetitionState {
  target: string;
  plan: GamePlan;
  repertoire: EventRepertoire;
  prepared: PreparedEvent | null;
  scouts: ScoutingReport[];
  qualifications: { kind: Qualification; year: number; source: string }[];
  archive: ActiveTournament[];
}
