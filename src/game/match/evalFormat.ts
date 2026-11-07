import { winPercent } from '@/game/engine/analysis';
import type { Position } from '@/game/chess/board';
import { material } from './review';
import { phaseOf } from './npcProfile';
import type { LiveEval } from './session';

/** Share of the advantage bar that belongs to White, 0 to 100. Always from White's point of view. */
export function barPercent(cp: number, mate: number | null): number {
  if (mate !== null) {
    if (mate > 0) return 100;
    if (mate < 0) return 0;
    return cp >= 0 ? 100 : 0;
  }
  return Math.min(97, Math.max(3, winPercent(cp)));
}

/** "+0.35", "-1.20", "M3" (White mates in 3), "-M2" (Black mates in 2), "#" (checkmate). */
export function formatEval(cp: number, mate: number | null): string {
  if (mate === 0) return cp >= 0 ? '1-0' : '0-1';
  if (mate !== null) return `${mate > 0 ? '' : '-'}M${Math.abs(mate)}`;
  const pawns = cp / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
}

/** Centipawns as an integer, signed, for the numerical readout. */
export const formatCentipawns = (cp: number, mate: number | null): string => (mate !== null ? formatEval(cp, mate) : `${cp > 0 ? '+' : ''}${Math.round(cp)} cp`);

export function describeAdvantage(cp: number, mate: number | null): string {
  if (mate === 0) return cp >= 0 ? 'White has checkmated' : 'Black has checkmated';
  if (mate !== null) return mate > 0 ? `White mates in ${mate}` : `Black mates in ${Math.abs(mate)}`;
  const a = Math.abs(cp);
  const side = cp > 0 ? 'White' : 'Black';
  if (a < 25) return 'The position is equal';
  if (a < 80) return `${side} is slightly better`;
  if (a < 200) return `${side} is better`;
  if (a < 450) return `${side} has a clear advantage`;
  return `${side} is winning`;
}

/** Short statements about the position that is on the board. */
export function positionNotes(pos: Position, live: LiveEval | null, ply: number): string[] {
  const notes: string[] = [];
  if (live) {
    notes.push(describeAdvantage(live.cp, live.mate));
    if (live.bestSan) notes.push(`Engine's choice: ${live.bestSan}`);
  }
  const m = material(pos);
  notes.push(m === 0 ? 'Material is level' : `${m > 0 ? 'White' : 'Black'} is ${Math.abs(m)} point${Math.abs(m) === 1 ? '' : 's'} up in material`);
  const phase = phaseOf(pos, ply);
  notes.push(phase === 'opening' ? 'Opening phase' : phase === 'endgame' ? 'Endgame' : 'Middlegame');
  return notes;
}
