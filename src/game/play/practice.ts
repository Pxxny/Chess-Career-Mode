import { GAME_CONFIG } from '@/data/config';
import type { OpeningDatabase } from '@/game/openings/database';
import { ratingChange as eloChange, expectedScore } from '@/game/history/elo';
import { diminishing, efficiencyAt, getStat, withStat, xpNeeded } from '@/game/training/engine';
import type { GameAnalysisSummary, GameMode, GameOutcome, GameSave, ObjectiveId, PieceColor, PlayedGame, SessionGain, SessionRecord, Termination, TrainingState } from '@/types';
import { estimatedMinutes, type TimeControl } from './timeControls';
import { OBJECTIVE_BY_ID } from './objectives';
import type { Opponent } from './opponent';

const cfg = GAME_CONFIG.sessions;
const pcfg = GAME_CONFIG.practice;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round1 = (v: number): number => Math.round(v * 10) / 10;

/** Training hours a Training Game costs. Long time controls use two. */
export const trainingHoursFor = (tc: TimeControl): number => (estimatedMinutes(tc) > 40 ? pcfg.longTrainingHours : pcfg.trainingHours);

/** Action points the next game of this mode costs. Online Blitz charges once per block of games in a day. */
export function practiceApCost(save: GameSave, mode: GameMode): number {
  const ap = pcfg.ap;
  if (mode === 'training') return ap.training;
  if (mode === 'engine') return ap.engine;
  return (save.training.todayCounts['play-blitz'] ?? 0) % ap.blitzBlock === 0 ? ap.blitz : 0;
}

/** Why the player cannot start a game right now, or null. */
export function practiceBlock(save: GameSave, mode: GameMode, tc: TimeControl): string | null {
  const t = save.training;
  if (t.fatigue >= cfg.exhaustedAt) return 'You are too exhausted to play a focused game. Rest or end the day first.';
  if (mode === 'training') {
    const need = trainingHoursFor(tc);
    if (cfg.hoursPerDay - t.hoursUsedToday < need) return `A training game with this time control needs ${need} free hour${need === 1 ? '' : 's'} today.`;
  }
  const ap = practiceApCost(save, mode);
  if (save.player.ap.current < ap) return `Needs ${ap} AP, you have ${save.player.ap.current}. End the day to restore action points.`;
  return null;
}

export interface FinishedGame {
  mode: GameMode;
  opponent: Opponent;
  color: PieceColor;
  outcome: GameOutcome;
  termination: Termination;
  timeControl: TimeControl;
  startFen: string | null;
  moves: string[];
  objective: ObjectiveId | null;
  situation: string | null;
  rated: boolean;
  simulated?: boolean;
}

/** Elo change for the blitz rating. Provisional ratings move faster. */
export function blitzRatingChange(rating: number, opponent: number, outcome: GameOutcome, gamesPlayed: number): number {
  if (gamesPlayed < pcfg.provisionalGames) {
    const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
    return Math.round(40 * (score - expectedScore(rating, opponent)));
  }
  return eloChange(rating, opponent, outcome, gamesPlayed);
}

export interface RecordResult {
  save: GameSave;
  game: PlayedGame;
  ratingChange: number | null;
  gains: SessionGain[];
  /** Action points the game used */
  apSpent: number;
}

