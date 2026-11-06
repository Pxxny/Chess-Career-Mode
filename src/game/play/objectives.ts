import { parseFen, toFen, inCheck, legalMoves, type Position } from '@/game/chess/board';
import { START_FEN } from '@/game/chess/rules';
import type { ObjectiveId, StatKey } from '@/types';
import type { Rng } from '@/game/rng';

export interface ObjectiveDef {
  id: ObjectiveId;
  label: string;
  description: string;
  /** Experience for a normal training session; scaled by the game's quality */
  effects: Array<{ stat: StatKey; xp: number }>;
  /** Needs a clock to make sense */
  needsClock?: boolean;
  /** The opponent keeps playing even when lost */
  noResign?: boolean;
  /** The player chooses an opening */
  chooseOpening?: boolean;
  /** The player chooses the handicap or the ending */
  chooseSetup?: 'odds' | 'ending';
}

export const OBJECTIVES: ObjectiveDef[] = [
  { id: 'free', label: 'Full practice game', description: 'A normal game from the starting position. Good for general form.', effects: [{ stat: 'middlegame', xp: 22 }, { stat: 'opening', xp: 12 }, { stat: 'endgame', xp: 10 }, { stat: 'concentration', xp: 8 }] },
  { id: 'opening', label: 'Opening practice', description: 'Play an opening from your repertoire. The opponent follows the book so you reach your lines, and the feedback shows where you left it.', effects: [{ stat: 'opening', xp: 26 }, { stat: 'openingPreparation', xp: 22 }, { stat: 'middlegame', xp: 10 }], chooseOpening: true },
  { id: 'tactics', label: 'Tactical alertness', description: 'A normal game, judged on the tactics you saw or missed: blunders, forks and captures the engine found.', effects: [{ stat: 'tactics', xp: 26 }, { stat: 'patternRecognition', xp: 20 }, { stat: 'calculation', xp: 14 }] },
  { id: 'endgame', label: 'Endgame technique', description: 'Start from a classic ending and play it out against the opponent.', effects: [{ stat: 'endgame', xp: 30 }, { stat: 'calculation', xp: 14 }, { stat: 'visualization', xp: 8 }], chooseSetup: 'ending', noResign: true },
  { id: 'conversion', label: 'Convert an advantage', description: 'You start a piece or pawn up. The opponent never resigns: practise turning it into a win.', effects: [{ stat: 'endgame', xp: 16 }, { stat: 'strategy', xp: 18 }, { stat: 'concentration', xp: 14 }], chooseSetup: 'odds', noResign: true },
  { id: 'defence', label: 'Defend a worse position', description: 'You start a piece or pawn down. Fight for a draw or a swindle.', effects: [{ stat: 'resilience', xp: 26 }, { stat: 'pressure', xp: 20 }, { stat: 'psychology', xp: 12 }], chooseSetup: 'odds' },
  { id: 'time', label: 'Time management', description: 'A timed game judged on how you spent the clock: time trouble and hurried moves.', effects: [{ stat: 'timeManagement', xp: 28 }, { stat: 'pressure', xp: 14 }, { stat: 'concentration', xp: 10 }], needsClock: true },
];

export const OBJECTIVE_BY_ID: Record<ObjectiveId, ObjectiveDef> = Object.fromEntries(OBJECTIVES.map((o) => [o.id, o])) as Record<ObjectiveId, ObjectiveDef>;

export type OddsId = 'pawn' | 'knight' | 'rook';
export const ODDS: Array<{ id: OddsId; label: string }> = [
  { id: 'pawn', label: 'A pawn' },
  { id: 'knight', label: 'A knight' },
  { id: 'rook', label: 'A rook' },
];

/** Starting position with one of the given colour's pieces removed. */
export function oddsFen(removeFrom: 'white' | 'black', odds: OddsId): string {
  const pos = parseFen(START_FEN);
  const rank = removeFrom === 'white' ? 7 : 0;
  const pawnRank = removeFrom === 'white' ? 6 : 1;
  const board = [...pos.board];
  let castling = pos.castling;
  if (odds === 'pawn') board[pawnRank * 8 + 5] = null; // the f-pawn
  if (odds === 'knight') board[rank * 8 + 1] = null; // queen's knight
  if (odds === 'rook') {
    board[rank * 8] = null;
    castling = castling.replace(removeFrom === 'white' ? 'Q' : 'q', '');
  }
  return toFen({ ...pos, board, castling: castling || '-' });
}

