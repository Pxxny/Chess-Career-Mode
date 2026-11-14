import type { LifetimeTotals } from "@/game/history/lifetime";
import type { ChessTitle } from "./npc";
import type { SkillKey } from "./player";
import type { SessionRecord } from "./training";

export type GameOutcome = "win" | "draw" | "loss";
export type PieceColor = "white" | "black";

/** A point on the game calendar. */
export interface GameStamp {
  year: number;
  week: number;
  /** Older saves only retained the week; those dates use the start of that week. */
  day?: number;
}

/** One rated game played by the player. */
export interface GameResult extends GameStamp {
  npcRatingTracked?: true;
  id: string;
  opponentId: string | null;
  opponentName: string;
  opponentElo: number;
  outcome: GameOutcome;
  color: PieceColor;
  /** null for a single rated match outside a tournament */
  tournamentId: string | null;
  tournamentName: string | null;
  ratingBefore: number;
  ratingAfter: number;
  /** 0 to 100. Meaningless while `analyzed` is false. */
  accuracy: number;
  /** False until the engine analysis of the game has set the accuracy. Missing on older saves (= true). */
  analyzed?: boolean;
  opening: string | null;
}

export interface TournamentRecord extends GameStamp {
  tournamentId: string;
  name: string;
  level: "local" | "national" | "international" | "elite";
  /** 1 = winner */
  rank: number;
  fieldSize: number;
  points: number;
}

export type TrophyCategory =
  | "tournament"
  | "league"
  | "elo"
  | "title"
  | "special";

export interface Trophy extends GameStamp {
  id: string;
  category: TrophyCategory;
  name: string;
  description: string;
}

export type NewsKind =
  | "invitation"
  | "title"
  | "ranking"
  | "rivalry"
  | "promotion"
  | "sponsorship"
  | "history"
  | "milestone";

export interface NewsItem extends GameStamp {
  id: string;
  kind: NewsKind;
  headline: string;
  detail?: string;
}

export interface TrainingRecord extends GameStamp {
  skill: SkillKey;
  from: number;
  to: number;
  apCost: number;
}

export type LedgerKind =
  | "prize"
  | "sponsorship"
  | "entry-fee"
  | "expense"
  | "other";

export interface LedgerEntry extends GameStamp {
  id: string;
  kind: LedgerKind;
  label: string;
  /** Positive = income, negative = expense */
  amount: number;
}

export interface TitleRecord extends GameStamp {
  title: Exclude<ChessTitle, "none">;
}

export interface RatingSnapshot extends GameStamp {
  elo: number;
}

/** Everything that happened in the player's career. All career statistics are derived from this and the player. */
export interface CareerHistory {
  titleNorms?: import("@/game/career/titleRules").TitleNorm[];
  lifetime?: LifetimeTotals;
  games: GameResult[];
  tournaments: TournamentRecord[];
  trophies: Trophy[];
  news: NewsItem[];
  training: TrainingRecord[];
  /** Completed training sessions, oldest first */
  sessions: SessionRecord[];
  ledger: LedgerEntry[];
  titles: TitleRecord[];
  ratingHistory: RatingSnapshot[];
}
