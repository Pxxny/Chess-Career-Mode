import type { SituationId } from '@/types';
import type { Rng } from '@/game/rng';
import type { Temperament } from '@/game/play/opponent';
import type { OpeningDatabase } from './database';
import type { OpeningEntry, Side } from './types';

export interface SituationDef {
  id: SituationId;
  label: string;
  description: string;
  /** Which side the openings are for. "any" accepts both. */
  side: Side | 'any';
  /** The first move White must have played */
  firstMove?: string;
}

export const SITUATIONS: SituationDef[] = [
  { id: 'white', label: 'As White', description: 'Your general repertoire when you have the first move.', side: 'white' },
  { id: 'black', label: 'As Black', description: 'Your general repertoire as Black, used when no more specific answer is set.', side: 'black' },
  { id: 'vs-e4', label: 'Against 1.e4', description: 'How you answer the king\'s pawn.', side: 'black', firstMove: 'e4' },
  { id: 'vs-d4', label: 'Against 1.d4', description: 'How you answer the queen\'s pawn.', side: 'black', firstMove: 'd4' },
  { id: 'vs-c4', label: 'Against 1.c4', description: 'How you answer the English Opening.', side: 'black', firstMove: 'c4' },
  { id: 'vs-nf3', label: 'Against 1.Nf3', description: 'How you answer the Réti and Zukertort.', side: 'black', firstMove: 'Nf3' },
  { id: 'vs-aggressive', label: 'Against Aggressive Opponents', description: 'Openings for opponents who play attacking, tactical or dynamic chess. Either colour.', side: 'any' },
  { id: 'vs-defensive', label: 'Against Defensive Opponents', description: 'Openings for solid, defensive or prophylactic opponents. Either colour.', side: 'any' },
  { id: 'critical', label: 'In Critical Tournament Games', description: 'Your most trusted openings when a result really matters. Either colour.', side: 'any' },
];

export const SITUATION_BY_ID: Record<SituationId, SituationDef> = Object.fromEntries(SITUATIONS.map((s) => [s.id, s])) as Record<SituationId, SituationDef>;

export type Preferences = Record<SituationId, string[]>;

/** Whether an opening fits a situation (side and first move). */
export function fitsSituation(situation: SituationDef, entry: OpeningEntry): boolean {
  if (situation.side !== 'any' && entry.side !== situation.side) return false;
  if (situation.firstMove && entry.firstMove !== situation.firstMove) return false;
  return true;
}

export interface OpeningContext {
  color: Side;
  /** Temperament of the opponent */
  opponent: Temperament;
  /** A tournament game that matters a lot */
  critical?: boolean;
  /** The move White has already chosen, when the player is Black */
  whiteFirstMove?: string | null;
}

export interface OpeningChoice {
  entry: OpeningEntry;
  situation: SituationId;
}

/** Situations that apply to a game, most specific first. */
export function situationOrder(ctx: OpeningContext): SituationId[] {
  const order: SituationId[] = [];
  if (ctx.critical) order.push('critical');
  if (ctx.opponent === 'aggressive') order.push('vs-aggressive');
  if (ctx.opponent === 'defensive') order.push('vs-defensive');
  if (ctx.color === 'black') {
    const move = ctx.whiteFirstMove;
    if (move === 'e4') order.push('vs-e4');
    if (move === 'd4') order.push('vs-d4');
    if (move === 'c4') order.push('vs-c4');
    if (move === 'Nf3') order.push('vs-nf3');
    order.push('black');
  } else {
    order.push('white');
  }
  return order;
}

/**
 * Picks the opening the player wants to play in a situation, from their preferences.
 * Considers the most specific situation first and falls through when nothing there fits.
 * Earlier entries in a list are favoured. Returns null when nothing applies, and the caller plays freely.
 * This only chooses which opening to steer toward: it never changes a game's result.
 */
export function chooseOpening(db: OpeningDatabase, prefs: Preferences, ctx: OpeningContext, rng: Rng): OpeningChoice | null {
  for (const id of situationOrder(ctx)) {
    const usable = (prefs[id] ?? [])
      .map((entryId) => db.byId.get(entryId))
      .filter((e): e is OpeningEntry => !!e && e.side === ctx.color && (ctx.color === 'white' || !ctx.whiteFirstMove || e.firstMove === ctx.whiteFirstMove));
    if (usable.length === 0) continue;
    const rank = new Map(usable.map((e, i) => [e.id, i]));
    const entry = rng.weighted(usable, (e) => 1 / (1 + (rank.get(e.id) ?? 0) * 0.8));
    return { entry, situation: id };
  }
  return null;
}
