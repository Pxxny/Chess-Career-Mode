import * as A from '../orig/src/game/chess/board.ts';
import * as B from '../patched/src/game/chess/board.ts';
import { createRng } from '../orig/src/game/rng.ts';
import assert from 'node:assert/strict';

const FENS = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
  'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
  'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
  'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
  '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',          // en-passant
  'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1',        // castling both sides
  '8/P7/8/8/8/8/7p/K1k5 w - - 0 1',              // promotions
];
let positions = 0, moves = 0;
const rng = createRng(2024);
function check(fen: string, plies: number) {
  let a = A.parseFen(fen);
  for (let i = 0; i < plies; i++) {
    const la = A.legalMoves(a);
    const lb = B.legalMoves(a);
    assert.deepStrictEqual(lb, la);                       // same moves, same order, same fields
    assert.deepStrictEqual(Object.keys(lb[0] ?? {}), Object.keys(la[0] ?? {}));
    assert.equal(B.inCheck(a), A.inCheck(a));
    for (const m of la) { assert.deepStrictEqual(B.applyMove(a, m), A.applyMove(a, m)); moves++; }
    positions++;
    if (!la.length) break;
    a = A.applyMove(a, la[rng.int(0, la.length - 1)]);
  }
}
for (const fen of FENS) for (let g = 0; g < 120; g++) check(fen, 80);
for (const [fen, d, n] of [[FENS[0], 4, 197281], [FENS[1], 3, 97862], [FENS[2], 4, 43238], [FENS[3], 3, 9467], [FENS[4], 3, 62379]] as const) {
  assert.equal(B.perft(B.parseFen(fen), d), n);
  assert.equal(A.perft(A.parseFen(fen), d), n);
}
console.log(`OK: ${positions} positions, ${moves} applyMove results identical; perft references match`);
