// Real Stockfish JS/WASM integration in Chromium; requires the Vite dev server.
// npm run dev -- --host 127.0.0.1 --port 5175
// CHROMIUM_PATH=/usr/bin/chromium node scripts/verify-engine-browser.mjs
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const url = process.env.ENGINE_TEST_URL || 'http://127.0.0.1:5175';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  const real = await page.evaluate(async () => {
    const { loadStockfish } = await import('/src/game/engine/stockfish.ts');
    const { EngineManager } = await import('/src/game/engine/manager.ts');
    const { chooseEngineMove } = await import('/src/game/engine/play.ts');
    const { strengthFor } = await import('/src/game/engine/strength.ts');
    const { createGame, currentPosition, parseUci, makeMove } = await import('/src/game/chess/rules.ts');
    const { createRng } = await import('/src/game/rng.ts');
    const backend = await loadStockfish();
    try {
      const manager = new EngineManager(async () => backend);
      const rng = createRng(127);
      let game = createGame();
      const moves = [];
      for (let i = 0; i < 16; i++) {
        const strength = strengthFor([500, 1400, 2300, 3000, 3200][i % 5], { thinkMs: 100, full: i === 15 });
        const chosen = await chooseEngineMove(manager, game, strength, rng);
        const move = parseUci(currentPosition(game), chosen.uci);
        if (!move) throw new Error(`Illegal Stockfish move: ${chosen.uci}`);
        game = makeMove(game, move);
        moves.push(chosen.uci);
      }
      return { moves, info: manager.getInfo() };
    } finally {
      backend.dispose();
    }
  });
  assert.equal(real.moves.length, 16);
  assert.equal(real.info.status, 'stockfish');
  assert.match(real.info.label, /^Stockfish/);
  assert.deepEqual(errors, []);
  console.log(`Real Stockfish: ${real.moves.length} legal plies across five Elo levels and full strength; no page errors.`);

  for (const missing of ['manifest', 'wasm']) {
    const fallback = await browser.newPage();
    const fallbackErrors = [];
    fallback.on('pageerror', error => fallbackErrors.push(error.message));
    await fallback.route(missing === 'manifest' ? '**/engine/manifest.json' : '**/engine/*.wasm', route =>
      missing === 'manifest' ? route.fulfill({ status: 404, body: 'Missing engine manifest' }) : route.abort());
    await fallback.goto(url);
    const answer = await fallback.evaluate(async () => {
      const { EngineManager } = await import('/src/game/engine/manager.ts');
      const { START_FEN, createGame, currentPosition, parseUci } = await import('/src/game/chess/rules.ts');
      const manager = new EngineManager();
      const start = performance.now();
      const result = await manager.search({ fen: START_FEN, moves: [], movetime: 100 });
      return { result, info: manager.getInfo(), legal: !!parseUci(currentPosition(createGame()), result.best), elapsed: performance.now() - start };
    });
    assert.equal(answer.result.engine, 'builtin');
    assert.equal(answer.info.status, 'builtin');
    assert.equal(answer.info.label, 'Built-in engine');
    assert(answer.info.problem);
    assert(answer.legal);
    assert.deepEqual(fallbackErrors, []);
    console.log(`Missing ${missing}: legal built-in move, accurate engine status, fallback in ${Math.round(answer.elapsed)}ms.`);
    await fallback.close();
  }
} finally {
  await browser.close();
}
