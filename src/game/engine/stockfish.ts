import type { EngineBackend, SearchLine, SearchRequest, SearchResult } from './types';

/**
 * Stockfish running in a Web Worker, spoken to with the UCI protocol.
 * The engine files are copied from the `stockfish` package into `public/engine/` by `scripts/copy-engine.mjs`
 * (it runs after `npm install`). That script also writes `public/engine/manifest.json`, the list of builds
 * to try, best first. A build that does not answer `uci` in time is skipped.
 */

/** The minimal Worker surface used here, so tests can pass a fake engine. */
export interface UciWorker {
  postMessage(message: string): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

interface PendingSearch {
  resolve: (r: SearchResult) => void;
  reject: (e: Error) => void;
  lines: Map<number, SearchLine>;
  depth: number;
}

const STARTUP_TIMEOUT_MS = 30000;
const SEARCH_GRACE_MS = 8000;

export class StockfishBackend implements EngineBackend {
  readonly kind = 'stockfish' as const;
  name: string;
  private pending: PendingSearch | null = null;
  private waiters: Array<{ match: (line: string) => boolean; resolve: (line: string) => void; reject: (error: Error) => void }> = [];
  private queue: Promise<unknown> = Promise.resolve();
  private multiPv = 1;
  private disposed = false;
  private failure: Error | null = null;

  private worker: UciWorker;

  constructor(worker: UciWorker, name = 'Stockfish') {
    this.worker = worker;
    this.name = name;
    worker.onmessage = (event) => {
      const text = typeof event.data === 'string' ? event.data : String((event.data as { data?: unknown })?.data ?? '');
      for (const line of text.split('\n')) this.onLine(line.trim());
    };
    worker.onerror = (event) => {
      (event as { preventDefault?: () => void })?.preventDefault?.();
      const message = (event as { message?: string })?.message;
      this.fail(new Error(message || 'The Stockfish worker failed.'));
      this.worker.terminate();
    };
  }

  private onLine(line: string): void {
    if (!line) return;
    this.waiters = this.waiters.filter((w) => {
      if (!w.match(line)) return true;
      w.resolve(line);
      return false;
    });
    const search = this.pending;
    if (!search) return;
    if (line.startsWith('info ') && line.includes(' pv ')) {
      const parsed = parseInfo(line);
      if (parsed) {
        search.lines.set(parsed.multipv, parsed.line);
        search.depth = Math.max(search.depth, parsed.line.depth);
      }
    } else if (line.startsWith('bestmove')) {
      const best = line.split(/\s+/)[1];
      this.pending = null;
      const lines = [...search.lines.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
      if (!best || best === '(none)') {
        search.reject(new Error('The engine found no move.'));
        return;
      }
      if (lines.length === 0 || lines[0].uci !== best) lines.unshift({ uci: best, cp: lines[0]?.cp ?? null, mate: lines[0]?.mate ?? null, pv: [best], depth: search.depth });
      search.resolve({ best, lines, depth: search.depth });
    }
  }

  private fail(error: Error): void {
    this.failure = error;
    const waiters = this.waiters;
    this.waiters = [];
    for (const waiter of waiters) waiter.reject(error);
    if (this.pending) {
      const pending = this.pending;
      this.pending = null;
      pending.reject(error);
    }
  }

  private assertAvailable(): void {
    if (this.disposed) throw new Error('The engine was shut down.');
    if (this.failure) throw this.failure;
  }

  private send(command: string): void {
    if (this.failure) return;
    try {
      this.worker.postMessage(command);
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error('The Stockfish worker failed.'));
    }
  }

  private waitFor(match: (line: string) => boolean, timeoutMs: number, what: string): Promise<string> {
    if (this.failure) return Promise.reject(this.failure);
    if (this.disposed) return Promise.reject(new Error('The engine was shut down.'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new Error(`Timed out waiting for ${what}.`));
      }, timeoutMs);
      const waiter = {
        match,
        resolve: (line: string) => {
          clearTimeout(timer);
          resolve(line);
        },
        reject: (error: Error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
      this.waiters.push(waiter);
    });
  }

  /** Starts the UCI handshake. Rejects if the engine does not answer. */
  async init(timeoutMs = STARTUP_TIMEOUT_MS): Promise<void> {
    this.assertAvailable();
    const ok = this.waitFor((l) => l === 'uciok', timeoutMs, 'uciok');
    this.send('uci');
    await ok;
    const ready = this.waitFor((l) => l === 'readyok', timeoutMs, 'readyok');
    this.send('isready');
    await ready;
  }