/** Adds a finished game to the save: history, blitz rating, experience, fatigue and hours. */
export function recordPracticeGame(save: GameSave, input: FinishedGame, db: OpeningDatabase): RecordResult {
  const { practice, training, player, world } = save;
  const simulated = !!input.simulated;
  const hit = input.startFen ? null : db.classify(input.moves);
  const entry = hit?.entry ?? null;

  let ratingBefore: number | null = null;
  let ratingAfter: number | null = null;
  let change: number | null = null;
  let blitzRating = practice.blitzRating;
  let blitzPeak = practice.blitzPeak;
  let blitzGames = practice.blitzGames;
  const onlineDelta = { ...practice.onlineDelta };
  if (input.mode === 'blitz' && input.rated) {
    ratingBefore = practice.blitzRating;
    change = blitzRatingChange(ratingBefore, input.opponent.elo, input.outcome, practice.blitzGames);
    ratingAfter = Math.max(100, ratingBefore + change);
    blitzRating = ratingAfter;
    blitzPeak = Math.max(blitzPeak, ratingAfter);
    blitzGames += 1;
    if (input.opponent.id) onlineDelta[input.opponent.id] = Math.round(((onlineDelta[input.opponent.id] ?? 0) - change * 0.25) * 10) / 10;
  }

  const game: PlayedGame = {
    ...world.date,
    id: `pg${practice.gameCounter + 1}`,
    mode: input.mode,
    opponentId: input.opponent.id,
    opponentName: input.opponent.name,
    opponentElo: input.opponent.elo,
    color: input.color,
    outcome: input.outcome,
    termination: input.termination,
    timeControl: input.timeControl.id,
    startFen: input.startFen,
    moves: input.moves,
    openingId: entry?.id ?? null,
    openingEco: entry?.eco ?? null,
    openingName: entry?.name ?? null,
    openingFamily: entry?.family ?? null,
    accuracy: null,
    analysis: null,
    ratingBefore,
    ratingAfter,
    objective: input.objective,
    situation: input.situation,
    simulated,
  };

  let next: GameSave = save;
  const def = OBJECTIVE_BY_ID[input.objective ?? 'free'];
  const effects =
    input.mode === 'blitz'
      ? [{ stat: 'tactics' as const, xp: 14 }, { stat: 'timeManagement' as const, xp: 16 }, { stat: 'pressure' as const, xp: 10 }, { stat: 'middlegame' as const, xp: 10 }]
      : def.effects;
  const key = `play-${input.mode}`;
  const todayCount = training.todayCounts[key] ?? 0;
  // Blitz games come in blocks of five, so the day's repeat penalty only grows once per block.
  const repeat = cfg.repeatFactor ** (input.mode === 'blitz' ? Math.floor(todayCount / pcfg.ap.blitzBlock) : todayCount);
  const efficiency = efficiencyAt(training.fatigue);
  const share = simulated ? pcfg.simulatedXp : 1;
  // Performance relative to the opponent, so a hard fight earns more even when it is lost.
  const score = input.outcome === 'win' ? 1 : input.outcome === 'draw' ? 0.5 : 0;
  const surprise = score - expectedScore(player.rating, input.opponent.elo);
  const quality = clamp(0.95 + surprise * 0.5 + (score - 0.5) * 0.2, 0.6, 1.35);
  const xp = { ...training.xp };
  const gains: SessionGain[] = [];
  for (const e of effects) {
    const start = getStat(next, e.stat);
    let value = start;
    const gained = round1(e.xp * cfg.xpGain * pcfg.xpScale[input.mode] * share * quality * efficiency * repeat * diminishing(start));
    let pool = (xp[e.stat] ?? 0) + gained;
    while (value < GAME_CONFIG.player.maxSkill && pool >= xpNeeded(value)) {
      pool -= xpNeeded(value);
      value += 1;
    }
    xp[e.stat] = value >= GAME_CONFIG.player.maxSkill ? 0 : round1(pool);
    if (value !== start) next = withStat(next, e.stat, value);
    gains.push({ stat: e.stat, xp: gained, levels: value - start, value });
  }
  const fatigue = clamp(round1(training.fatigue + pcfg.fatigue[input.mode] * (1 - player.attributes.stamina / 200)), 0, cfg.maxFatigue);
  const hours = input.mode === 'training' ? trainingHoursFor(input.timeControl) : 0;
  const apSpent = Math.min(player.ap.current, practiceApCost(save, input.mode));
  const nextTraining: TrainingState = {
    ...training,
    xp,
    fatigue,
    hoursUsedToday: training.hoursUsedToday + hours,
    todayCounts: { ...training.todayCounts, [key]: todayCount + 1 },
    // Only games the player played can be gone over with Analyze Your Game.
    unanalyzedGames: training.unanalyzedGames + (simulated ? 0 : 1),
  };
  const morale = clamp(player.morale + (input.mode === 'blitz' && !simulated ? (input.outcome === 'win' ? 1 : input.outcome === 'loss' ? -1 : 0) : 0), 0, 100);
  let sessions = save.history.sessions;
  if (input.mode === 'training') {
    const record: SessionRecord = {
      ...world.date,
      day: world.day,
      sessionId: 'practice-game',
      name: 'Training Game',
      quality: round1(quality * 100) / 100,
      qualityLabel: quality >= 1.15 ? 'Excellent' : quality >= 0.95 ? 'Good' : 'Solid',
      gains,
      fatigueAfter: fatigue,
      moraleDelta: 0,
      detail: `${def.label} vs ${input.opponent.name} (${input.opponent.elo}), ${input.outcome}${simulated ? ' (simulated)' : ''}`,
    };
    sessions = [...sessions, record].slice(-cfg.maxHistory);
  }

  next = {
    ...next,
    player: { ...next.player, morale, ap: { ...next.player.ap, current: player.ap.current - apSpent } },
    training: nextTraining,
    practice: {
      ...practice,
      pendingGame: null,
      games: [...practice.games, game].slice(-pcfg.maxGames),
      blitzRating,
      blitzPeak,
      blitzGames,
      onlineDelta,
      gameCounter: practice.gameCounter + 1,
    },
    history: { ...next.history, sessions },
  };
  return { save: next, game, ratingChange: change, gains, apSpent };
}

/** Stores the post-game analysis and the player's accuracy on a game. */
export function attachAnalysis(save: GameSave, gameId: string, analysis: GameAnalysisSummary): GameSave {
  const game = save.practice.games.find((g) => g.id === gameId);
  if (!game) return save;
  return {
    ...save,
    training: game.analysis === null && !game.simulated
      ? { ...save.training, unanalyzedGames: Math.max(0, save.training.unanalyzedGames - 1) }
      : save.training,
    practice: {
      ...save.practice,
      games: save.practice.games.map((g) => (g.id === gameId ? { ...g, analysis, accuracy: g.color === 'white' ? analysis.whiteAccuracy : analysis.blackAccuracy } : g)),
    },
  };
}

/** A persisted checkpoint means the previous page left a real game unfinished. */
export function recoverInterruptedPracticeGame(save: GameSave, db: OpeningDatabase): GameSave {
  const pending = save.practice.pendingGame;
  if (!pending) return save;
  // Only games with a move by both sides qualify for resignation.
  if (pending.moves.length < 2) return { ...save, practice: { ...save.practice, pendingGame: null } };
  return recordPracticeGame(save, { ...pending, outcome: 'loss', termination: 'resignation' }, db).save;
}

/** Records a Thematic Games session so the opening's knowledge grows. */
export function recordOpeningStudy(save: GameSave, openingId: string, openingName: string, score: number): GameSave {
  return {
    ...save,
    repertoire: { ...save.repertoire, study: [...save.repertoire.study, { ...save.world.date, openingId, openingName, score }].slice(-200) },
  };
}
