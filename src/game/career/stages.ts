import { CAREER_STAGES } from '@/data/careerStages';
import type { CareerProgress } from '@/types';

export function getCareerProgress(rating: number): CareerProgress {
  let index = 0;
  CAREER_STAGES.forEach((stage, i) => {
    if (rating >= stage.minRating) index = i;
  });
  const current = CAREER_STAGES[index];
  const next = CAREER_STAGES[index + 1] ?? null;
  const percent = next
    ? ((rating - current.minRating) / (next.minRating - current.minRating)) * 100
    : 100;
  return { current, next, percent: Math.min(100, Math.max(0, percent)) };
}
