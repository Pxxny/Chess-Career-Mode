import type { Termination } from '@/types';
import { applyMove, inCheck, legalMoves, parseFen, startPosition, squareName, toFen, toSan, type Color, type Move, type Position } from './board';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Position identity for repetition: pieces, side to move, castling rights and a capturable en-passant square. */
export function positionKey(pos: Position): string {
  const epPossible = pos.ep >= 0 && legalMoves(pos).some((m) => m.enPassant);
  return `${pos.board.map((p) => p ?? '.').join('')} ${pos.turn} ${pos.castling} ${epPossible ? pos.ep : '-'}`;
}

const isLight = (i: number): boolean => (Math.floor(i / 8) + (i % 8)) % 2 === 0;

/** Neither side can ever give checkmate: bare kings, one minor piece, or bishops that all stand on one colour. */
export function insufficientMaterial(board: ReadonlyArray<string | null>): boolean {
  const minors: Array<{ type: string; square: number }> = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const t = p.toUpperCase();
    if (t === 'K') continue;
    if (t === 'N' || t === 'B') minors.push({ type: t, square: i });
    else return false;
  }
  if (minors.length <= 1) return true;
  return minors.every((m) => m.type === 'B') && minors.every((m) => isLight(m.square) === isLight(minors[0].square));
}

/** Whether `color` could still checkmate with some series of legal moves (used when the other side's flag falls). */
export function canPossiblyMate(board: ReadonlyArray<string | null>, color: Color): boolean {
  const mine: string[] = [];
  let othersHavePieces = false;
  for (const p of board) {
    if (!p) continue;
    const t = p.toUpperCase();
    if (t === 'K') continue;
    const isMine = (p === p.toUpperCase()) === (color === 'w');
    if (isMine) mine.push(t);
    else othersHavePieces = true;
  }
  if (mine.some((t) => t === 'P' || t === 'R' || t === 'Q')) return true;
  if (mine.length >= 2) return true;
  if (mine.length === 1) return othersHavePieces;
  return false;
}

export interface GameState {
  startFen: string;
  positions: Position[];
  moves: Move[];
  sans: string[];
  ucis: string[];
  keys: string[];
}

export function createGame(fen: string = START_FEN): GameState {
  const start = fen === START_FEN ? startPosition() : parseFen(fen);
  return { startFen: fen, positions: [start], moves: [], sans: [], ucis: [], keys: [positionKey(start)] };
}

export const currentPosition = (g: GameState): Position => g.positions[g.positions.length - 1];

export function moveToUci(m: Move): string {
  return `${squareName(m.from)}${squareName(m.to)}${m.promotion ? m.promotion.toLowerCase() : ''}`;
}

/** Appends a move (it must be legal in the current position). Returns a new state. */
export function makeMove(g: GameState, move: Move): GameState {
  const pos = currentPosition(g);
  const next = applyMove(pos, move);
  return {
    ...g,
    positions: [...g.positions, next],
    moves: [...g.moves, move],
    sans: [...g.sans, toSan(pos, move)],
    ucis: [...g.ucis, moveToUci(move)],
    keys: [...g.keys, positionKey(next)],
  };
}

/** Finds the legal move written as UCI ("e2e4", "e7e8q"). Null when it is not legal. */
export function parseUci(pos: Position, uci: string, legal: Move[] = legalMoves(pos)): Move | null {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  return legal.find((m) => moveToUci(m) === uci) ?? null;
}

/** Legal moves between two squares. More than one means a promotion choice. */
export function movesBetween(pos: Position, from: number, to: number): Move[] {
  return legalMoves(pos).filter((m) => m.from === from && m.to === to);
}

export interface GameEnd {
  /** Winner, or draw */
  result: 'white' | 'black' | 'draw';
  reason: Termination;
}

/** Ends the game on checkmate, stalemate, insufficient material, the 50-move rule or threefold repetition. */
export function detectEnd(g: GameState): GameEnd | null {
  const pos = currentPosition(g);
  const legal = legalMoves(pos);
  if (legal.length === 0) {
    if (inCheck(pos)) return { result: pos.turn === 'w' ? 'black' : 'white', reason: 'checkmate' };
    return { result: 'draw', reason: 'stalemate' };
  }
  if (insufficientMaterial(pos.board)) return { result: 'draw', reason: 'insufficient' };
  if (pos.halfmove >= 100) return { result: 'draw', reason: 'fiftyMove' };
  const key = g.keys[g.keys.length - 1];
  if (g.keys.filter((k) => k === key).length >= 3) return { result: 'draw', reason: 'repetition' };
  return null;
}

/** The result when `loser`'s flag falls. A draw when the other side can never mate. */
export function timeoutResult(g: GameState, loser: Color): GameEnd {
  const board = currentPosition(g).board;
  const winner: Color = loser === 'w' ? 'b' : 'w';
  if (!canPossiblyMate(board, winner)) return { result: 'draw', reason: 'timeout' };
  return { result: winner === 'w' ? 'white' : 'black', reason: 'timeout' };
}

const cleanSan = (san: string): string => san.replace(/[+#!?]/g, '').replace(/0/g, 'O');

/** Rebuilds a game from a start position and SAN moves. Stops at the first move that is not legal. */
export function gameFromSans(sans: readonly string[], startFen: string = START_FEN): GameState {
  let game = createGame(startFen);
  for (const san of sans) {
    const pos = currentPosition(game);
    const legal = legalMoves(pos);
    const move = legal.find((m) => cleanSan(toSan(pos, m, legal)) === cleanSan(san));
    if (!move) break;
    game = makeMove(game, move);
  }
  return game;
}

export { toFen };
