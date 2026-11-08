/** A small, self-contained chess rules engine: legal moves, SAN and FEN. Used to build opening positions for training. */

export type Color = 'w' | 'b';

export interface Position {
  /** 64 squares from a8 (index 0) to h1 (index 63). Uppercase = white, lowercase = black, null = empty. */
  board: Array<string | null>;
  turn: Color;
  /** Castling rights such as "KQkq", or "-" */
  castling: string;
  /** En passant target square index, or -1 */
  ep: number;
  halfmove: number;
  fullmove: number;
}

export interface Move {
  from: number;
  to: number;
  piece: string;
  capture: boolean;
  promotion?: string;
  castle?: 'K' | 'Q';
  enPassant?: boolean;
  doublePush?: boolean;
}

const KNIGHT: Array<[number, number]> = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING: Array<[number, number]> = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP: Array<[number, number]> = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const isWhite = (p: string): boolean => p === p.toUpperCase();
const colorOf = (p: string): Color => (isWhite(p) ? 'w' : 'b');
const sq = (r: number, f: number): number => r * 8 + f;
export const squareName = (i: number): string => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;
const inside = (r: number, f: number): boolean => r >= 0 && r < 8 && f >= 0 && f < 8;

export function parseFen(fen: string): Position {
  const [placement, turn, castling, ep, half, full] = fen.trim().split(/\s+/);
  const board: Array<string | null> = [];
  for (const ch of placement.replace(/\//g, '')) {
    if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) board.push(null);
    else board.push(ch);
  }
  if (board.length !== 64) throw new Error(`Invalid FEN: ${fen}`);
  const epIndex = ep && ep !== '-' ? sq(8 - Number(ep[1]), 'abcdefgh'.indexOf(ep[0])) : -1;
  return { board, turn: turn === 'b' ? 'b' : 'w', castling: castling || '-', ep: epIndex, halfmove: Number(half) || 0, fullmove: Number(full) || 1 };
}

export const startPosition = (): Position => parseFen(START_FEN);

export function toFen(pos: Position): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.board[sq(r, f)];
      if (!p) empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        row += p;
      }
    }
    rows.push(row + (empty || ''));
  }
  return `${rows.join('/')} ${pos.turn} ${pos.castling || '-'} ${pos.ep >= 0 ? squareName(pos.ep) : '-'} ${pos.halfmove} ${pos.fullmove}`;
}

const PAWN_FILES = [-1, 1] as const;
const QUEEN_DIRS: Array<[number, number]> = [...ROOK, ...BISHOP];

function isAttacked(board: Array<string | null>, target: number, by: Color): boolean {
  const tr = Math.floor(target / 8);
  const tf = target % 8;
  // Attacking pieces are of colour `by`: uppercase for white, lowercase for black.
  const white = by === 'w';
  const P = white ? 'P' : 'p';
  const N = white ? 'N' : 'n';
  const K = white ? 'K' : 'k';
  const R = white ? 'R' : 'r';
  const B = white ? 'B' : 'b';
  const Q = white ? 'Q' : 'q';
  // pawns: a white pawn attacks upward (towards lower row index), so it sits one row below the target
  const pr = white ? tr + 1 : tr - 1;
  for (let i = 0; i < 2; i++) {
    const f = tf + PAWN_FILES[i];
    if (inside(pr, f) && board[sq(pr, f)] === P) return true;
  }
  for (let i = 0; i < 8; i++) {
    const r = tr + KNIGHT[i][0];
    const f = tf + KNIGHT[i][1];
    if (inside(r, f) && board[sq(r, f)] === N) return true;
  }
  for (let i = 0; i < 8; i++) {
    const r = tr + KING[i][0];
    const f = tf + KING[i][1];
    if (inside(r, f) && board[sq(r, f)] === K) return true;
  }
  for (let d = 0; d < 4; d++) {
    let r = tr + ROOK[d][0];
    let f = tf + ROOK[d][1];
    while (inside(r, f)) {
      const p = board[sq(r, f)];
      if (p) {
        if (p === R || p === Q) return true;
        break;
      }
      r += ROOK[d][0];
      f += ROOK[d][1];
    }
  }
  for (let d = 0; d < 4; d++) {
    let r = tr + BISHOP[d][0];
    let f = tf + BISHOP[d][1];
    while (inside(r, f)) {
      const p = board[sq(r, f)];
      if (p) {
        if (p === B || p === Q) return true;
        break;
      }
      r += BISHOP[d][0];
      f += BISHOP[d][1];
    }
  }
  return false;
}

const findKing = (board: Array<string | null>, color: Color): number => board.indexOf(color === 'w' ? 'K' : 'k');
const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export function inCheck(pos: Position, color: Color = pos.turn): boolean {
  return isAttacked(pos.board, findKing(pos.board, color), opposite(color));
}

