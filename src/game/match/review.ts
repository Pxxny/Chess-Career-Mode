import { applyMove, legalMoves, toSan, type Position } from '@/game/chess/board';
import { currentPosition, detectEnd, parseUci, type GameState } from '@/game/chess/rules';
import { combineAccuracy, EVAL_CLAMP, moveAccuracy, winPercent } from '@/game/engine/analysis';
import type { EngineAnswer } from '@/game/engine/manager';
import type { SearchLine, SearchRequest } from '@/game/engine/types';
import type { OpeningDatabase } from '@/game/openings/database';
import type { MatchAnalysisReport, MatchOpening, MoveReview, PieceColor, ReviewLabel } from '@/types';

/** The only thing the analysis needs from an engine. */
export interface EngineLike {
  search(request: SearchRequest): Promise<EngineAnswer>;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round1 = (v: number): number => Math.round(v * 10) / 10;

const VALUE: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9 };

/** Material balance in pawns from White's point of view. */
export function material(pos: Position): number {
  let total = 0;
  for (const p of pos.board) {
    if (!p) continue;
    const v = VALUE[p.toUpperCase()] ?? 0;
    total += p === p.toUpperCase() ? v : -v;
  }
  return total;
}

/** Score of a line from the side to move's point of view, centipawns, mates clamped. */
export function lineCp(line: SearchLine): number {
  if (line.mate !== null) return line.mate > 0 ? EVAL_CLAMP : -EVAL_CLAMP;
  return clamp(line.cp ?? 0, -EVAL_CLAMP, EVAL_CLAMP);
}

/** Thresholds, in win-percentage points given away. One place, so the labels are the same everywhere. */
export const THRESHOLDS = { best: 0.5, excellent: 2, good: 5, inaccuracy: 10, mistake: 20 } as const;

/** Judges a move from the win-percentage it gave away, without the special labels. */
export function baseLabel(loss: number, playedBest: boolean): ReviewLabel {
  if (playedBest || loss <= THRESHOLDS.best) return 'best';
  if (loss <= THRESHOLDS.excellent) return 'excellent';
  if (loss < THRESHOLDS.good) return 'good';
  if (loss < THRESHOLDS.inaccuracy) return 'inaccuracy';
  if (loss < THRESHOLDS.mistake) return 'mistake';
  return 'blunder';
}

export const LABEL_LETTER: Record<ReviewLabel, string> = { brilliant: 'R', best: 'b', excellent: 'e', good: 'g', book: 'B', inaccuracy: 'i', mistake: 'm', missed: 'o', blunder: 'x' };
export const LABEL_FROM_LETTER: Record<string, ReviewLabel> = Object.fromEntries(Object.entries(LABEL_LETTER).map(([k, v]) => [v, k as ReviewLabel]));

export const ERROR_LABELS: readonly ReviewLabel[] = ['inaccuracy', 'mistake', 'missed', 'blunder'];

/**
 * Walks the engine's line after the move. Returns the material change for the mover after an even number of
 * half-moves (the opponent has answered), so a trade in progress does not look like a sacrifice.
 */
export function materialAlongLine(before: Position, pv: readonly string[], moverWhite: boolean, maxPlies = 6): { start: number; end: number; plies: number } {
  const sign = moverWhite ? 1 : -1;
  const start = material(before) * sign;
  let pos = before;
  let atEven = start;
  let evenPlies = 0;
  for (let i = 0; i < Math.min(pv.length, maxPlies); i++) {
    const m = parseUci(pos, pv[i]);
    if (!m) break;
    pos = applyMove(pos, m);
    if ((i + 1) % 2 === 0) {
      atEven = material(pos) * sign;
      evenPlies = i + 1;
    }
  }
  return { start, end: atEven, plies: evenPlies };
}

/** A sacrifice: the line gives up at least two pawns of material that it does not win back within the line. */
export const isSacrifice = (before: Position, pv: readonly string[], moverWhite: boolean): boolean => {
  const walk = materialAlongLine(before, pv, moverWhite);
  return walk.plies >= 2 && walk.end <= walk.start - 2;
};

interface PositionData {
  /** Evaluation White's point of view, clamped */
  eval: number;
  /** Mate in N for White (positive) or Black (negative); 0 = checkmate on the board; null = no forced mate */
  mate: number | null;
  lines: SearchLine[];
  best: string | null;
}