export interface Ending {
  id: string;
  label: string;
  /** White to move, White is the side being practised */
  fen: string;
  goal: string;
}

export const ENDINGS: Ending[] = [
  { id: 'lucena', label: 'Lucena position', fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', goal: 'Win: build a bridge and promote the pawn.' },
  { id: 'rook-pawns', label: 'Rook ending, extra pawn', fen: '8/6k1/5p2/8/5P2/6P1/R5K1/r7 w - - 0 1', goal: 'Win: convert the extra pawn.' },
  { id: 'king-pawn', label: 'King and pawn ending', fen: '8/8/4k3/8/3PK3/8/8/8 w - - 0 1', goal: 'Win or draw: use the opposition.' },
  { id: 'two-pawns', label: 'King and two pawns', fen: '8/8/8/3k4/8/8/2K1PP2/8 w - - 0 1', goal: 'Win: push the pawns with the king.' },
  { id: 'rook-mate', label: 'Rook and pawn against king', fen: '4k3/8/8/8/8/8/4P3/4K1R1 w - - 0 1', goal: 'Win: promote or mate cleanly.' },
  { id: 'bishop-up', label: 'A bishop up', fen: '6k1/5pp1/8/8/8/5B2/6PP/6K1 w - - 0 1', goal: 'Win: use the extra piece without allowing counterplay.' },
  { id: 'queen-pawn', label: 'Queen against a pawn on the seventh', fen: '8/8/8/8/8/2K4k/p7/2Q5 w - - 0 1', goal: 'Win: stop the pawn and bring the king closer.' },
];

/** The same position with colours swapped (for a player who wants Black). */
export function flipFen(fen: string): string {
  const [placement, turn, castling, ep] = fen.split(' ');
  const rows = placement.split('/').reverse().map((r) => r.replace(/[a-zA-Z]/g, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())));
  const flippedCastling = castling === '-' ? '-' : castling.split('').map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).sort((a, b) => 'KQkq'.indexOf(a) - 'KQkq'.indexOf(b)).join('');
  const flippedEp = ep === '-' ? '-' : `${ep[0]}${9 - Number(ep[1])}`;
  return `${rows.join('/')} ${turn === 'w' ? 'b' : 'w'} ${flippedCastling} ${flippedEp} 0 1`;
}

/** A position is usable when both kings exist, no pawn is on the back ranks, and the side not to move is not in check. */
export function isValidSetup(fen: string): boolean {
  let pos: Position;
  try {
    pos = parseFen(fen);
  } catch {
    return false;
  }
  const kings = pos.board.filter((p) => p === 'K' || p === 'k').length;
  if (kings !== 2) return false;
  if (pos.board.some((p, i) => (p === 'P' || p === 'p') && (i < 8 || i >= 56))) return false;
  const other = parseFen(fen.replace(/ [wb] /, pos.turn === 'w' ? ' b ' : ' w '));
  if (inCheck(other)) return false;
  return legalMoves(pos).length > 0;
}

export interface Setup {
  fen: string | null;
  description: string;
}

/** The starting position for an objective. Null means the normal start. */
export function setupFor(objective: ObjectiveId, color: 'white' | 'black', choice: { odds?: OddsId; ending?: string }, rng: Rng): Setup {
  if (objective === 'conversion' || objective === 'defence') {
    const odds = choice.odds ?? 'pawn';
    const label = ODDS.find((o) => o.id === odds)!.label.toLowerCase();
    // Conversion: remove from the opponent. Defence: remove from the player.
    const removeFrom = objective === 'conversion' ? (color === 'white' ? 'black' : 'white') : color;
    return { fen: oddsFen(removeFrom, odds), description: objective === 'conversion' ? `You are ${label} up.` : `You are ${label} down.` };
  }
  if (objective === 'endgame') {
    const ending = ENDINGS.find((e) => e.id === choice.ending) ?? rng.pick(ENDINGS);
    return { fen: color === 'white' ? ending.fen : flipFen(ending.fen), description: `${ending.label}. ${ending.goal}` };
  }
  return { fen: null, description: 'Starting position.' };
}