const PROMOTIONS = ['Q', 'R', 'B', 'N'] as const;

function pseudoMoves(pos: Position): Move[] {
  const moves: Move[] = [];
  const us = pos.turn;
  const { board } = pos;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || colorOf(p) !== us) continue;
    const r = Math.floor(i / 8);
    const f = i % 8;
    const type = p.toUpperCase();
    if (type === 'P') {
      const dir = us === 'w' ? -1 : 1;
      const startRow = us === 'w' ? 6 : 1;
      const promoRow = us === 'w' ? 0 : 7;
      const add = (to: number, capture: boolean): void => {
        if (Math.floor(to / 8) === promoRow) for (let k = 0; k < 4; k++) moves.push({ from: i, to, piece: p, capture, promotion: PROMOTIONS[k] });
        else moves.push({ from: i, to, piece: p, capture });
      };
      if (inside(r + dir, f) && !board[sq(r + dir, f)]) {
        add(sq(r + dir, f), false);
        if (r === startRow && !board[sq(r + 2 * dir, f)]) moves.push({ from: i, to: sq(r + 2 * dir, f), piece: p, capture: false, doublePush: true });
      }
      for (let k = 0; k < 2; k++) {
        const df = PAWN_FILES[k];
        if (!inside(r + dir, f + df)) continue;
        const to = sq(r + dir, f + df);
        const target = board[to];
        if (target && colorOf(target) !== us) add(to, true);
        else if (!target && to === pos.ep) moves.push({ from: i, to, piece: p, capture: true, enPassant: true });
      }
    } else if (type === 'N' || type === 'K') {
      for (const [dr, df] of type === 'N' ? KNIGHT : KING) {
        if (!inside(r + dr, f + df)) continue;
        const to = sq(r + dr, f + df);
        const target = board[to];
        if (!target || colorOf(target) !== us) moves.push({ from: i, to, piece: p, capture: !!target });
      }
      if (type === 'K') {
        const homeRow = us === 'w' ? 7 : 0;
        const them = opposite(us);
        if (r === homeRow && f === 4 && !isAttacked(board, i, them)) {
          const rights = us === 'w' ? ['K', 'Q'] : ['k', 'q'];
          if (pos.castling.includes(rights[0]) && board[sq(homeRow, 7)] === (us === 'w' ? 'R' : 'r') && !board[sq(homeRow, 5)] && !board[sq(homeRow, 6)] && !isAttacked(board, sq(homeRow, 5), them) && !isAttacked(board, sq(homeRow, 6), them)) {
            moves.push({ from: i, to: sq(homeRow, 6), piece: p, capture: false, castle: 'K' });
          }
          if (pos.castling.includes(rights[1]) && board[sq(homeRow, 0)] === (us === 'w' ? 'R' : 'r') && !board[sq(homeRow, 1)] && !board[sq(homeRow, 2)] && !board[sq(homeRow, 3)] && !isAttacked(board, sq(homeRow, 3), them) && !isAttacked(board, sq(homeRow, 2), them)) {
            moves.push({ from: i, to: sq(homeRow, 2), piece: p, capture: false, castle: 'Q' });
          }
        }
      }
    } else {
      const dirs = type === 'R' ? ROOK : type === 'B' ? BISHOP : QUEEN_DIRS;
      for (const [dr, df] of dirs) {
        let nr = r + dr;
        let nf = f + df;
        while (inside(nr, nf)) {
          const to = sq(nr, nf);
          const target = board[to];
          if (target) {
            if (colorOf(target) !== us) moves.push({ from: i, to, piece: p, capture: true });
            break;
          }
          moves.push({ from: i, to, piece: p, capture: false });
          nr += dr;
          nf += df;
        }
      }
    }
  }
  return moves;
}

function stripRights(castling: string, letters: string): string {
  for (let i = 0; i < letters.length; i++) castling = castling.replace(letters[i], '');
  return castling;
}

