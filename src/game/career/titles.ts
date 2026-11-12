import { TITLE_LABELS, TITLE_LADDER, type EarnableTitle } from "@/data/titles";
import type { CareerHistory, ChessTitle, GameStamp, Player } from "@/types";
import { normCount, titleRequirement } from "./titleRules";
export interface TitleStatus {
  current: ChessTitle;
  currentLabel: string;
  next: { id: EarnableTitle; label: string; minElo: number } | null;
  percent: number;
  pointsToNext: number | null;
  requirements: Array<{
    id: EarnableTitle;
    label: string;
    requirement: string;
    earned: boolean;
  }>;
  earned: Array<{
    id: EarnableTitle;
    label: string;
    minElo: number;
    when: GameStamp | null;
  }>;
}
/** Earned titles are permanent; legacy awards remain valid. New awards require recorded results. */
export function getTitleStatus(
  player: Player,
  history: CareerHistory,
): TitleStatus {
  const highest = TITLE_LADDER.reduce(
    (best, t, i) => (history.titles.some((r) => r.title === t.id) ? i : best),
    -1,
  );
  const reached = TITLE_LADDER.filter((_, i) => i <= highest);
  const current = reached.at(-1)?.id ?? "none";
  const next = TITLE_LADDER.find((t) => !reached.includes(t)) ?? null;
  const percent = next
    ? Math.min(
        player.peakRating / next.minElo,
        player.ratedGames / (next.id === "CM" ? 30 : 50),
        next.id === "IM" || next.id === "GM"
          ? normCount(history, next.id) / 3
          : 1,
      ) * 100
    : 100;
  return {
    current,
    currentLabel: TITLE_LABELS[current],
    next,
    percent: Math.max(0, Math.min(100, percent)),
    pointsToNext: next ? Math.max(0, next.minElo - player.peakRating) : null,
    requirements: TITLE_LADDER.map((t) => ({
      id: t.id,
      label: t.label,
      requirement: titleRequirement(t.id),
      earned: reached.includes(t),
    })),
    earned: reached.map((t) => ({
      ...t,
      when: history.titles.find((r) => r.title === t.id) ?? null,
    })),
  };
}
