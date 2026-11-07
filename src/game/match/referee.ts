import { applyMove, inCheck as posInCheck, legalMoves, parseFen, squareName, toFen, toSan, type Move } from '@/game/chess/board';
import { createGame, currentPosition, detectEnd, makeMove, parseUci, START_FEN, type GameEnd, type GameState } from '@/game/chess/rules';

/**
 * The referee decides what is legal and when a game is over. The match viewer uses chess.js for this
 * (registered with `registerChessJs`). The project's own rules engine (perft-verified) runs next to it:
 * it feeds Stockfish, the analysis and the opening book, and it is the fallback when chess.js is not available.
 */
export interface Referee {
  readonly name: 'chess.js' | 'built-in';
  fen(): string;
  turn(): 'w' | 'b';
  /** Squares ("e4") the piece on `from` can legally move to. A promotion square appears once. */
  targets(from: string): string[];
  isLegal(uci: string): boolean;
  /** Plays the move. Returns its SAN, or null when it is illegal. */
  play(uci: string): string | null;
  inCheck(): boolean;
  /** Checkmate, stalemate, insufficient material, fifty-move rule or threefold repetition. Null while the game goes on. */
  end(): GameEnd | null;
  /** Restarts from a position (loses the repetition history) */
  load(fen: string): void;
}

/** The parts of the chess.js (v1) API that the referee uses. */
export interface ChessJsLike {
  fen(): string;
  turn(): string;
  inCheck(): boolean;
  moves(options: { square?: string; verbose: true }): Array<{ from: string; to: string; promotion?: string; san: string }>;
  move(move: { from: string; to: string; promotion?: string }): { san: string };
  isCheckmate(): boolean;
  isStalemate(): boolean;
  isInsufficientMaterial(): boolean;
  isThreefoldRepetition(): boolean;
  isDrawByFiftyMoves(): boolean;
}
export type ChessJsCtor = new (fen?: string) => ChessJsLike;

let chessJs: ChessJsCtor | null = null;

/** Makes chess.js the rules authority of new matches. Call once at start-up with `import { Chess } from 'chess.js'`. */
export function registerChessJs(ctor: ChessJsCtor | null): void {
  chessJs = ctor;
}
export const chessJsRegistered = (): boolean => chessJs !== null;

const splitUci = (uci: string): { from: string; to: string; promotion?: string } | null => {
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
  return m ? { from: m[1], to: m[2], promotion: m[3] } : null;
};

/** The project's own rules engine behind the referee interface. */
export class BuiltInReferee implements Referee {
  readonly name = 'built-in' as const;
  private game: GameState;

  constructor(fen: string = START_FEN) {
    this.game = createGame(fen);
  }

  state(): GameState {
    return this.game;
  }
  fen(): string {
    return toFen(currentPosition(this.game));
  }
  turn(): 'w' | 'b' {
    return currentPosition(this.game).turn;
  }
  targets(from: string): string[] {
    const out = new Set<string>();
    for (const m of legalMoves(currentPosition(this.game))) if (squareName(m.from) === from) out.add(squareName(m.to));
    return [...out];
  }
  isLegal(uci: string): boolean {
    return parseUci(currentPosition(this.game), uci) !== null;
  }
  play(uci: string): string | null {
    const pos = currentPosition(this.game);
    const move: Move | null = parseUci(pos, uci);
    if (!move) return null;
    const san = toSan(pos, move);
    this.game = makeMove(this.game, move);
    return san;
  }
  inCheck(): boolean {
    return posInCheck(currentPosition(this.game));
  }
  end(): GameEnd | null {
    return detectEnd(this.game);
  }
  load(fen: string): void {
    this.game = createGame(fen);
  }
}

/** chess.js behind the referee interface. Every call is guarded: a failure is reported to the caller as an exception. */
export class ChessJsReferee implements Referee {
  readonly name = 'chess.js' as const;
  private chess: ChessJsLike;
  private readonly ctor: ChessJsCtor;

  constructor(ctor: ChessJsCtor, fen: string = START_FEN) {
    this.ctor = ctor;
    this.chess = new ctor(fen);
  }

  fen(): string {
    return this.chess.fen();
  }
  turn(): 'w' | 'b' {
    return this.chess.turn() === 'b' ? 'b' : 'w';
  }
  targets(from: string): string[] {
    return [...new Set(this.chess.moves({ square: from, verbose: true }).map((m) => m.to))];
  }
  isLegal(uci: string): boolean {
    const p = splitUci(uci);
    if (!p) return false;
    return this.chess.moves({ square: p.from, verbose: true }).some((m) => m.to === p.to && (m.promotion ?? undefined) === p.promotion);
  }
  play(uci: string): string | null {
    const p = splitUci(uci);
    if (!p || !this.isLegal(uci)) return null;
    try {
      return this.chess.move(p).san;
    } catch {
      return null;
    }
  }
  inCheck(): boolean {
    return this.chess.inCheck();
  }
  end(): GameEnd | null {
    const c = this.chess;
    if (c.isCheckmate()) return { result: this.turn() === 'w' ? 'black' : 'white', reason: 'checkmate' };
    if (c.isStalemate()) return { result: 'draw', reason: 'stalemate' };
    if (c.isInsufficientMaterial()) return { result: 'draw', reason: 'insufficient' };
    if (c.isThreefoldRepetition()) return { result: 'draw', reason: 'repetition' };
    if (c.isDrawByFiftyMoves()) return { result: 'draw', reason: 'fiftyMove' };
    return null;
  }
  load(fen: string): void {
    this.chess = new this.ctor(fen);
  }
}

/** A referee for a new game: chess.js when registered and working, otherwise the built-in rules. */
export function createReferee(fen: string = START_FEN): Referee {
  if (chessJs) {
    try {
      return new ChessJsReferee(chessJs, fen);
    } catch {
      // fall through to the built-in rules
    }
  }
  return new BuiltInReferee(fen);
}

/** Board, side to move and castling rights of a FEN (the en-passant field differs between engines and is ignored). */
export const fenCore = (fen: string): string => {
  const [board, turn, castling] = fen.trim().split(/\s+/);
  return `${board} ${turn} ${castling === '' ? '-' : castling}`;
};

/** Describes any difference between two referees in the same position. Empty when they agree. Used by the tests. */
export function compareReferees(a: Referee, b: Referee): string[] {
  const problems: string[] = [];
  if (fenCore(a.fen()) !== fenCore(b.fen())) problems.push(`position: ${a.fen()} / ${b.fen()}`);
  const squares = parseFen(a.fen()).board.map((_, i) => squareName(i));
  for (const sq of squares) {
    const x = [...a.targets(sq)].sort().join(',');
    const y = [...b.targets(sq)].sort().join(',');
    if (x !== y) problems.push(`moves from ${sq}: ${x} / ${y}`);
  }
  if (a.inCheck() !== b.inCheck()) problems.push('check');
  const ea = a.end();
  const eb = b.end();
  if ((ea?.reason ?? null) !== (eb?.reason ?? null) || (ea?.result ?? null) !== (eb?.result ?? null)) problems.push(`end: ${ea?.reason}/${eb?.reason}`);
  return problems;
}
