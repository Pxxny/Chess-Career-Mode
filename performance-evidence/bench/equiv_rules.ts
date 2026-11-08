import * as A from '../orig/src/game/chess/rules.ts';
import * as B from '../patched/src/game/chess/rules.ts';
import { legalMoves } from '../orig/src/game/chess/board.ts';
import { createRng } from '../orig/src/game/rng.ts';
import assert from 'node:assert/strict';

const rng = createRng(7);
let games = 0, plies = 0;
const play = (mod: typeof A, seed: number) => {
  const r = createRng(seed);
  let g = mod.createGame();
  const ends: unknown[] = [];
  for (let i = 0; i < 400; i++) {
    const pos = mod.currentPosition(g);
    const legal = legalMoves(pos);
    if (!legal.length) { ends.push(mod.detectEnd(g)); break; }
    const uci = mod.moveToUci(legal[r.int(0, legal.length - 1)]);
    const m = mod.parseUci(pos, uci)!;
    assert.ok(m);
    g = mod.makeMove(g, m);
    ends.push(mod.detectEnd(g));
    ends.push(mod.movesBetween(mod.currentPosition(g), m.to, m.from).length);
    if (ends[ends.length - 2]) break;
  }
  return { g, ends };
};
for (let s = 1; s <= 300; s++) {
  const a = play(A, s), b = play(B, s);
  assert.deepStrictEqual(b, a);
  assert.deepStrictEqual(B.gameFromSans(a.g.sans).ucis, A.gameFromSans(a.g.sans).ucis);
  games++; plies += a.g.ucis.length;
}
console.log(`OK: ${games} random games / ${plies} plies identical (GameState, sans, ucis, keys, detectEnd, movesBetween)`);

// timing: the commit path (parseUci -> makeMove -> detectEnd) of a human/engine move
const timeIt = (label: string, mod: typeof A) => {
  const run = () => { for (let s = 1; s <= 60; s++) play(mod, s); };
  run(); const t0 = performance.now(); for (let i = 0; i < 5; i++) run();
  console.log(label.padEnd(34), ((performance.now() - t0) / 5).toFixed(1), 'ms per 60 games');
};
timeIt('rules.ts before (orig board+rules)', A);
timeIt('rules.ts after', B);