export interface AnalyzeMatchOptions {
  game: GameState;
  depth: number;
  /** Per-position time budget, milliseconds */
  movetime?: number;
  multiPv?: number;
  /** Half-moves inside the opening book */
  bookPlies?: number;
  onProgress?: (done: number, total: number) => void;
  isCancelled?: () => boolean;
}

/** Identifies the opening from the SAN moves. */
export function identifyOpening(db: OpeningDatabase, sans: readonly string[], game?: GameState): MatchOpening | null {
  const hit = db.classify(sans);
  if (!hit) return null;
  let leftBookBy: PieceColor | null = null;
  if (hit.bookPlies < sans.length) {
    const turn = game ? game.positions[hit.bookPlies]?.turn : hit.bookPlies % 2 === 0 ? 'w' : 'b';
    leftBookBy = turn === 'b' ? 'black' : 'white';
  }
  return { id: hit.entry.id, eco: hit.entry.eco, name: hit.entry.name, family: hit.entry.family, bookPlies: hit.bookPlies, leftBookBy };
}

/**
 * Evaluates every position of a finished game with the engine and judges every move from what the engine found.
 * Nothing here is random: labels come from win-percentage lost, the engine's best move, the gap to its second
 * choice, and the material its main line gives up.
 */
export async function analyzeMatch(engine: EngineLike, options: AnalyzeMatchOptions, db?: OpeningDatabase): Promise<MatchAnalysisReport> {
  const { game, depth } = options;
  const multiPv = options.multiPv ?? 2;
  const movetime = options.movetime ?? (game.ucis.length > 90 ? 700 : 1200);
  const total = game.ucis.length + 1;
  const data: PositionData[] = [];
  let engineName = 'Built-in engine';
  let usedDepth = depth;

  for (let i = 0; i < total; i++) {
    if (options.isCancelled?.()) throw new Error('cancelled');
    const sub: GameState = { ...game, positions: game.positions.slice(0, i + 1), moves: game.moves.slice(0, i), sans: game.sans.slice(0, i), ucis: game.ucis.slice(0, i), keys: game.keys.slice(0, i + 1) };
    const pos = currentPosition(sub);
    const sign = pos.turn === 'w' ? 1 : -1;
    const end = detectEnd(sub);
    if (legalMoves(pos).length === 0 || (end && end.result === 'draw')) {
      const mated = end?.reason === 'checkmate';
      data.push({ eval: end?.result === 'white' ? EVAL_CLAMP : end?.result === 'black' ? -EVAL_CLAMP : 0, mate: mated ? 0 : null, lines: [], best: null });
    } else {
      const answer = await engine.search({ fen: game.startFen, moves: sub.ucis, depth, movetime, multiPv });
      engineName = answer.engineName;
      usedDepth = answer.depth || depth;
      const top = answer.lines[0];
      data.push({
        eval: lineCp(top) * sign,
        mate: top.mate !== null ? top.mate * sign : null,
        lines: answer.lines,
        best: answer.best,
      });
    }
    options.onProgress?.(i + 1, total);
  }

  const moves: MoveReview[] = [];
  const whiteAcc: number[] = [];
  const blackAcc: number[] = [];

  for (let ply = 1; ply < total; ply++) {
    const before = game.positions[ply - 1];
    const whiteMoved = before.turn === 'w';
    const sign = whiteMoved ? 1 : -1;
    const color: PieceColor = whiteMoved ? 'white' : 'black';
    const prior = data[ply - 1];
    const after = data[ply];
    const playedUci = game.ucis[ply - 1];
    const beforeWin = winPercent(prior.eval * sign);
    const afterWin = winPercent(after.eval * sign);
    const loss = Math.max(0, beforeWin - afterWin);
    const playedBest = prior.best === playedUci;
    const only = legalMoves(before).length === 1;

    const bestLine = prior.lines[0] ?? null;
    const secondLine = prior.lines[1] ?? null;
    const gap = bestLine && secondLine ? Math.max(0, winPercent(lineCp(bestLine)) - winPercent(lineCp(secondLine))) : null;
    const playedLine = prior.lines.find((l) => l.uci === playedUci) ?? null;
    const bestMateForMover = bestLine && bestLine.mate !== null && bestLine.mate > 0 ? bestLine.mate : null;

    let label = baseLabel(loss, playedBest);
    const sacrifice = playedLine ? isSacrifice(before, playedLine.pv, whiteMoved) : false;

    if (ply <= (options.bookPlies ?? 0) && (label === 'best' || label === 'excellent' || label === 'good')) {
      label = 'book';
    } else if ((label === 'best' || label === 'excellent') && sacrifice && !only && gap !== null && gap >= 5 && beforeWin < 92 && afterWin >= 45) {
      label = 'brilliant';
    } else if (label === 'inaccuracy' || label === 'mistake' || label === 'blunder') {
      const previousLoss = ply >= 2 ? moves[ply - 2].loss : 0;
      const bestWinMover = bestLine ? winPercent(lineCp(bestLine)) : beforeWin;
      const opponentErred = previousLoss >= 8;
      // The opponent just gave something away (or there was a forced mate), and this move did not take it.
      const missed = (label !== 'blunder' && bestWinMover >= 65 && opponentErred) || bestMateForMover !== null;
      if (missed) label = 'missed';
    }

    // Forced-mate information about the best line, for the text of an opportunity.
    const sanLine: string[] = [];
    let walk = before;
    for (const uci of (bestLine?.pv ?? []).slice(0, 5)) {
      const m = parseUci(walk, uci);
      if (!m) break;
      sanLine.push(toSan(walk, m));
      walk = applyMove(walk, m);
    }
    const bestMove = prior.best ? parseUci(before, prior.best) : null;
    let motif: string | null = null;
    if (bestMateForMover !== null) motif = `Forced mate in ${bestMateForMover}`;
    else if (bestLine) {
      const walkBest = materialAlongLine(before, bestLine.pv, whiteMoved);
      if (walkBest.plies >= 2 && walkBest.end >= walkBest.start + 2 && (gap ?? 0) >= 8) motif = 'Wins material';
      else if ((gap ?? 0) >= 15) motif = beforeWin < 45 ? 'Only defence' : 'Only move';
    }

    const review: MoveReview = {
      ply,
      san: game.sans[ply - 1],
      color,
      label,
      loss: round1(loss),
      evalAfter: after.eval,
      mateAfter: after.mate,
      bestUci: prior.best,
      bestSan: bestMove ? toSan(before, bestMove) : null,
      line: playedBest || label === 'best' || label === 'brilliant' ? [] : sanLine,
      gap: gap === null ? null : round1(gap),
      sacrifice,
      forcedMate: bestMateForMover,
      motif,
    };
    // Keep the line of the best move for opportunity text only when it is long enough to be of use.
    if (review.line.length === 0 && bestLine && (gap ?? 0) >= 15) review.line = sanLine;
    moves.push(review);
    (whiteMoved ? whiteAcc : blackAcc).push(moveAccuracy(loss));
  }

  return {
    engine: engineName,
    depth: usedDepth,
    evals: data.map((d) => d.eval),
    moves,
    whiteAccuracy: combineAccuracy(whiteAcc),
    blackAccuracy: combineAccuracy(blackAcc),
    opening: db ? identifyOpening(db, game.sans, game) : null,
  };
}

