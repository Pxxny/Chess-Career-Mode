import { applyMove, type Position } from "./board";
import { parseUci } from "./rules";

const VALUE: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9 };

/** Material balance in pawns from White's point of view. */
export function material(pos: Position): number {
  let total = 0;
  for (const p of pos.board) {
    if (!p) continue;
    const v = VALUE[p.toUpperCase()] ?? 0;
    total += p === p.toUpperCase() ? v : -v;
  }
  return total;
}

/**
 * Walks the engine's line after the move. Returns the material change for the mover after an even number of
 * half-moves (the opponent has answered), so a trade in progress does not look like a sacrifice.
 */
export function materialAlongLine(
  before: Position,
  pv: readonly string[],
  moverWhite: boolean,
  maxPlies = 6,
): { start: number; end: number; plies: number } {
  const sign = moverWhite ? 1 : -1;
  const start = material(before) * sign;
  let pos = before;
  let atEven = start;
  let evenPlies = 0;
  for (let i = 0; i < Math.min(pv.length, maxPlies); i++) {
    const m = parseUci(pos, pv[i]);
    if (!m) break;
    pos = applyMove(pos, m);
    if ((i + 1) % 2 === 0) {
      atEven = material(pos) * sign;
      evenPlies = i + 1;
    }
  }
  return { start, end: atEven, plies: evenPlies };
}

/** A sacrifice: the line gives up at least two pawns of material that it does not win back within the line. */
export const isSacrifice = (
  before: Position,
  pv: readonly string[],
  moverWhite: boolean,
): boolean => {
  const walk = materialAlongLine(before, pv, moverWhite);
  return walk.plies >= 2 && walk.end <= walk.start - 2;
};