export function applyMove(pos: Position, move: Move): Position {
  const board = [...pos.board];
  const us = pos.turn;
  board[move.from] = null;
  board[move.to] = move.promotion ? (us === 'w' ? move.promotion : move.promotion.toLowerCase()) : move.piece;
  if (move.enPassant) board[move.to + (us === 'w' ? 8 : -8)] = null;
  if (move.castle) {
    const row = us === 'w' ? 7 : 0;
    if (move.castle === 'K') {
      board[sq(row, 7)] = null;
      board[sq(row, 5)] = us === 'w' ? 'R' : 'r';
    } else {
      board[sq(row, 0)] = null;
      board[sq(row, 3)] = us === 'w' ? 'R' : 'r';
    }
  }
  let castling = pos.castling === '-' ? '' : pos.castling;
  const type = move.piece.toUpperCase();
  if (castling !== '') {
    if (type === 'K') castling = stripRights(castling, us === 'w' ? 'KQ' : 'kq');
    if (move.from === 63 || move.to === 63) castling = stripRights(castling, 'K');
    if (move.from === 56 || move.to === 56) castling = stripRights(castling, 'Q');
    if (move.from === 7 || move.to === 7) castling = stripRights(castling, 'k');
    if (move.from === 0 || move.to === 0) castling = stripRights(castling, 'q');
  }
  return {
    board,
    turn: opposite(us),
    castling: castling || '-',
    ep: move.doublePush ? (move.from + move.to) / 2 : -1,
    halfmove: type === 'P' || move.capture ? 0 : pos.halfmove + 1,
    fullmove: us === 'b' ? pos.fullmove + 1 : pos.fullmove,
  };
}

export function legalMoves(pos: Position): Move[] {
  const pseudo = pseudoMoves(pos);
  const us = pos.turn;
  const them = opposite(us);
  const kingChar = us === 'w' ? 'K' : 'k';
  const rook = us === 'w' ? 'R' : 'r';
  const row = us === 'w' ? 7 : 0;
  // One scratch board for every candidate: make the move, test the king, unmake it.
  const b = pos.board.slice();
  const legal: Move[] = [];
  for (const m of pseudo) {
    const fromPiece = b[m.from];
    const toPiece = b[m.to];
    const epSquare = m.enPassant ? m.to + (us === 'w' ? 8 : -8) : -1;
    const epPiece = epSquare >= 0 ? b[epSquare] : null;
    b[m.from] = null;
    b[m.to] = m.promotion ? (us === 'w' ? m.promotion : m.promotion.toLowerCase()) : m.piece;
    if (epSquare >= 0) b[epSquare] = null;
    let rookFrom = -1;
    let rookTo = -1;
    if (m.castle) {
      rookFrom = sq(row, m.castle === 'K' ? 7 : 0);
      rookTo = sq(row, m.castle === 'K' ? 5 : 3);
      b[rookFrom] = null;
      b[rookTo] = rook;
    }
    if (!isAttacked(b, b.indexOf(kingChar), them)) legal.push(m);
    if (rookFrom >= 0) {
      b[rookTo] = null;
      b[rookFrom] = pos.board[rookFrom];
    }
    if (epSquare >= 0) b[epSquare] = epPiece;
    b[m.to] = toPiece;
    b[m.from] = fromPiece;
  }
  return legal;
}

/** Standard algebraic notation, including disambiguation and check or mate marks. */
export function toSan(pos: Position, move: Move, legal: Move[] = legalMoves(pos)): string {
  let san: string;
  if (move.castle) san = move.castle === 'K' ? 'O-O' : 'O-O-O';
  else {
    const type = move.piece.toUpperCase();
    const dest = squareName(move.to);
    if (type === 'P') {
      san = (move.capture ? `${squareName(move.from)[0]}x` : '') + dest + (move.promotion ? `=${move.promotion}` : '');
    } else {
      const rivals = legal.filter((m) => m.piece === move.piece && m.to === move.to && m.from !== move.from);
      let disambiguation = '';
      if (rivals.length) {
        const sameFile = rivals.some((m) => m.from % 8 === move.from % 8);
        const sameRank = rivals.some((m) => Math.floor(m.from / 8) === Math.floor(move.from / 8));
        if (!sameFile) disambiguation = squareName(move.from)[0];
        else if (!sameRank) disambiguation = squareName(move.from)[1];
        else disambiguation = squareName(move.from);
      }
      san = `${type}${disambiguation}${move.capture ? 'x' : ''}${dest}`;
    }
  }
  const next = applyMove(pos, move);
  if (inCheck(next)) san += legalMoves(next).length === 0 ? '#' : '+';
  return san;
}

const clean = (san: string): string => san.replace(/[+#!?]/g, '').replace(/0/g, 'O');

/** Plays a SAN move. Returns null when it is not legal in the position. */
export function playSan(pos: Position, san: string): Position | null {
  const legal = legalMoves(pos);
  const target = clean(san);
  const found = legal.find((m) => clean(toSan(pos, m, legal)) === target);
  return found ? applyMove(pos, found) : null;
}

export function sanMoves(pos: Position): string[] {
  const legal = legalMoves(pos);
  return legal.map((m) => toSan(pos, m, legal));
}

export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  return moves.reduce((sum, m) => sum + perft(applyMove(pos, m), depth - 1), 0);
}
