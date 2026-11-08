import assert from 'node:assert/strict';
import { legalMoves, parseFen, toFen, type Position } from '../src/game/chess/board';
import { createGame, detectEnd, moveToUci, movesBetween, parseUci, positionKey } from '../src/game/chess/rules';

const clonePosition = (pos: Position): Position => ({ ...pos, board: pos.board.slice() });
const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const castles = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
const enPassant = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1';

/** A fresh position has no cached legal moves and provides the expected public results. */
function checkAgainstFresh(pos: Position): void {
  const fresh = clonePosition(pos);
  const legal = legalMoves(fresh);
  assert.equal(positionKey(pos), positionKey(fresh));
  for (const move of legal) {
    const actual = parseUci(pos, moveToUci(move));
    assert.deepStrictEqual(actual, move);
    assert.equal(JSON.stringify(actual), JSON.stringify(move), 'Move field order');
    assert.deepStrictEqual(movesBetween(pos, move.from, move.to), legal.filter((m) => m.from === move.from && m.to === move.to));
  }
  // Also test absence, so stale cached moves cannot survive a position mutation.
  for (const uci of ['e2e4', 'e7e5', 'e1g1', 'e1c1', 'e5d6', 'a7a8q']) {
    assert.deepStrictEqual(parseUci(pos, uci), legal.find((m) => moveToUci(m) === uci) ?? null);
  }
  const game = createGame(toFen(pos));
  assert.deepStrictEqual(detectEnd({ ...game, positions: [pos], keys: [positionKey(pos)] }), detectEnd(game));
}

const mutations: Array<[string, string, (pos: Position) => void]> = [
  ['board square', start, (pos) => { pos.board[52] = null; }],
  ['board replacement', start, (pos) => { pos.board = pos.board.slice(); pos.board[52] = null; }],
  ['turn', start, (pos) => { pos.turn = 'b'; }],
  ['castling', castles, (pos) => { pos.castling = '-'; }],
  ['en passant', enPassant, (pos) => { pos.ep = -1; }],
  ['halfmove', castles, (pos) => { pos.halfmove = 100; }],
  ['fullmove', castles, (pos) => { pos.fullmove = 22; }],
];
for (const [label, fen, mutate] of mutations) {
  const pos = parseFen(fen);
  checkAgainstFresh(pos); // populate every cache entry before mutating the public object
  mutate(pos);
  checkAgainstFresh(pos);
  console.log(`✓ cache refresh after changing ${label}`);
}

const pos = parseFen(start);
const expected = legalMoves(pos).find((move) => moveToUci(move) === 'e2e4')!;
const parsed = parseUci(pos, 'e2e4')!;
parsed.to = 0;
parsed.capture = true;
parsed.promotion = 'Q';
assert.deepStrictEqual(parseUci(pos, 'e2e4'), expected);
const between = movesBetween(pos, expected.from, expected.to);
between[0].from = 0;
between[0].promotion = 'Q';
between.push({ from: 0, to: 1, piece: 'R', capture: false });
assert.deepStrictEqual(movesBetween(pos, expected.from, expected.to), [expected]);
assert.notStrictEqual(parseUci(pos, 'e2e4'), parseUci(pos, 'e2e4'));
const supplied = legalMoves(pos);
assert.strictEqual(parseUci(pos, 'e2e4', supplied), supplied.find((move) => moveToUci(move) === 'e2e4'));
assert.equal(parseUci(pos, 'e2e4', []), null);
console.log('✓ returned moves cannot poison cached moves; explicit legal arrays retain reference behavior');

for (const fen of [start, castles, enPassant, '4k3/8/8/r4pPK/8/8/8/8 w - f6 0 1', '8/P7/8/8/8/8/7p/K1k5 w - - 0 1']) {
  const frozen = parseFen(fen);
  const before = JSON.stringify(frozen);
  Object.freeze(frozen.board);
  Object.freeze(frozen);
  legalMoves(frozen);
  checkAgainstFresh(frozen);
  assert.equal(JSON.stringify(frozen), before);
}
console.log('✓ legal moves and rule APIs leave frozen input positions unchanged (castling, en passant, pins, promotions)');
console.log('Chess cache regressions passed.');
