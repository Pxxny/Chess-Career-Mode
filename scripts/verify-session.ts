import assert from 'node:assert/strict';
import { randomAppearance } from '../src/data/appearance.ts';
import { createCareerRecord } from '../src/game/career/createCareer.ts';
import { gameFromSans } from '../src/game/chess/rules.ts';
import { createNewSave } from '../src/game/createNewSave.ts';
import { analyzeGame } from '../src/game/engine/analysis.ts';
import type { EngineManager } from '../src/game/engine/manager.ts';
import { getBaseOpeningDatabase } from '../src/game/openings/database.ts';
import { buildFeedback } from '../src/game/play/feedback.ts';
import { engineOpponent } from '../src/game/play/opponent.ts';
import { attachAnalysis, recordPracticeGame, recoverInterruptedPracticeGame, type FinishedGame } from '../src/game/play/practice.ts';
import { findTimeControl } from '../src/game/play/timeControls.ts';

const db = getBaseOpeningDatabase();
const game = gameFromSans(['e5', 'Nf3'], 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 17');
assert.equal(game.sans.length, 2);
// A large swing after Black's first move must count against Black, even though
// it is the first ply in this custom-FEN game.
const scores = [1000, 1000, -1000];
const fake = {
  async search(request: { moves?: string[] }) {
    const index = request.moves?.length ?? 0;
    return { engineName: 'Deterministic fixture', depth: 2, best: index === 0 ? 'c7c5' : 'g1f3', lines: [{ cp: scores[index], mate: null }] };
  },
} as unknown as EngineManager;
const analysis = await analyzeGame(fake, { game, depth: 2 });
assert.equal(analysis.labels[0], 'x');
assert.equal(analysis.keyMoments[0].color, 'black');
assert.equal(analysis.whiteAccuracy, 100);
assert.ok(analysis.blackAccuracy < 5);
const feedback = buildFeedback({ game, analysis, color: 'black', objective: 'endgame', outcome: 'loss', db, forcedLine: null, moveTimes: [], timeControl: findTimeControl('none') });
assert.match(feedback[0].text, /1 blunder/);
assert.match(feedback.find((item) => item.title === 'Biggest swing')!.text, /17\.\.\. e5/);

const options = { name: 'Recovery test', gender: 'undisclosed' as const, countryCode: 'NO', city: { name: 'Oslo', custom: false }, archetype: 'balanced' as const, appearance: randomAppearance(), startYear: 2020, alternateHistory: false };
const base = createNewSave(options, createCareerRecord(options));
const input: FinishedGame = { mode: 'blitz', opponent: { ...engineOpponent(1500), id: 'online-test' }, color: 'white', outcome: 'loss', termination: 'resignation', timeControl: findTimeControl('5+0'), startFen: null, moves: ['e4', 'e5'], objective: null, situation: null, rated: true };
const pending = { ...base, practice: { ...base.practice, pendingGame: input } };
const recovered = recoverInterruptedPracticeGame(pending, db);
assert.equal(recovered.practice.games.length, 1);
assert.equal(recovered.practice.games[0].termination, 'resignation');
assert.equal(recovered.practice.games[0].outcome, 'loss');
assert.equal(recovered.practice.blitzGames, 1);
assert.equal(recovered.practice.pendingGame, null);
assert.equal(recoverInterruptedPracticeGame(recovered, db), recovered, 'recovery must run exactly once');
const finished = recordPracticeGame(pending, { ...input, outcome: 'win' }, db).save;
assert.equal(finished.practice.pendingGame, null);
assert.equal(recoverInterruptedPracticeGame(finished, db), finished, 'normal game end must clear checkpoint atomically');
const tooShort = recoverInterruptedPracticeGame({ ...pending, practice: { ...pending.practice, pendingGame: { ...input, moves: ['e4'] } } }, db);
assert.equal(tooShort.practice.games.length, 0);
const annotated = attachAnalysis(recovered, recovered.practice.games[0].id, analysis);
assert.equal(annotated.training.unanalyzedGames, recovered.training.unanalyzedGames - 1);
assert.equal(attachAnalysis(annotated, recovered.practice.games[0].id, analysis).training.unanalyzedGames, annotated.training.unanalyzedGames, 're-attaching analysis must not decrement again');
assert.equal(attachAnalysis(annotated, 'missing', analysis), annotated);
console.log('Session verification passed: Black-first analysis/feedback, interrupted-game recovery exactly once, atomic finish, analysis accounting.');
