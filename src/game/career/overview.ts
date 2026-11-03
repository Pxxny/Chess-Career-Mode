import { GAME_CONFIG } from '@/data/config';
import { REPUTATION_LEVELS } from '@/data/reputation';
import { CAREER_STAGES } from '@/data/careerStages';
import { TITLE_LADDER } from '@/data/titles';
import type { GameSave, GameStamp, LedgerEntry, Trophy } from '@/types';
import { oldestFirst } from '../history/createHistory';

export interface TimelineEvent extends GameStamp {
  id: string;
  label: string;
  detail?: string;
  kind: 'start' | Trophy['category'];
}

/** Career start plus every trophy, title and league step, oldest first. */
export function buildTimeline(save: GameSave): TimelineEvent[] {
  const { career, player, history } = save;
  const start: TimelineEvent = {
    id: 'start',
    year: career.startYear,
    week: 1,
    kind: 'start',
    label: 'Career begins',
    detail: `${player.city.name}, starting at ${GAME_CONFIG.player.startingRating} Elo.`,
  };
  const events = history.trophies.map((t): TimelineEvent => ({ id: t.id, year: t.year, week: t.week, kind: t.category, label: t.name, detail: t.description }));
  return [start, ...events.sort(oldestFirst)];
}

export interface Milestone {
  id: string;
  label: string;
  achieved: boolean;
  /** 0 to 100 */
  progress: number;
  progressText: string;
}

/** Fixed goals measured against the real state. */
export function buildMilestones(save: GameSave): Milestone[] {
  const { player, history } = save;
  const games = (id: string, target: number): Milestone => ({
    id,
    label: target === 1 ? 'Play a rated game' : `Play ${target} rated games`,
    achieved: player.ratedGames >= target,
    progress: Math.min(100, (player.ratedGames / target) * 100),
    progressText: `${Math.min(player.ratedGames, target)}/${target}`,
  });
  const elo = (target: number): Milestone => ({
    id: `elo-${target}`,
    label: `Reach ${target} Elo`,
    achieved: player.peakRating >= target,
    progress: Math.min(100, Math.max(0, ((player.peakRating - GAME_CONFIG.player.startingRating) / (target - GAME_CONFIG.player.startingRating)) * 100)),
    progressText: `${player.peakRating}/${target}`,
  });
  const titles = TITLE_LADDER.map((t): Milestone => ({
    id: `title-${t.id}`,
    label: `Earn the ${t.label} title`,
    achieved: player.peakRating >= t.minElo,
    progress: Math.min(100, Math.max(0, ((player.peakRating - GAME_CONFIG.player.startingRating) / (t.minElo - GAME_CONFIG.player.startingRating)) * 100)),
    progressText: `${player.peakRating}/${t.minElo}`,
  }));
  const win = history.tournaments.filter((t) => t.rank === 1).length;
  const firstWin: Milestone = { id: 'first-tournament', label: 'Win a tournament', achieved: win > 0, progress: win > 0 ? 100 : 0, progressText: `${win} won` };
  return [games('games-1', 1), games('games-10', 10), games('games-100', 100), elo(1200), elo(1500), elo(1800), elo(2000), firstWin, ...titles];
}

export function reputationStatus(reputation: number) {
  let index = 0;
  REPUTATION_LEVELS.forEach((l, i) => {
    if (reputation >= l.min) index = i;
  });
  const current = REPUTATION_LEVELS[index];
  const next = REPUTATION_LEVELS[index + 1] ?? null;
  return { label: current.label, next, percent: next ? ((reputation - current.min) / (next.min - current.min)) * 100 : 100 };
}

export interface Finance {
  balance: number;
  income: number;
  expenses: number;
  recent: LedgerEntry[];
  bestPrize: LedgerEntry | null;
}

export function buildFinance(save: GameSave): Finance {
  const ledger = save.history.ledger;
  const income = ledger.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const expenses = ledger.filter((e) => e.amount < 0).reduce((s, e) => s + -e.amount, 0);
  const prizes = ledger.filter((e) => e.kind === 'prize');
  return {
    balance: save.player.money,
    income,
    expenses,
    recent: [...ledger].reverse().slice(0, 6),
    bestPrize: prizes.sort((a, b) => b.amount - a.amount)[0] ?? null,
  };
}

export const careerStage = (rating: number) => CAREER_STAGES.filter((s) => rating >= s.minRating).pop() ?? CAREER_STAGES[0];
