import type { GameOutcome, PieceColor } from './history';
import type { ChessTitle } from './npc';

/** Who won, or how the game ended without a winner. */
export type MatchResultKind = 'white' | 'black' | 'draw';

export type MatchTermination = 'checkmate' | 'resignation' | 'timeout' | 'stalemate' | 'insufficient' | 'fiftyMove' | 'repetition' | 'agreement' | 'abandoned';

export type EventLevelId = 'local' | 'national' | 'international' | 'elite';

/** One of the two players, as shown on the match screen. */
export interface MatchSide {
  /** NPC id, or null for the player */
  id: string | null;
  name: string;
  elo: number;
  title: ChessTitle;
  /** ISO country code, '' when unknown */
  countryCode: string;
  /** Demonym such as "Norwegian" */
  nationality: string;
  flag: string;
  isPlayer: boolean;
}

export interface MatchTournamentInfo {
  id: string;
  name: string;
  level: EventLevelId;
  round: number;
  rounds: number;
}

/** What the clock needs. The same shape as the practice-game time controls. */
export interface MatchTimeControl {
  id: string;
  label: string;
  base: number;
  increment: number;
  category: 'none' | 'bullet' | 'blitz' | 'rapid' | 'classical';
}

/** A light description of a match that can be stored in the save (for recovery after a reload). */
export interface MatchSetupLite {
  white: MatchSide;
  black: MatchSide;
  playerColor: PieceColor;
  timeControl: MatchTimeControl;
  rated: boolean;
  tournament: MatchTournamentInfo | null;
  /** Skill-based bonus added to the accuracy of a rated game (scouting report, tournament plan) */
  accuracyBonus: number;
}

export interface PendingMatch {
  setup: MatchSetupLite;
  ucis: string[];
  /** True when the player moved at least once (the game was not a pure simulation) */
  playerMoved: boolean;
}

/** One-letter codes of the move judgements, stored per half-move. */
export type ReviewLabel = 'brilliant' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'missed' | 'blunder';

export interface MoveReview {
  /** 1-based half-move number */
  ply: number;
  san: string;
  color: PieceColor;
  label: ReviewLabel;
  /** Win-percentage points given away by the move (0 to 100) */
  loss: number;
  /** Evaluation after the move, centipawns from White's point of view, clamped to +-1500 */
  evalAfter: number;
  /** Moves to mate after the move (White's point of view: positive = White mates), null without a forced mate */
  mateAfter: number | null;
  /** The engine's first choice in the position before the move (UCI), null when the game ended */
  bestUci: string | null;
  bestSan: string | null;
  /** The engine's main line from the position before the move, in SAN (up to 5 half-moves) */
  line: string[];
  /** Win-percentage gap between the best and the second-best move, null when unknown */
  gap: number | null;
  /** The move gave up material that the engine's line does not win back */
  sacrifice: boolean;
  /** Moves to mate in the engine's best line from the position before the move (for the side that moved), null when there is none */
  forcedMate: number | null;
  /** What the best move achieved when it stood out: a forced mate, a gain of material or an only move. Null for ordinary positions. */
  motif: string | null;
}

export interface MatchOpening {
  id: string;
  eco: string;
  name: string;
  family: string;
  /** Half-moves that matched the book */
  bookPlies: number;
  /** Who played the first move outside the book, null when the game ended inside it */
  leftBookBy: PieceColor | null;
}

export interface MatchAnalysisReport {
  engine: string;
  depth: number;
  /** Evaluation after each half-move (index 0 is the start), White's point of view, clamped to +-1500 */
  evals: number[];
  moves: MoveReview[];
  whiteAccuracy: number;
  blackAccuracy: number;
  opening: MatchOpening | null;
}

export interface ControlChange {
  /** Half-move number at which the change happened (0 = before the first move) */
  ply: number;
  color: PieceColor;
  to: 'human' | 'auto';
}

/** A finished match as stored in the career save. */
export interface MatchRecord {
  id: string;
  year: number;
  week: number;
  setup: MatchSetupLite;
  result: MatchResultKind;
  termination: MatchTermination;
  /** From the player's point of view (an abandoned game is a loss) */
  outcome: GameOutcome;
  moves: string[];
  /** Id of the rated game in the career history, null for unrated games */
  gameResultId: string | null;
  openingName: string | null;
  openingEco: string | null;
  /** True when no human move was played: the player's side was played by the simulator */
  simulated: boolean;
  controlLog: ControlChange[];
  ratingBefore: number | null;
  ratingAfter: number | null;
  analysis: MatchAnalysisReport | null;
}

export interface TournamentPlayer {
  id: string;
  name: string;
  elo: number;
  title: ChessTitle;
  countryCode: string;
  isPlayer: boolean;
  points: number;
  /** Ids of the opponents met so far, in round order (a bye is the string "bye") */
  opponents: string[];
  /** 1 white, -1 black, 0 bye, per round */
  colors: number[];
}

export interface TournamentPairing {
  white: string;
  black: string;
  /** Result for White once played: 1, 0.5, 0 */
  result: number | null;
}

export interface ActiveTournament {
  eventId: string;
  name: string;
  level: EventLevelId;
  year: number;
  week: number;
  rounds: number;
  /** Round being played, 1-based. Equals `rounds` when finished. */
  round: number;
  status: 'playing' | 'finished';
  entryFee: number;
  prizeFund: number;
  timeControl: MatchTimeControl;
  seed: number;
  players: TournamentPlayer[];
  /** Pairings of every round started so far */
  pairings: TournamentPairing[][];
  /** Filled in when the tournament ends */
  finalRank: number | null;
  prize: number;
}
