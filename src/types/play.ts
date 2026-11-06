import type { GameOutcome, GameStamp, PieceColor } from './history';
import type { FinishedGame } from '@/game/play/practice';

export type GameMode = 'training' | 'blitz' | 'engine';

export type Termination = 'checkmate' | 'resignation' | 'timeout' | 'stalemate' | 'insufficient' | 'fiftyMove' | 'repetition' | 'agreement' | 'abandoned';

export type ObjectiveId = 'free' | 'opening' | 'tactics' | 'endgame' | 'conversion' | 'defence' | 'time';

/** How each half-move was judged in the post-game analysis. One letter per half-move in `labels`. */
export type MoveLabel = 'book' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface GameAnalysisSummary {
  /** Engine that produced it: "Stockfish 16" or "Built-in engine" */
  engine: string;
  depth: number;
  /** Evaluation after each half-move (white's point of view, centipawns, clamped to +-1500). Index 0 is the start. */
  evals: number[];
  /** One letter per half-move: B book, b best, g good, i inaccuracy, m mistake, x blunder */
  labels: string;
  whiteAccuracy: number;
  blackAccuracy: number;
}

/** A finished practice game (training, online blitz or engine). Rated career games are in `history.games`. */
export interface PlayedGame extends GameStamp {
  id: string;
  mode: GameMode;
  opponentId: string | null;
  opponentName: string;
  opponentElo: number;
  color: PieceColor;
  outcome: GameOutcome;
  termination: Termination;
  /** "5+3", or "none" */
  timeControl: string;
  /** Set when the game did not start from the normal position */
  startFen: string | null;
  /** Standard algebraic notation */
  moves: string[];
  openingId: string | null;
  openingEco: string | null;
  openingName: string | null;
  openingFamily: string | null;
  /** Player accuracy 0-100. Null until the analysis has finished. */
  accuracy: number | null;
  analysis: GameAnalysisSummary | null;
  /** Rating before and after, for rated blitz games */
  ratingBefore: number | null;
  ratingAfter: number | null;
  objective: ObjectiveId | null;
  /** Repertoire situation that chose the player's opening, when one did */
  situation: string | null;
  /** True when the result was simulated instead of played */
  simulated: boolean;
}

export interface PracticeState {
  /** Checkpoint of an unfinished game, recovered as resignation after a reload. */
  pendingGame?: FinishedGame | null;
  games: PlayedGame[];
  blitzRating: number;
  blitzPeak: number;
  blitzGames: number;
  /** Rating shift of simulated online players, so their profiles stay consistent after meeting you */
  onlineDelta: Record<string, number>;
  gameCounter: number;
}

export type SituationId = 'white' | 'black' | 'vs-e4' | 'vs-d4' | 'vs-c4' | 'vs-nf3' | 'vs-aggressive' | 'vs-defensive' | 'critical';

export interface OpeningStudy extends GameStamp {
  openingId: string;
  openingName: string;
  /** 0 to 1 */
  score: number;
}

export interface RepertoireState {
  /** Opening ids per situation, in order of preference */
  preferences: Record<SituationId, string[]>;
  /** Thematic Games sessions the player completed */
  study: OpeningStudy[];
}
