import type {
  GameOutcome,
  MatchTimeControl,
  MatchTournamentInfo,
  PieceColor,
} from "@/types";
export type EsportsTier = "D" | "C" | "B" | "A" | "S";
export type CareerFocus = "traditional" | "esports" | "mixed";
export interface EsportsMember {
  predictionActor?: import("@/game/prediction/types").PredictionActor;
  id: string;
  name: string;
  elo: number;
  country: string;
}
export interface EsportsTeam {
  id: string;
  name: string;
  size: 2 | 3;
  owner: boolean;
  prestige: number;
  members: EsportsMember[];
  organizationId?: string;
  contractStart?: number;
  contractEnd?: number;
  salary?: number;
  paidWeeks?: number;
}
export interface TeamOffer {
  id: string;
  organizationId: string;
  day: number;
  expires: number;
  size: 2 | 3;
}
export interface EsportsEvent {
  id: string;
  name: string;
  tier: EsportsTier;
  cadence: "Weekly" | "Monthly" | "Qualifier";
  size: 2 | 3;
  day: number;
  days: number;
  deadline: number;
  fee: number;
  prize: number;
  timeControl: MatchTimeControl;
  organizer: string;
  status: "Official" | "Unofficial";
}
export interface EsportsEntry {
  event: EsportsEvent;
  team: EsportsTeam;
}
export interface EsportsBoard {
  prediction?: import("@/game/prediction/types").PredictionSnapshot;
  white: EsportsMember;
  black: EsportsMember;
  result: number | null;
}
export interface EsportsFixture {
  id: string;
  home: string;
  away: string;
  boards: EsportsBoard[];
}
export interface EsportsCompetition {
  event: EsportsEvent;
  teams: EsportsTeam[];
  round: number;
  rounds: EsportsFixture[][];
  status: "playing" | "finished";
  rank: number | null;
  teamPrize: number;
  playerPrize: number;
  withdrawn?: boolean;
}
export interface EsportsState {
  sequence: number;
  focus: CareerFocus;
  team: EsportsTeam | null;
  offers: TeamOffer[];
  lastRecruitWeek: number;
  recruitAttempts: { npcId: string; day: number; accepted: boolean }[];
  entries: EsportsEntry[];
  active: EsportsCompetition | null;
  history: EsportsCompetition[];
  form: GameOutcome[];
  qualifications: { tier: EsportsTier; expires: number; source: string }[];
  notices: string[];
}
export type EsportsCommand =
  | { type: "focus"; focus: CareerFocus }
  | { type: "create-team"; name: string; size: 2 | 3 }
  | { type: "recruit"; npcId: string }
  | { type: "release"; npcId: string }
  | { type: "leave-team" }
  | { type: "accept-offer"; offerId: string }
  | { type: "register"; eventId: string }
  | { type: "cancel"; eventId: string }
  | { type: "start"; eventId: string }
  | { type: "withdraw" }
  | { type: "close" };
export interface EsportsGameTarget {
  opponent: EsportsMember;
  color: PieceColor;
  context: { eventId: string; round: number; opponentId: string };
  tournament: MatchTournamentInfo;
}