  search(request: SearchRequest): Promise<SearchResult> {
    // One search at a time: UCI engines are sequential.
    const run = this.queue.then(() => this.runSearch(request));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async runSearch(request: SearchRequest): Promise<SearchResult> {
    this.assertAvailable();
    const multiPv = Math.max(1, request.multiPv ?? 1);
    if (multiPv !== this.multiPv) {
      this.send(`setoption name MultiPV value ${multiPv}`);
      this.multiPv = multiPv;
    }
    if (request.limitElo) {
      this.send('setoption name UCI_LimitStrength value true');
      this.send(`setoption name UCI_Elo value ${Math.round(request.limitElo)}`);
    } else {
      this.send('setoption name UCI_LimitStrength value false');
    }
    const ready = this.waitFor((l) => l === 'readyok', 10000, 'readyok');
    this.send('isready');
    await ready;

    const position = request.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
      ? 'position startpos'
      : `position fen ${request.fen}`;
    this.send(request.moves.length ? `${position} moves ${request.moves.join(' ')}` : position);

    this.assertAvailable();
    const budget = request.movetime ?? 1000;
    return new Promise<SearchResult>((resolve, reject) => {
      let guard: ReturnType<typeof setTimeout> | undefined;
      const finish =
        <T,>(fn: (value: T) => void) =>
        (value: T): void => {
          clearTimeout(guard);
          fn(value);
        };
      const pending = { resolve: finish(resolve), reject: finish(reject), lines: new Map<number, SearchLine>(), depth: 0 };
      this.pending = pending;
      // Safety net: if the engine never answers, stop it and fail so the caller can fall back.
      guard = setTimeout(() => {
        if (this.pending !== pending) return;
        this.send('stop');
        if (this.pending !== pending) return;
        guard = setTimeout(() => {
          if (this.pending !== pending) return;
          this.fail(new Error('The engine did not answer.'));
          this.worker.terminate();
        }, 2000);
      }, budget + SEARCH_GRACE_MS + (request.depth && !request.movetime ? 30000 : 0));
      if (request.depth && request.movetime) this.send(`go depth ${request.depth} movetime ${request.movetime}`);
      else if (request.depth) this.send(`go depth ${request.depth}`);
      else this.send(`go movetime ${budget}`);
    });
  }

  stop(): void {
    if (this.pending) this.send('stop');
  }

  dispose(): void {
    this.disposed = true;
    this.send('quit');
    this.fail(new Error('The engine was shut down.'));
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate();
  }
}

/** Reads an "info depth 12 multipv 1 score cp 34 ... pv e2e4 e7e5" line. */
export function parseInfo(line: string): { multipv: number; line: SearchLine } | null {
  const tokens = line.split(/\s+/);
  const at = (key: string): number => tokens.indexOf(key);
  const depth = Number(tokens[at('depth') + 1]);
  const multipv = at('multipv') >= 0 ? Number(tokens[at('multipv') + 1]) : 1;
  const s = at('score');
  const pvAt = at('pv');
  if (s < 0 || pvAt < 0 || !Number.isFinite(depth)) return null;
  const kind = tokens[s + 1];
  const value = Number(tokens[s + 2]);
  if (!Number.isFinite(value)) return null;
  // "lowerbound" and "upperbound" scores are partial; they are still useful as the latest estimate.
  const pv = tokens.slice(pvAt + 1);
  if (pv.length === 0) return null;
  return {
    multipv: Number.isFinite(multipv) ? multipv : 1,
    line: { uci: pv[0], cp: kind === 'cp' ? value : null, mate: kind === 'mate' ? value : null, pv, depth },
  };
}

interface Manifest {
  /** Worker script names in /engine/, best first */
  builds: Array<{ file: string; label: string; requiresIsolation?: boolean }>;
}

const basePath = (): string => {
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return `${base.endsWith('/') ? base : `${base}/`}engine/`;
};

/** Tries every engine build in the manifest. Resolves with the first one that starts, or rejects. */
export async function loadStockfish(): Promise<StockfishBackend> {
  if (typeof Worker === 'undefined') throw new Error('Web Workers are not available.');
  const folder = basePath();
  const response = await fetch(`${folder}manifest.json`, { cache: 'no-cache' });
  if (!response.ok) throw new Error('No engine files are installed (run npm install to copy them).');
  const manifest = (await response.json()) as Manifest;
  let lastError: unknown = new Error('The engine manifest is empty.');
  for (const build of manifest.builds) {
    // Multi-thread builds cannot run without COOP/COEP. Keep the useful failure from a
    // single-thread build instead of replacing it with a SharedArrayBuffer error.
    if (build.requiresIsolation && !globalThis.crossOriginIsolated) continue;
    let backend: StockfishBackend | null = null;
    try {
      const worker = new Worker(`${folder}${build.file}`);
      backend = new StockfishBackend(worker as unknown as UciWorker, build.label);
      await backend.init();
      return backend;
    } catch (error) {
      lastError = error;
      backend?.dispose();
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Stockfish could not be started.');
}
