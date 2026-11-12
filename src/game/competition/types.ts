import type { TeamEventInfo } from "@/data/chess/nationalTeamEvents";
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
  | "round-robin-bo3"
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
  host?: { mode: "rotation" | "online"; relocationReason?: string };
  agenda?: {
    days: number;
    startDay: number;
    startMinute: number;
    slotMinutes: number;
    exactStart?: boolean;
  };
  organizer?: {
    name: string;
    status: "Official" | "Unofficial";
    simulated: boolean;
  };
  showcase?: { countries: number; perCountry: number; maxAge: number };
  localShare?: number;
  travelCost?: number;
  reference?: {
    name: string;
    url: string;
    startDate: string;
    endDate?: string;
    observedAt: string;
    sourceYear: number;
  };
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
  /** Oldest age allowed to enter (junior events); absent for open events */
  maxAge?: number;
  /** Concrete national-team edition (teams, boards, reserves) for team events */
  teamEvent?: TeamEventInfo;
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
  champion?: { id: string; name: string; year: number; eventId: string };
  target: string;
  plan: GamePlan;
  repertoire: EventRepertoire;
  prepared: PreparedEvent | null;
  scouts: ScoutingReport[];
  qualifications: {
    kind: Qualification;
    year: number;
    source: string;
    route?: "qualification" | "defence";
  }[];
  archive: ActiveTournament[];
}
