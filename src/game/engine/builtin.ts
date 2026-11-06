import { applyMove, inCheck, legalMoves, parseFen, type Move, type Position } from '@/game/chess/board';
import { moveToUci, parseUci } from '@/game/chess/rules';
import type { EngineBackend, SearchLine, SearchRequest, SearchResult } from './types';

/**
 * A small alpha-beta engine that runs on the main thread. It is the fallback when the Stockfish WebAssembly
 * files cannot be loaded (for example offline or on a very old browser). It is much weaker than Stockfish,
 * but it only ever returns legal moves.
 */

const VALUE: Record<string, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
const MATE = 30000;

// Piece-square tables from White's point of view, a8 (index 0) to h1 (index 63).
const PAWN = [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0];
const KNIGHT = [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50];
const BISHOP = [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20];
const ROOK = [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0];
const QUEEN = [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20];
const KING_MID = [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20];
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];
const TABLES: Record<string, number[]> = { P: PAWN, N: KNIGHT, B: BISHOP, R: ROOK, Q: QUEEN };

/** Static evaluation in centipawns from the side to move's point of view. */
export function evaluate(pos: Position): number {
  let score = 0;
  let nonPawnMaterial = 0;
  let whiteBishops = 0;
  let blackBishops = 0;
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (!p) continue;
    const t = p.toUpperCase();
    if (t !== 'P' && t !== 'K') nonPawnMaterial += VALUE[t];
  }
  const endgame = nonPawnMaterial <= 2600;
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (!p) continue;
    const white = p === p.toUpperCase();
    const t = p.toUpperCase();
    // Black uses the same tables with the ranks mirrored.
    const mirrored = white ? i : (7 - Math.floor(i / 8)) * 8 + (i % 8);
    const table = t === 'K' ? (endgame ? KING_END : KING_MID) : TABLES[t];
    const value = VALUE[t] + table[mirrored];
    if (t === 'B') white ? whiteBishops++ : blackBishops++;
    score += white ? value : -value;
  }
  if (whiteBishops >= 2) score += 30;
  if (blackBishops >= 2) score -= 30;
  return pos.turn === 'w' ? score : -score;
}

const mvvLva = (pos: Position, m: Move): number => {
  const victim = m.enPassant ? 'P' : pos.board[m.to];
  const base = victim ? 10 * VALUE[victim.toUpperCase()] - VALUE[m.piece.toUpperCase()] / 10 : 0;
  return base + (m.promotion ? VALUE[m.promotion] : 0);
};

class Timeout extends Error {}

interface Context {
  deadline: number;
  nodes: number;
}

function quiesce(pos: Position, alpha: number, beta: number, ply: number, ctx: Context, depth: number): number {
  if ((++ctx.nodes & 1023) === 0 && performance.now() > ctx.deadline) throw new Timeout();
  const checked = inCheck(pos);
  let best = -Infinity;
  if (!checked) {
    best = evaluate(pos);
    if (best >= beta) return best;
    if (best > alpha) alpha = best;
    if (depth <= 0) return best;
  }
  const moves = legalMoves(pos);
  if (moves.length === 0) return checked ? -MATE + ply : 0;
  const tactical = checked ? moves : moves.filter((m) => m.capture || m.promotion);
  tactical.sort((a, b) => mvvLva(pos, b) - mvvLva(pos, a));
  for (const m of tactical) {
    const score = -quiesce(applyMove(pos, m), -beta, -alpha, ply + 1, ctx, depth - 1);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best === -Infinity ? evaluate(pos) : best;
}

function negamax(pos: Position, depth: number, alpha: number, beta: number, ply: number, ctx: Context): number {
  if ((++ctx.nodes & 1023) === 0 && performance.now() > ctx.deadline) throw new Timeout();
  if (pos.halfmove >= 100) return 0;
  if (depth <= 0) return quiesce(pos, alpha, beta, ply, ctx, 4);
  const moves = legalMoves(pos);
  if (moves.length === 0) return inCheck(pos) ? -MATE + ply : 0;
  moves.sort((a, b) => mvvLva(pos, b) - mvvLva(pos, a));
  let best = -Infinity;
  for (const m of moves) {
    const score = -negamax(applyMove(pos, m), depth - 1, -beta, -alpha, ply + 1, ctx);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

export function positionFrom(fen: string, moves: readonly string[]): Position {
  let pos = parseFen(fen);
  for (const uci of moves) {
    const m = parseUci(pos, uci);
    if (!m) throw new Error(`Illegal move ${uci} in ${fen}`);
    pos = applyMove(pos, m);
  }
  return pos;
}

const toLine = (move: Move, score: number, depth: number): SearchLine => {
  if (Math.abs(score) > MATE - 200) {
    const plies = MATE - Math.abs(score);
    const mate = Math.ceil(plies / 2) * (score > 0 ? 1 : -1);
    return { uci: moveToUci(move), cp: null, mate, pv: [moveToUci(move)], depth };
  }
  return { uci: moveToUci(move), cp: Math.round(score), mate: null, pv: [moveToUci(move)], depth };
};

export class BuiltinEngine implements EngineBackend {
  readonly name = 'Built-in engine';
  readonly kind = 'builtin' as const;
  private stopped = false;

  async search(request: SearchRequest): Promise<SearchResult> {
    this.stopped = false;
    const pos = positionFrom(request.fen, request.moves);
    const roots = legalMoves(pos);
    if (roots.length === 0) throw new Error('No legal moves in this position.');
    const multi = Math.max(1, Math.min(request.multiPv ?? 1, roots.length));
    const maxDepth = Math.min(request.depth ?? 4, multi > 1 ? 3 : 5);
    const budget = request.movetime ?? 350;
    const ctx: Context = { deadline: performance.now() + budget, nodes: 0 };
    let scored: Array<{ move: Move; score: number }> = roots.map((m) => ({ move: m, score: evaluate(applyMove(pos, m)) * -1 }));
    scored.sort((a, b) => mvvLva(pos, b.move) - mvvLva(pos, a.move));
    let reached = 0;

    for (let depth = 1; depth <= maxDepth; depth++) {
      try {
        const next: Array<{ move: Move; score: number }> = [];
        let alpha = -Infinity;
        for (const entry of scored) {
          const child = applyMove(pos, entry.move);
          // With one line wanted, a null window is enough once a good move is known. With several, search each fully.
          const score = -negamax(child, depth - 1, -Infinity, multi > 1 ? Infinity : -alpha, 1, ctx);
          next.push({ move: entry.move, score });
          if (multi === 1 && score > alpha) alpha = score;
        }
        // With alpha-beta at the root, moves that failed low carry only an upper bound; keep best first.
        next.sort((a, b) => b.score - a.score);
        scored = next;
        reached = depth;
      } catch (e) {
        if (!(e instanceof Timeout)) throw e;
        break;
      }
      if (this.stopped || performance.now() > ctx.deadline) break;
      await new Promise((r) => setTimeout(r, 0));
    }
    const lines = scored.slice(0, multi).map((s) => toLine(s.move, s.score, Math.max(1, reached)));
    return { best: lines[0].uci, lines, depth: Math.max(1, reached) };
  }

  stop(): void {
    this.stopped = true;
  }

  dispose(): void {
    this.stopped = true;
  }
}
