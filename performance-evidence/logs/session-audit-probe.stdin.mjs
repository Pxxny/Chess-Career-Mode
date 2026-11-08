// Executed from /workspace/performance-release/chess-career-mode using:
// NODE_DISABLE_COMPILE_CACHE=1 node --no-warnings --experimental-strip-types --import ./scripts/register-alias.mjs --input-type=module < ../validation/session-audit-probe.stdin.mjs
import assert from 'node:assert/strict';
import * as current from './src/game/chess/board.ts';
import * as original from '../orig/src/game/chess/board.ts';
import * as rules from './src/game/chess/rules.ts';
let state = 17391;
const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
let tested = 0;
for (let game = 0; game < 20; game++) {
  let pos = current.startPosition();
  for (let ply = 0; ply < 120; ply++) {
    Object.freeze(pos.board); Object.freeze(pos);
    const before = JSON.stringify(pos);
    const actual = current.legalMoves(pos);
    const expected = original.legalMoves(pos);
    assert.deepEqual(actual, expected, `legal order/flags differs game=${game} ply=${ply}`);
    for (const move of actual) {
      assert.deepEqual(current.applyMove(pos, move), original.applyMove(pos, move));
      assert.equal(current.toSan(pos, move, actual), original.toSan(pos, move, expected));
    }
    assert.equal(JSON.stringify(pos), before, 'public position was mutated');
    tested++;
    if (!actual.length) break;
    pos = current.applyMove(pos, actual[Math.floor(random() * actual.length)]);
  }
}
const pos = current.startPosition();
const first = rules.parseUci(pos, 'e2e4'); first.to = 0; first.piece = 'Q';
assert.equal(rules.parseUci(pos, 'e2e4').to, 36);
const pair = rules.movesBetween(pos, 52, 36); pair[0].to = 0;
assert.equal(rules.movesBetween(pos, 52, 36)[0].to, 36);
const legal = current.legalMoves(pos);
assert.equal(rules.parseUci(pos, 'e2e4', legal), legal.find(m => m.from === 52 && m.to === 36));
pos.board[52] = null;
assert.equal(rules.parseUci(pos, 'e2e4'), null);
pos.board[52] = 'P'; pos.turn = 'b';
assert.equal(rules.parseUci(pos, 'e2e4'), null);
assert.ok(rules.parseUci(pos, 'e7e5'));
console.log(`PASS ${tested} frozen positions: legal move order+flags, all-child applyMove+SAN parity; mutable board/turn cache invalidation; cloned public moves; explicit legal-list identity.`);
