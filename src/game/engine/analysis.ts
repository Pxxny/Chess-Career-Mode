import { legalMoves, toSan } from '@/game/chess/board';
import { currentPosition, detectEnd, parseUci, type GameState } from '@/game/chess/rules';
import type { GameAnalysisSummary, MoveLabel } from '@/types';
import type { EngineManager } from './manager';

export const EVAL_CLAMP = 1500;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Chance of winning from a centipawn score, 0 to 100 (Lichess's logistic model). */
export const winPercent = (cp: number): number => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamp(cp, -EVAL_CLAMP, EVAL_CLAMP))) - 1);

/** Accuracy of one move from the win-percentage it gave away (Lichess's formula). */
export const moveAccuracy = (lossPoints: number): number => clamp(103.1668 * Math.exp(-0.04354 * lossPoints) - 3.1669, 0, 100);

/** Average of the arithmetic and harmonic means, so blunders weigh more than in a plain average. */
export function combineAccuracy(values: number[]): number {
  if (values.length === 0) return 100;
  const arithmetic = values.reduce((s, v) => s + v, 0) / values.length;
  const harmonic = values.length / values.reduce((s, v) => s + 1 / Math.max(v, 1), 0);
  return Math.round(((arithmetic + harmonic) / 2) * 10) / 10;
}

export const LABEL_LETTER: Record<MoveLabel, string> = { book: 'B', best: 'b', good: 'g', inaccuracy: 'i', mistake: 'm', blunder: 'x' };
const LETTER_LABEL: Record<string, MoveLabel> = { B: 'book', b: 'best', g: 'good', i: 'inaccuracy', m: 'mistake', x: 'blunder' };
export const labelOf = (letter: string): MoveLabel => LETTER_LABEL[letter] ?? 'good';

/** Win-percentage points lost by a move, from the mover's point of view. */
export function classifyLoss(loss: number, playedBest: boolean): MoveLabel {
  if (playedBest || loss <= 1) return 'best';
  if (loss < 5) return 'good';
  if (loss < 10) return 'inaccuracy';
  if (loss < 20) return 'mistake';
  return 'blunder';
}

export interface KeyMoment {
  /** 1-based half-move number */
  ply: number;
  san: string;
  label: MoveLabel;
  color: 'white' | 'black';
  /** Win-percentage points lost */
  loss: number;
  /** What the engine preferred, in SAN */
  betterSan: string | null;
}

export interface GameAnalysis extends GameAnalysisSummary {
  /** Win-percentage points lost by each half-move */
  losses: number[];
  /** Engine's preferred move (UCI) in the position before each half-move */
  best: Array<string | null>;
  keyMoments: KeyMoment[];
}

export interface AnalyzeOptions {
  game: GameState;
  depth: number;
  /** Half-moves that are still inside the opening book (labelled "book") */
  bookPlies?: number;
  onProgress?: (done: number, total: number) => void;
  isCancelled?: () => boolean;
}

/** Evaluates every position of a game and judges every move. Throws "cancelled" if cancelled. */
export async function analyzeGame(engine: EngineManager, options: AnalyzeOptions): Promise<GameAnalysis> {
  const { game, depth, bookPlies = 0 } = options;
  const total = game.ucis.length + 1;
  const evals: number[] = [];
  const best: Array<string | null> = [];
  let engineName = 'Built-in engine';
  let usedDepth = depth;

  for (let i = 0; i < total; i++) {
    if (options.isCancelled?.()) throw new Error('cancelled');
    const sub: GameState = { ...game, positions: game.positions.slice(0, i + 1), moves: game.moves.slice(0, i), sans: game.sans.slice(0, i), ucis: game.ucis.slice(0, i), keys: game.keys.slice(0, i + 1) };
    const pos = currentPosition(sub);
    const end = detectEnd(sub);
    const turnSign = pos.turn === 'w' ? 1 : -1;
    if (legalMoves(pos).length === 0 || (end && end.result === 'draw')) {
      evals.push(end?.result === 'white' ? EVAL_CLAMP : end?.result === 'black' ? -EVAL_CLAMP : 0);
      best.push(null);
    } else {
      const answer = await engine.search({ fen: game.startFen, moves: sub.ucis, depth, movetime: 1500 });
      const line = answer.lines[0];
      engineName = answer.engineName;
      usedDepth = answer.depth || depth;
      const score = line.mate !== null ? (line.mate > 0 ? EVAL_CLAMP : -EVAL_CLAMP) : clamp(line.cp ?? 0, -EVAL_CLAMP, EVAL_CLAMP);
      evals.push(score * turnSign);
      best.push(answer.best);
    }
    options.onProgress?.(i + 1, total);
  }

  const losses: number[] = [];
  const labels: MoveLabel[] = [];
  const whiteAcc: number[] = [];
  const blackAcc: number[] = [];
  for (let ply = 1; ply < total; ply++) {
    const whiteMoved = game.positions[ply - 1].turn === 'w';
    const sign = whiteMoved ? 1 : -1;
    const before = winPercent(evals[ply - 1] * sign);
    const after = winPercent(evals[ply] * sign);
    const loss = Math.max(0, before - after);
    const playedBest = best[ply - 1] === game.ucis[ply - 1];
    let label = classifyLoss(loss, playedBest);
    if (ply <= bookPlies && (label === 'good' || label === 'best')) label = 'book';
    losses.push(Math.round(loss * 10) / 10);
    labels.push(label);
    (whiteMoved ? whiteAcc : blackAcc).push(moveAccuracy(loss));
  }

  const keyMoments: KeyMoment[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== 'mistake' && labels[i] !== 'blunder') continue;
    const prior = game.positions[i];
    const bestMove = best[i] ? parseUci(prior, best[i]!) : null;
    keyMoments.push({
      ply: i + 1,
      san: game.sans[i],
      label: labels[i],
      color: prior.turn === 'w' ? 'white' : 'black',
      loss: losses[i],
      betterSan: bestMove ? toSan(prior, bestMove) : null,
    });
  }
  keyMoments.sort((a, b) => b.loss - a.loss);

  return {
    engine: engineName,
    depth: usedDepth,
    evals,
    labels: labels.map((l) => LABEL_LETTER[l]).join(''),
    whiteAccuracy: combineAccuracy(whiteAcc),
    blackAccuracy: combineAccuracy(blackAcc),
    losses,
    best,
    keyMoments,
  };
}
