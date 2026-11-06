import { bookMoves, getBookOpening } from '@/data/chess/openingBook';
import type { Npc, PlayStyle } from '@/types';
import { normalizeMoves, type OpeningDatabase } from '@/game/openings/database';
import type { Rng } from '@/game/rng';

export type Temperament = 'aggressive' | 'defensive' | 'neutral';

/** Attacking styles count as aggressive, defensive ones as defensive. */
export function temperamentOf(style: PlayStyle): Temperament {
  if (style === 'attacking' || style === 'tactical' || style === 'dynamic') return 'aggressive';
  if (style === 'defensive' || style === 'solid' || style === 'prophylactic') return 'defensive';
  return 'neutral';
}

export interface Opponent {
  /** Npc id, online player id, or null for the engine */
  id: string | null;
  name: string;
  elo: number;
  style: PlayStyle;
  temperament: Temperament;
  /** Opening lines (SAN) the opponent likes, per colour it plays */
  lines: { white: string[][]; black: string[][] };
}

export const opponentFromNpc = (npc: Npc): Opponent => {
  const lines: Opponent['lines'] = { white: [], black: [] };
  for (const id of npc.preferredOpenings) {
    const book = getBookOpening(id);
    if (book) lines[book.side].push(bookMoves(book));
  }
  return { id: npc.id, name: npc.name, elo: npc.currentElo, style: npc.style, temperament: temperamentOf(npc.style), lines };
};

export const engineOpponent = (elo: number, name = 'Stockfish'): Opponent => ({
  id: null,
  name,
  elo,
  style: 'universal',
  temperament: 'neutral',
  lines: { white: [], black: [] },
});

/** Lines of an opponent made from database entries (for online players). */
export function linesFromEntries(db: OpeningDatabase, ids: string[]): Opponent['lines'] {
  const lines: Opponent['lines'] = { white: [], black: [] };
  for (const id of ids) {
    const e = db.byId.get(id);
    if (e) lines[e.side].push(e.moves);
  }
  return lines;
}

/** How many half-moves of its repertoire an opponent plays from memory. Stronger players know more. */
export const bookDepthFor = (elo: number): number => Math.max(4, Math.min(16, Math.round(4 + (elo - 800) / 120)));

/**
 * The next book move for the opponent, or null when the game has left its repertoire.
 * `played` are the SAN moves so far. A line is followed only while it matches everything played.
 */
export function opponentBookMove(opponent: Opponent, color: 'white' | 'black', played: readonly string[], rng: Rng, forced?: readonly string[] | null): string | null {
  const ply = played.length;
  if (ply >= bookDepthFor(opponent.elo) && !forced) return null;
  const sans = normalizeMoves(played);
  const pool = forced ? [forced as string[]] : opponent.lines[color];
  const matching = pool.filter((line) => line.length > ply && normalizeMoves(line.slice(0, ply)).every((m, i) => m === sans[i]));
  if (matching.length === 0) return null;
  // Weight toward the first-listed (favourite) lines; seeded so the choice is stable for a game.
  const chosen = rng.weighted(matching, (_l) => 1);
  return chosen[ply];
}

/** A think time (ms) for a simulated clock. Moves from memory are quick. */
export function npcThinkMs(rng: Rng, remainingMs: number, incrementMs: number, ply: number, fromBook: boolean): number {
  const typical = Math.max(250, Math.min(14000, remainingMs / 38 + incrementMs * 0.7));
  const phase = ply < 16 ? 0.6 : ply < 50 ? 1.1 : 0.9;
  const t = typical * phase * rng.float(0.25, 1.7) * (fromBook ? 0.15 : 1);
  return Math.round(Math.max(120, Math.min(t, remainingMs * 0.4)));
}

/** Whether an opponent accepts a draw offer. Uses its engine evaluation (centipawns, its own point of view). */
export function acceptsDraw(rng: Rng, evalForOpponent: number, ply: number): boolean {
  if (ply < 24) return false;
  if (evalForOpponent <= -60) return true;
  if (evalForOpponent <= 40) return rng.chance(0.6);
  return false;
}
