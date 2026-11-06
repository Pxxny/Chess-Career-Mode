import { TITLE_LABELS, TITLE_LADDER, type EarnableTitle } from '@/data/titles';
import { titleForPeak } from '@/data/chess/tiers';
import type { CareerHistory, ChessTitle, GameStamp, Player } from '@/types';

export interface TitleStatus {
  current: ChessTitle;
  currentLabel: string;
  next: { id: EarnableTitle; label: string; minElo: number } | null;
  /** 0 to 100 toward the next title, measured on peak Elo */
  percent: number;
  pointsToNext: number | null;
  requirements: Array<{ id: EarnableTitle; label: string; requirement: string; earned: boolean }>;
  earned: Array<{ id: EarnableTitle; label: string; minElo: number; when: GameStamp | null }>;
}

/** Titles are for life and follow peak Elo, as in the NPC world. */
export function getTitleStatus(player: Player, history: CareerHistory): TitleStatus {
  const current = titleForPeak(player.peakRating);
  const reached = TITLE_LADDER.filter((t) => player.peakRating >= t.minElo);
  const next = TITLE_LADDER.find((t) => player.peakRating < t.minElo) ?? null;
  const floor = reached.length ? reached[reached.length - 1].minElo : Math.min(player.peakRating, 1000);
  const percent = next ? Math.min(100, Math.max(0, ((player.peakRating - floor) / (next.minElo - floor)) * 100)) : 100;
  return {
    current,
    currentLabel: TITLE_LABELS[current],
    next,
    percent,
    pointsToNext: next ? next.minElo - player.peakRating : null,
    requirements: TITLE_LADDER.map((t) => ({ id: t.id, label: t.label, requirement: `Reach a peak Elo of ${t.minElo}`, earned: player.peakRating >= t.minElo })),
    earned: reached.map((t) => {
      const record = history.titles.find((r) => r.title === t.id);
      return { ...t, when: record ? { year: record.year, week: record.week } : null };
    }),
  };
}
