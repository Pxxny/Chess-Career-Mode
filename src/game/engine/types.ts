/** One candidate move reported by an engine. Scores are from the point of view of the side to move. */
export interface SearchLine {
  /** Move in UCI notation, e.g. "e2e4" or "e7e8q" */
  uci: string;
  /** Centipawns, null when a mate is found */
  cp: number | null;
  /** Moves to mate (negative: the side to move is being mated), null when there is no mate */
  mate: number | null;
  pv: string[];
  depth: number;
}

export interface SearchRequest {
  fen: string;
  /** Moves played from `fen`, in UCI notation */
  moves: string[];
  depth?: number;
  /** Time budget in milliseconds */
  movetime?: number;
  /** Candidate moves to report (best first) */
  multiPv?: number;
  /** Weaken the engine to roughly this strength (UCI_Elo). Omit for full strength. */
  limitElo?: number;
}

export interface SearchResult {
  /** The engine's chosen move in UCI notation. It is always a legal move in the searched position. */
  best: string;
  /** Candidate lines, best first. At least one. */
  lines: SearchLine[];
  depth: number;
}

/** A chess engine: Stockfish in a Web Worker, or the built-in fallback. */
export interface EngineBackend {
  /** Shown to the player, e.g. "Stockfish 16" */
  readonly name: string;
  readonly kind: 'stockfish' | 'builtin';
  search(request: SearchRequest): Promise<SearchResult>;
  /** Stops a running search as soon as possible. The pending search still resolves with its best result so far. */
  stop(): void;
  dispose(): void;
}
