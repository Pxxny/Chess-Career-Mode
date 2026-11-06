import type { GameState } from '@/game/chess/rules';
import { normalizeMoves, type OpeningDatabase } from '@/game/openings/database';
import { labelOf } from '@/game/engine/analysis';
import type { GameAnalysisSummary, GameOutcome, MoveLabel, ObjectiveId, PieceColor } from '@/types';
import type { TimeControl } from './timeControls';

export interface FeedbackItem {
  tone: 'good' | 'warn' | 'info';
  title: string;
  text: string;
}

export interface MoveTimeInput {
  ply: number;
  ms: number;
  left: number | null;
}

export interface FeedbackInput {
  objective: ObjectiveId | null;
  color: PieceColor;
  outcome: GameOutcome;
  game: GameState;
  analysis: GameAnalysisSummary & { best?: Array<string | null>; losses?: number[] };
  db: OpeningDatabase;
  forcedLine: string[] | null;
  moveTimes: MoveTimeInput[];
  timeControl: TimeControl;
  /** Take-backs used, which are mentioned so the accuracy is read in context */
  takebacks?: number;
}

const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (v: number): string => `${Math.round(v)}%`;

/** Practical advice drawn from the analysis, tailored to what the player was practising. */
export function buildFeedback(input: FeedbackInput): FeedbackItem[] {
  const { analysis, color, game, objective } = input;
  const items: FeedbackItem[] = [];
  const labels = analysis.labels.split('').map((l) => labelOf(l));
  const total = labels.length;
  if (total === 0) return items;
  const ply = (i: number): string => `${game.positions[i].fullmove}${game.positions[i].turn === 'w' ? '.' : '...'}`;
  const sign = color === 'white' ? 1 : -1;
  const own = Array.from({ length: total }, (_, i) => i).filter((i) => (game.positions[i].turn === 'w') === (color === 'white'));
  const count = (label: MoveLabel): number => own.filter((i) => labels[i] === label).length;
  const blunders = count('blunder');
  const mistakes = count('mistake');
  const inaccuracies = count('inaccuracy');
  const accuracy = color === 'white' ? analysis.whiteAccuracy : analysis.blackAccuracy;
  // Evaluation from the player's side after each half-move, index 0 = the start.
  const evalFor = (i: number): number => (analysis.evals[i] ?? 0) * sign;

  items.push({
    tone: blunders + mistakes === 0 ? 'good' : blunders > 0 ? 'warn' : 'info',
    title: `Accuracy ${pct(accuracy)}`,
    text:
      blunders + mistakes + inaccuracies === 0
        ? 'No inaccuracies by the engine\'s measure. A very clean game.'
        : `${blunders} blunder${blunders === 1 ? '' : 's'}, ${mistakes} mistake${mistakes === 1 ? '' : 's'} and ${inaccuracies} inaccurac${inaccuracies === 1 ? 'y' : 'ies'} from you.`,
  });
  if (input.takebacks) items.push({ tone: 'info', title: 'Take-backs used', text: `You took back ${input.takebacks} time${input.takebacks === 1 ? '' : 's'}, so this accuracy reflects the moves you kept.` });

  const worst = [...own].sort((a, b) => (analysis.losses?.[b] ?? 0) - (analysis.losses?.[a] ?? 0))[0];
  if (worst !== undefined && (analysis.losses?.[worst] ?? 0) >= 10) {
    const better = analysis.best?.[worst];
    items.push({ tone: 'warn', title: 'Biggest swing', text: `Move ${ply(worst)} ${game.sans[worst]} cost ${Math.round(analysis.losses![worst])} points of winning chances${better ? ` (the engine preferred ${better.slice(0, 2)}-${better.slice(2, 4)})` : ''}.` });
  }

  switch (objective) {
    case 'opening': {
      const sans = normalizeMoves(game.sans);
      const line = input.forcedLine ? normalizeMoves(input.forcedLine) : null;
      const hit = input.db.classify(sans);
      if (hit) items.push({ tone: 'info', title: 'Opening reached', text: `${hit.entry.eco} ${hit.entry.name}. The game stayed in known theory for ${hit.bookPlies} half-moves.` });
      if (line) {
        // Where did the player first leave the opponent's line (the opponent plays it, so only the player can deviate)?
        const first = sans.findIndex((m, i) => line[i] !== undefined && m !== line[i]);
        if (first === -1) items.push({ tone: 'good', title: 'Followed the line', text: `You stayed on the planned line for all ${Math.min(sans.length, line.length)} half-moves.` });
        else items.push({ tone: 'warn', title: 'You left the line', text: `At move ${ply(first)} you played ${game.sans[first]}; the line continues with ${line[first]}.` });
      }
      const book = own.filter((i) => labels[i] === 'book').length;
      items.push({ tone: book >= 4 ? 'good' : 'info', title: 'Theory moves', text: `${book} of your moves were known theory.` });
      break;
    }
    case 'tactics': {
      const big = own.filter((i) => (analysis.losses?.[i] ?? 0) >= 15);
      items.push({
        tone: big.length === 0 ? 'good' : 'warn',
        title: 'Tactical alertness',
        text: big.length === 0 ? 'You avoided every serious tactical slip.' : `You had ${big.length} serious tactical slip${big.length === 1 ? '' : 's'}, at move${big.length === 1 ? '' : 's'} ${big.slice(0, 4).map((i) => ply(i)).join(', ')}. Check each with "what does this leave undefended?" before playing it.`,
      });
      const swings = own.filter((i) => evalFor(i + 1) - evalFor(i) >= 150).length;
      if (swings > 0) items.push({ tone: 'good', title: 'Tactics found', text: `${swings} of your moves won material or created a large advantage.` });
      break;
    }
    case 'endgame': {
      const late = own.filter((i) => i >= total * 0.5);
      const averageLoss = avg(late.map((i) => analysis.losses?.[i] ?? 0));
      items.push({
        tone: input.outcome === 'loss' ? 'warn' : 'good',
        title: 'Endgame result',
        text: input.outcome === 'win' ? 'You won the ending.' : input.outcome === 'draw' ? 'You held the ending to a draw.' : 'The ending was lost. Look at the key moments below for where the technique slipped.',
      });
      if (late.length) items.push({ tone: 'info', title: 'Technique', text: `Your moves in the second half of the game lost on average ${Math.round(averageLoss)} points of winning chances per move.` });
      break;
    }
    case 'conversion': {
      const best = Math.max(...analysis.evals.map((_, i) => evalFor(i)));
      const slip = analysis.evals.findIndex((_, i) => i > 0 && evalFor(i - 1) >= 150 && evalFor(i) < 60);
      if (input.outcome === 'win') items.push({ tone: 'good', title: 'Converted', text: 'You turned the extra material into a win.' });
      else items.push({ tone: 'warn', title: input.outcome === 'draw' ? 'Not converted' : 'Advantage lost', text: slip > 0 ? `The advantage slipped at move ${ply(slip - 1)} (${game.sans[slip - 1]}). Trade pieces and keep your king safe before pushing.` : `Your best evaluation was ${(best / 100).toFixed(1)}, but it was not turned into a win.` });
      break;
    }
    case 'defence': {
      const worstEval = Math.min(...analysis.evals.map((_, i) => evalFor(i)));
      items.push({
        tone: input.outcome === 'loss' ? 'info' : 'good',
        title: input.outcome === 'win' ? 'A swindle' : input.outcome === 'draw' ? 'You held on' : 'Resistance',
        text: input.outcome === 'loss' ? `Being ${Math.abs(worstEval / 100).toFixed(1)} down is hard. Look for forcing moves that set problems, and avoid passive moves that allow a clean win.` : 'You saved a worse position, which is a real skill. The opponent had chances to finish you off and you did not allow them.',
      });
      break;
    }
    case 'time': {
      const times = input.moveTimes.filter((t) => t.ply > 10);
      const hurried = times.filter((t) => t.ms < 2000).length;
      const trouble = input.moveTimes.filter((t) => t.left !== null && t.left < input.timeControl.base * 1000 * 0.1).length;
      const fast = own.filter((i) => (input.moveTimes.find((t) => t.ply === i + 1)?.ms ?? 99999) < 2000 && (analysis.losses?.[i] ?? 0) >= 10).length;
      items.push({ tone: trouble === 0 ? 'good' : 'warn', title: 'Time trouble', text: trouble === 0 ? 'You never fell below 10% of your time.' : `You were under 10% of your time for ${trouble} move${trouble === 1 ? '' : 's'}. Spend less in the opening and save time for critical positions.` });
      if (times.length) items.push({ tone: hurried / times.length > 0.5 ? 'warn' : 'info', title: 'Pace', text: `You averaged ${(avg(times.map((t) => t.ms)) / 1000).toFixed(1)} seconds a move after the opening, and played ${hurried} of ${times.length} of them in under two seconds.` });
      if (fast > 0) items.push({ tone: 'warn', title: 'Hurried errors', text: `${fast} of your quick moves (under two seconds) were mistakes. Slow down when the position is tense.` });
      break;
    }
    default: {
      const third = Math.ceil(total / 3);
      const phase = (from: number, to: number): number | null => {
        const idx = own.filter((i) => i >= from && i < to);
        return idx.length ? 100 - avg(idx.map((i) => analysis.losses?.[i] ?? 0)) * 2 : null;
      };
      const phases: Array<[string, number | null]> = [['opening', phase(0, third)], ['middlegame', phase(third, third * 2)], ['endgame', phase(third * 2, total)]];
      const known = phases.filter((p): p is [string, number] => p[1] !== null);
      if (known.length >= 2) {
        const weakest = [...known].sort((a, b) => a[1] - b[1])[0];
        items.push({ tone: 'info', title: 'Weakest phase', text: `Your ${weakest[0]} was the loosest part of the game. Train it in the Sessions tab.` });
      }
    }
  }

  // The turning point, for every objective.
  const swingAt = analysis.evals.findIndex((_, i) => i > 0 && Math.abs(evalFor(i) - evalFor(i - 1)) >= 200);
  if (swingAt > 0 && objective !== 'conversion') items.push({ tone: 'info', title: 'Turning point', text: `The evaluation changed sharply after move ${ply(swingAt - 1)} ${game.sans[swingAt - 1]}.` });
  return items;
}
