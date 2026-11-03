/** Contract for the Stockfish WASM wrapper that will be built in a later stage. */
export interface EngineAnalysis {
  fen: string;
  depth: number;
  /** Centipawns from White's point of view, null when a mate is found. */
  evaluationCp: number | null;
  mateIn: number | null;
  bestMove: string | null;
}

export interface EngineService {
  init(): Promise<void>;
  analyze(fen: string, depth: number): Promise<EngineAnalysis>;
  dispose(): void;
}
