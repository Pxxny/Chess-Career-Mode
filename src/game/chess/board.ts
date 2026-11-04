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

function isAttacked(board: Array<string | null>, target: number, by: Color): boolean {
  const tr = Math.floor(target / 8);
  const tf = target % 8;
  const own = (p: string | null | undefined, letters: string): boolean => !!p && colorOf(p) === by && letters.includes(p.toUpperCase());
  // pawns: a white pawn attacks upward (towards lower row index), so it sits one row below the target
  const pr = by === 'w' ? tr + 1 : tr - 1;
  for (const df of [-1, 1]) if (inside(pr, tf + df) && own(board[sq(pr, tf + df)], 'P')) return true;
  for (const [dr, df] of KNIGHT) if (inside(tr + dr, tf + df) && own(board[sq(tr + dr, tf + df)], 'N')) return true;
  for (const [dr, df] of KING) if (inside(tr + dr, tf + df) && own(board[sq(tr + dr, tf + df)], 'K')) return true;
  const slide = (dirs: Array<[number, number]>, letters: string): boolean => {
    for (const [dr, df] of dirs) {
      let r = tr + dr;
      let f = tf + df;
      while (inside(r, f)) {
        const p = board[sq(r, f)];
        if (p) {
          if (own(p, letters)) return true;
          break;
        }
        r += dr;
        f += df;
      }
    }
    return false;
  };
  return slide(ROOK, 'RQ') || slide(BISHOP, 'BQ');
}

const findKing = (board: Array<string | null>, color: Color): number => board.indexOf(color === 'w' ? 'K' : 'k');
const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export function inCheck(pos: Position, color: Color = pos.turn): boolean {
  return isAttacked(pos.board, findKing(pos.board, color), opposite(color));
}

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
      const add = (to: number, extra: Partial<Move>): void => {
        if (Math.floor(to / 8) === promoRow) for (const promo of ['Q', 'R', 'B', 'N']) moves.push({ from: i, to, piece: p, capture: false, ...extra, promotion: promo });
        else moves.push({ from: i, to, piece: p, capture: false, ...extra });
      };
      if (inside(r + dir, f) && !board[sq(r + dir, f)]) {
        add(sq(r + dir, f), {});
        if (r === startRow && !board[sq(r + 2 * dir, f)]) moves.push({ from: i, to: sq(r + 2 * dir, f), piece: p, capture: false, doublePush: true });
      }
      for (const df of [-1, 1]) {
        if (!inside(r + dir, f + df)) continue;
        const to = sq(r + dir, f + df);
        const target = board[to];
        if (target && colorOf(target) !== us) add(to, { capture: true });
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
      const dirs = type === 'R' ? ROOK : type === 'B' ? BISHOP : [...ROOK, ...BISHOP];
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
  const strip = (letters: string): void => {
    for (const l of letters) castling = castling.replace(l, '');
  };
  const type = move.piece.toUpperCase();
  if (type === 'K') strip(us === 'w' ? 'KQ' : 'kq');
  for (const [square, letter] of [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']] as Array<[number, string]>) {
    if (move.from === square || move.to === square) strip(letter);
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
  return pseudoMoves(pos).filter((m) => !inCheck(applyMove(pos, m), pos.turn));
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