// ---- sections of the report, all derived from the per-move judgements

export type Counts = Record<ReviewLabel, number>;

export const emptyCounts = (): Counts => ({ brilliant: 0, best: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, missed: 0, blunder: 0 });

export function countLabels(report: MatchAnalysisReport): Record<PieceColor, Counts> {
  const out = { white: emptyCounts(), black: emptyCounts() };
  for (const m of report.moves) out[m.color][m.label]++;
  return out;
}

/** Win percentage for `color` after the move at `ply` (ply 0 = start). */
export const winFor = (report: MatchAnalysisReport, ply: number, color: PieceColor): number => {
  const cp = report.evals[Math.min(Math.max(0, ply), report.evals.length - 1)] ?? 0;
  return winPercent(color === 'white' ? cp : -cp);
};

export interface Moment {
  review: MoveReview;
  kind: ReviewLabel | 'turning-point';
  /** Why the move matters, one sentence */
  text: string;
  importance: number;
}

const fmtPawns = (cp: number): string => `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`;

/** Compact evaluation text from White's point of view: "+0.4", "-2.1", "M3", "#". */
export function evalText(cp: number, mate: number | null): string {
  if (mate === 0) return '#';
  if (mate !== null) return `${mate > 0 ? '' : '-'}M${Math.abs(mate)}`;
  return fmtPawns(cp);
}

