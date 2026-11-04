import { bookMoves, getBookOpening } from '@/data/chess/openingBook';
import { createRng, mixSeed } from '@/game/rng';
import { playSan, sanMoves, startPosition, toFen, type Position } from '@/game/chess/board';

export interface ThematicPosition {
  fen: string;
  /** Moves already played, in SAN */
  played: string[];
  toMove: 'white' | 'black';
  /** The main-line move */
  correct: string;
  /** Three answers, shuffled, one of them correct */
  options: string[];
  /** Number of half-moves played to reach the position */
  ply: number;
}

export const THEMATIC_POSITIONS = 3;

/** The position after a given number of main-line half-moves. Returns null if the line is not playable. */
export function positionAfter(openingId: string, plies: number): Position | null {
  const opening = getBookOpening(openingId);
  if (!opening) return null;
  let pos: Position | null = startPosition();
  for (const san of bookMoves(opening).slice(0, plies)) {
    pos = playSan(pos, san);
    if (!pos) return null;
  }
  return pos;
}

/**
 * Builds positions from an opening's main line where the chosen colour is to move.
 * Positions get deeper through the set, and the player must find the main-line move.
 */
export function generateThematicSet(openingId: string, color: 'white' | 'black', seed: number, count = THEMATIC_POSITIONS): ThematicPosition[] {
  const opening = getBookOpening(openingId);
  if (!opening) return [];
  const moves = bookMoves(opening);
  const rng = createRng(mixSeed(seed, moves.length * 7 + (color === 'white' ? 1 : 2)));
  // White is to move after an even number of half-moves, black after an odd number.
  const plies: number[] = [];
  for (let ply = color === 'white' ? 0 : 1; ply < moves.length; ply += 2) plies.push(ply);
  const chosen = rng.shuffle(plies).slice(0, count).sort((a, b) => a - b);

  const result: ThematicPosition[] = [];
  for (const ply of chosen) {
    const pos = positionAfter(openingId, ply);
    if (!pos) continue;
    const correct = moves[ply];
    const others = rng.shuffle(sanMoves(pos).filter((m) => m.replace(/[+#]/g, '') !== correct.replace(/[+#]/g, '')));
    const options = rng.shuffle([correct, ...others.slice(0, 2)]);
    result.push({ fen: toFen(pos), played: moves.slice(0, ply), toMove: pos.turn === 'w' ? 'white' : 'black', correct, options, ply });
  }
  return result;
}

