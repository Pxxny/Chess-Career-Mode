import { TITLE_THRESHOLDS } from '@/data/chess/tiers';
import type { ChessTitle } from '@/types';

export type EarnableTitle = Exclude<ChessTitle, 'none'>;

export const TITLE_LABELS: Record<ChessTitle, string> = {
  none: 'Untitled',
  CM: 'Candidate Master',
  FM: 'FIDE Master',
  IM: 'International Master',
  GM: 'Grandmaster',
};

/** Lowest to highest, with the peak Elo each one requires. Thresholds are shared with the NPC world. */
export const TITLE_LADDER: Array<{ id: EarnableTitle; label: string; minElo: number }> = [...TITLE_THRESHOLDS]
  .sort((a, b) => a[0] - b[0])
  .map(([minElo, id]) => ({ id: id as EarnableTitle, label: TITLE_LABELS[id], minElo }));
