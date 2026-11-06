// Stockfish lifecycle regressions. No fake engine is used by the app itself.
import assert from 'node:assert/strict';
import { START_FEN, createGame, currentPosition, parseUci } from '../src/game/chess/rules.ts';
import { EngineManager } from '../src/game/engine/manager.ts';
import { StockfishBackend, type UciWorker } from '../src/game/engine/stockfish.ts';
import { SF_MAX_ELO, strengthFor } from '../src/game/engine/strength.ts';

class WorkerHarness implements UciWorker {
  onmessage: UciWorker['onmessage'] = null;
  onerror: UciWorker['onerror'] = null;
  commands: string[] = [];
  terminated = false;
  onGo: (() => void) | null = null;
  reply(line: string) { this.onmessage?.({ data: line }); }
  postMessage(command: string) {
    this.commands.push(command);
    if (command === 'uci') this.reply('uciok');
    if (command === 'isready') this.reply('readyok');
    if (command.startsWith('go')) this.onGo?.();
  }
  terminate() { this.terminated = true; }
}
const request = { fen: START_FEN, moves: [], movetime: 10 };

// A worker load error must fail the handshake immediately, not wait 30 seconds.
const startupWorker = new WorkerHarness();
startupWorker.postMessage = () => { queueMicrotask(() => startupWorker.onerror?.({ message: 'Missing WASM' })); };
const startup = new StockfishBackend(startupWorker);
await assert.rejects(startup.init(1000), /Missing WASM/);
assert(startupWorker.terminated);
startup.dispose();

// Disposal must settle a handshake and remove listeners/timers.
const idleWorker = new WorkerHarness();
idleWorker.postMessage = () => {};
const idle = new StockfishBackend(idleWorker);
const waiting = idle.init(1000);
idle.dispose();
await assert.rejects(waiting, /shut down/);
assert.equal(idleWorker.onmessage, null);
assert.equal(idleWorker.onerror, null);

// Real workers reply asynchronously, but a fast worker must not leave a stale search timer.
const fastWorker = new WorkerHarness();
fastWorker.onGo = () => fastWorker.reply('info depth 3 score cp 20 pv e2e4\nbestmove e2e4');
const fast = new StockfishBackend(fastWorker);
await fast.init();
assert.equal((await fast.search(request)).best, 'e2e4');
assert.equal((await fast.search({ ...request, limitElo: 1500 })).best, 'e2e4');
assert(fastWorker.commands.includes('setoption name UCI_LimitStrength value true'));
await fast.search(request);
assert.equal(fastWorker.commands.filter(c => c === 'setoption name UCI_LimitStrength value false').length, 2);
fast.dispose();

// A runtime worker error must reject both the active and queued searches.
const dyingWorker = new WorkerHarness();
const dying = new StockfishBackend(dyingWorker);
await dying.init();
let started!: () => void;
const enteredSearch = new Promise<void>(resolve => { started = resolve; });
dyingWorker.onGo = started;
const active = dying.search(request);
const queued = dying.search(request);
await enteredSearch;
dyingWorker.onerror?.({ message: 'Engine crashed' });
await assert.rejects(active, /Engine crashed/);
await assert.rejects(queued, /Engine crashed/);
assert(dyingWorker.terminated);
dying.dispose();

// Fall back on the first failed search, and make the engine badge truthful immediately.
const fallbackWorker = new WorkerHarness();
const backend = new StockfishBackend(fallbackWorker);
await backend.init();
fallbackWorker.onGo = () => fallbackWorker.onerror?.({ message: 'Runtime failure' });
const manager = new EngineManager(async () => backend);
const fallback = await manager.search(request);
assert.equal(fallback.engine, 'builtin');
assert.equal(manager.getInfo().status, 'builtin');
assert.match(manager.getInfo().problem!, /Runtime failure/);
assert(parseUci(currentPosition(createGame()), fallback.best));

// A high Elo slider setting still limits strength unless the user checks Full strength.
assert.equal(strengthFor(3000).full, false);
assert.equal(strengthFor(3000).limitElo, 3000);
assert.equal(strengthFor(3200).limitElo, SF_MAX_ELO);
assert.equal(strengthFor(3200, { full: true }).limitElo, undefined);
assert.equal(strengthFor(3200, { full: true }).full, true);
console.log('Stockfish lifecycle, fallback, legal moves and strength regressions passed.');