/**
 * The important moves of the game: brilliant moves, missed opportunities, mistakes and blunders, and the best
 * moves that found a tactic. Sorted by the order they were played.
 */
export function keyMoments(report: MatchAnalysisReport, limit = 10): Moment[] {
  const moments: Moment[] = [];
  const previous = (ply: number): number => report.evals[ply - 1] ?? 0;
  for (const m of report.moves) {
    const before = previous(m.ply);
    const swing = `${evalText(before, null)} → ${evalText(m.evalAfter, m.mateAfter)}`;
    if (m.label === 'brilliant') {
      moments.push({ review: m, kind: 'brilliant', text: `A sacrifice the engine confirms: the position stays sound (${swing}).`, importance: 60 + (m.gap ?? 0) });
    } else if (m.label === 'blunder') {
      moments.push({ review: m, kind: 'blunder', text: `Lost ${Math.round(m.loss)} points of winning chances (${swing}).${m.bestSan ? ` ${m.bestSan} was needed.` : ''}`, importance: 40 + m.loss });
    } else if (m.label === 'mistake') {
      moments.push({ review: m, kind: 'mistake', text: `Lost ${Math.round(m.loss)} points of winning chances (${swing}).${m.bestSan ? ` Better was ${m.bestSan}.` : ''}`, importance: 25 + m.loss });
    } else if (m.label === 'missed') {
      const what = m.forcedMate ? `a forced mate in ${m.forcedMate}` : 'a winning chance';
      moments.push({ review: m, kind: 'missed', text: `Missed ${what}${m.bestSan ? `: ${m.bestSan} was stronger` : ''} (${swing}).`, importance: 35 + m.loss });
    } else if ((m.label === 'best' || m.label === 'excellent') && (m.gap ?? 0) >= 20) {
      moments.push({ review: m, kind: m.label, text: `The only move that kept the advantage: the next best lost ${Math.round(m.gap ?? 0)} points.`, importance: 20 + (m.gap ?? 0) / 2 });
    }
  }
  moments.sort((a, b) => b.importance - a.importance);
  return moments.slice(0, limit).sort((a, b) => a.review.ply - b.review.ply);
}

/** Mistakes and blunders that swung the game: an advantage thrown away or a position that collapsed. */
export function criticalMistakes(report: MatchAnalysisReport, limit = 5): MoveReview[] {
  return report.moves
    .filter((m) => m.label === 'mistake' || m.label === 'blunder' || (m.label === 'missed' && m.loss >= 15))
    .filter((m) => {
      const beforeWin = winFor(report, m.ply - 1, m.color);
      const afterWin = winFor(report, m.ply, m.color);
      return (beforeWin >= 55 && afterWin < 45) || (beforeWin >= 40 && afterWin < 20) || m.loss >= 25;
    })
    .sort((a, b) => b.loss - a.loss)
    .slice(0, limit)
    .sort((a, b) => a.ply - b.ply);
}

export const missedOpportunities = (report: MatchAnalysisReport): MoveReview[] => report.moves.filter((m) => m.label === 'missed');

export interface TacticalOpportunity {
  review: MoveReview;
  /** True when the player of that move found it */
  found: boolean;
  motif: string;
}

/** Positions where one move stood out (a forced mate, a gain of material, or the only move), found or missed. */
export function tacticalOpportunities(report: MatchAnalysisReport, limit = 12): TacticalOpportunity[] {
  const out: TacticalOpportunity[] = [];
  for (const m of report.moves) {
    if (!m.motif) continue;
    const found = m.label === 'best' || m.label === 'brilliant' || m.label === 'excellent' || m.label === 'book';
    out.push({ review: m, found, motif: m.motif });
  }
  return out.slice(0, limit);
}

/** Moves worse than "good", each with what the engine preferred and its main line. */
export const betterAlternatives = (report: MatchAnalysisReport): MoveReview[] => report.moves.filter((m) => ERROR_LABELS.includes(m.label) && m.bestSan && m.bestSan !== m.san);

/** Short advice sentence for a label. */
export const LABEL_TEXT: Record<ReviewLabel, string> = {
  brilliant: 'Brilliant move',
  best: 'Best move',
  excellent: 'Excellent move',
  good: 'Good move',
  book: 'Book move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  missed: 'Missed opportunity',
  blunder: 'Blunder',
};
