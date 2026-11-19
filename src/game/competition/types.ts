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
  | "circuit-national"
  | "circuit-continental"
  | "circuit-world"
  | "continental"
  | "world-cup"
  | "grand-swiss"
  | "candidates"
  | "world-championship"
  | "super-invitation";
export interface EventDetails {
  bulgariaChess?: boolean;
  pointsSeries?: { id: import("./seasonSeries").PointsSeries; stage: "leg" | "final"; year: number; seats?: number };
  invitedNpcIds?: string[];
  twoGameRematch?: boolean;
  leagueDivision?: number;
  sponsorship?: { id:string; name:string; marketShare:number };
  qualificationCircuit?: {
    seriesId?: string;
    sponsor?: string;
    worldFinalId?: string;
    worldFinalName?: string;
    stage: "local" | "national" | "continental" | "world";
    season: number;
    country?: string;
    continent?: string;
    heat?: number;
    advanceTop?: number;
    advanceKind?: Qualification;
    targetEventId?: string;
    /** Sponsor select tour: National then World Finals only, one seat per country. */
    selectTour?: {
      type: string;
      label: string;
      /** Countries holding the winner's extra seat this year (World Finals only) */
      quotaBoost?: string[];
      /** Winner of last year's final hosts this event in their city */
      hostedBy?: string;
    };
  };
  /** Original display pattern, used when assigning a generated host. */
  venueNamePattern?: string;
  host?: { mode: "rotation" | "online"; relocationReason?: string };
  agenda?: {
    days: number;
    startDay: number;
    startMinute: number;
    slotMinutes: number;
    exactStart?: boolean;
  };
  organizer?: {
    sponsorId?: string;
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
  /** Women-only entry */
  gender?: "male" | "female";
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
/** Winner of a sponsor select-tour World Final picks a reward for next year. */
export interface SelectChoice {
  finalId: string;
  seriesId: string;
  sponsorId: string;
  sponsorName: string;
  year: number;
  winnerId: string;
  winnerName: string;
  country: string;
  city: string;
  choice?: "host" | "quota";
  by: "player" | "npc";
}
export type HallOfFameEntry = Pick<SelectChoice,
  "finalId" | "seriesId" | "year" | "winnerId" | "winnerName" | "country" | "by"
>;

export interface CompetitionState {
  circuitAwards?: Record<string,string[]>;
  hallOfFame?: Record<string, HallOfFameEntry>;
  selectChoices?: Record<string, SelectChoice>;
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
    eventId?: string;
    country?: string;
    continent?: string;
  }[];
  archive: ActiveTournament[];
}
