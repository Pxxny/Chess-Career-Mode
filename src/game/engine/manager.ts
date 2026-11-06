import { BuiltinEngine } from './builtin';
import { loadStockfish, type StockfishBackend } from './stockfish';
import type { EngineBackend, SearchRequest, SearchResult } from './types';

export type EngineStatus = 'idle' | 'loading' | 'stockfish' | 'builtin';

export interface EngineInfo {
  status: EngineStatus;
  /** "Stockfish 16", "Built-in engine", ... */
  label: string;
  /** Why Stockfish is not in use, when it is not */
  problem: string | null;
}

export interface EngineAnswer extends SearchResult {
  engine: EngineBackend['kind'];
  engineName: string;
}

const MAX_WAIT_FOR_LOAD_MS = 20000;

/**
 * Owns the one Stockfish worker and the fallback engine. Every search goes through here, so a failing
 * or missing Stockfish never stops a game: the built-in engine answers instead.
 */
export class EngineManager {
  private info: EngineInfo = { status: 'idle', label: 'Engine not started', problem: null };
  private listeners = new Set<() => void>();
  private stockfish: StockfishBackend | null = null;
  private loading: Promise<void> | null = null;
  private readonly builtin = new BuiltinEngine();

  private loader: () => Promise<StockfishBackend>;

  constructor(loader: () => Promise<StockfishBackend> = loadStockfish) {
    this.loader = loader;
  }

  getInfo = (): EngineInfo => this.info;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(info: EngineInfo): void {
    this.info = info;
    this.listeners.forEach((l) => l());
  }

  /** Starts loading Stockfish once. Safe to call again. */
  ensureLoaded(): Promise<void> {
    if (this.loading) return this.loading;
    this.set({ status: 'loading', label: 'Loading Stockfish…', problem: null });
    this.loading = this.loader()
      .then((backend) => {
        this.stockfish = backend;
        this.set({ status: 'stockfish', label: backend.name, problem: null });
      })
      .catch((error: unknown) => {
        this.set({ status: 'builtin', label: this.builtin.name, problem: error instanceof Error ? error.message : 'Stockfish could not be loaded.' });
      });
    return this.loading;
  }

  /** The engine that will answer the next search. */
  private active(): EngineBackend {
    return this.stockfish && this.info.status === 'stockfish' ? this.stockfish : this.builtin;
  }

  async search(request: SearchRequest): Promise<EngineAnswer> {
    if (this.info.status === 'idle') void this.ensureLoaded();
    if (this.info.status === 'loading' && this.loading) {
      let guard: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([this.loading, new Promise((resolve) => { guard = setTimeout(resolve, MAX_WAIT_FOR_LOAD_MS); })]);
      } finally {
        clearTimeout(guard);
      }
    }
    const backend = this.active();
    try {
      const result = await backend.search(request);
      return { ...result, engine: backend.kind, engineName: backend.name };
    } catch (error) {
      if (backend.kind === 'builtin') throw error;
      // Report the backend actually playing the game as soon as Stockfish fails.
      this.set({ status: 'builtin', label: this.builtin.name, problem: error instanceof Error ? error.message : 'Stockfish stopped answering.' });
      this.stockfish?.dispose();
      this.stockfish = null;
      const result = await this.builtin.search({ ...request, movetime: Math.min(request.movetime ?? 400, 600) });
      return { ...result, engine: 'builtin', engineName: this.builtin.name };
    }
  }

  stop(): void {
    this.active().stop();
  }
}

/** The shared engine used by every game mode and by the analysis. */
export const engineManager = new EngineManager();
