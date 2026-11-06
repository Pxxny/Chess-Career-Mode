import { legalMoves } from '@/game/chess/board';
import { currentPosition, moveToUci, parseUci, type GameState } from '@/game/chess/rules';
import type { Rng } from '@/game/rng';
import type { EngineManager } from './manager';
import { lineScore, pickCandidate, type Strength } from './strength';
import type { SearchLine } from './types';

export interface MoveChoice {
  uci: string;
  /** Evaluation of the best line in centipawns from the mover's point of view (mates are +-10000) */
  evalCp: number;
  engineName: string;
  lines: SearchLine[];
}

/**
 * Asks the engine for a move at the given strength. The returned move is always legal:
 * if the engine ever returns something illegal, the best legal move found by the built-in
 * search (or, as a last resort, the first legal move) is used instead.
 */
export async function chooseEngineMove(engine: EngineManager, game: GameState, strength: Strength, rng: Rng): Promise<MoveChoice> {
  const pos = currentPosition(game);
  const legal = legalMoves(pos);
  if (legal.length === 0) throw new Error('The game is over: there are no legal moves.');
  if (legal.length === 1) return { uci: moveToUci(legal[0]), evalCp: 0, engineName: 'Only move', lines: [] };

  const answer = await engine.search({
    fen: game.startFen,
    moves: game.ucis,
    movetime: strength.movetime,
    multiPv: strength.multiPv,
    limitElo: strength.limitElo,
    depth: undefined,
  });
  const lines = answer.lines.length ? answer.lines : [{ uci: answer.best, cp: 0, mate: null, pv: [answer.best], depth: answer.depth }];
  const picked = pickCandidate(lines, strength.temperature, rng);
  let uci = picked.uci;
  if (!parseUci(pos, uci, legal)) {
    // Never trust an engine blindly: fall back to any legal candidate, then to the first legal move.
    const alternative = lines.find((l) => parseUci(pos, l.uci, legal));
    uci = alternative?.uci ?? moveToUci(legal[0]);
  }
  return { uci, evalCp: Math.max(-10000, Math.min(10000, lineScore(lines[0]))), engineName: answer.engineName, lines };
}
