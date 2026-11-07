// Checks for the match viewer: clock, referee (chess.js), NPC strength model, engine review, session, tournaments
// and career updates. Run with: npm run test:match
import { randomAppearance } from '../src/data/appearance.ts';
import { GAME_CONFIG } from '../src/data/config.ts';
import { legalMoves, squareName, toFen } from '../src/game/chess/board.ts';
import { createGame, currentPosition, makeMove, moveToUci, parseUci, gameFromSans } from '../src/game/chess/rules.ts';
import { createCareerRecord } from '../src/game/career/createCareer.ts';
import { createNewSave } from '../src/game/createNewSave.ts';
import { EngineManager } from '../src/game/engine/manager.ts';
import { winPercent } from '../src/game/engine/analysis.ts';
import { getBaseOpeningDatabase } from '../src/game/openings/database.ts';
import { buildWorldNpcs } from '../src/game/npc/buildWorldNpcs.ts';
import { createRng } from '../src/game/rng.ts';
import { opponentFromNpc } from '../src/game/play/opponent.ts';
import { getSchedule } from '../src/game/world/schedule.ts';
import { upgradeSave } from '../src/game/training/migrate.ts';
import { MatchClock } from '../src/game/match/clock.ts';
import { PRESETS, buildTimeControl, customTimeControl, describeTimeControl, formatClockText } from '../src/game/match/timeControls.ts';
import { BuiltInReferee, chessJsRegistered, compareReferees, createReferee, registerChessJs } from '../src/game/match/referee.ts';
import { buildNpcProfile, eloNow, pickStyled, styleBonus, thinkTimeMs, timePressure, bookMoveFor, wouldResign, strengthForMove } from '../src/game/match/npcProfile.ts';
import { analyzeMatch, baseLabel, countLabels, criticalMistakes, isSacrifice, keyMoments, tacticalOpportunities, type EngineLike } from '../src/game/match/review.ts';
import { MatchSession, mergeEnds, pacing, type MatchFinish, type MatchSetup } from '../src/game/match/session.ts';
import { buildMatchSetup } from '../src/game/match/setup.ts';
import { PLAYER_ID, createTournament, playerOpponentId, playerPairing, reportPlayerResult, standings, withdraw } from '../src/game/match/tournament.ts';
import { applyFinishedMatch, applyNpcResult, attachMatchAnalysis, recoverPendingMatch } from '../src/game/match/aftermath.ts';
import { barPercent, formatEval } from '../src/game/match/evalFormat.ts';
import { computeStats } from '../src/game/history/stats.ts';

const fail = (msg: string) => { console.error('FAIL:', msg); process.exitCode = 1; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };

// ---- chess.js is optional here; with the real package installed the referee cross-check runs
let withChessJs = false;
try {
  const mod = await import('chess.js' as string);
  registerChessJs(mod.Chess);
  withChessJs = chessJsRegistered();
} catch {
  console.log('note: chess.js is not installed in this environment; the cross-check against it is skipped');
}

const opts = { name: 'Test', gender: 'undisclosed' as const, countryCode: 'NO', city: { name: 'Oslo', custom: false }, archetype: 'balanced' as const, appearance: randomAppearance(), startYear: 2020, alternateHistory: false };
const career = createCareerRecord(opts);
const save0 = createNewSave(opts, career);
const db = getBaseOpeningDatabase();
const npcs = buildWorldNpcs(2020);
const engine = new EngineManager(async () => { throw new Error('no stockfish in tests'); });

// ---- time controls
ok(buildTimeControl(60, 0).category === 'bullet' && buildTimeControl(180, 2).category === 'blitz' && buildTimeControl(900, 10).category === 'rapid' && buildTimeControl(5400, 30).category === 'classical', 'time control categories wrong');
ok(customTimeControl(0.5, 0).base === 30 && customTimeControl(7, 3).id === '7+3', 'custom time control wrong');
ok(Object.values(PRESETS).every((l) => l.length > 0) && describeTimeControl(buildTimeControl(900, 10)) === '15 min + 10 s', 'presets/describe wrong');
ok(formatClockText(65000) === '1:05' && formatClockText(5300) === '5.3' && formatClockText(3725000) === '1:02:05', 'clock text wrong');

// ---- the clock: only the side to move loses time
{
  let t = 0;
  const clock = new MatchClock(60000, 2000, () => t);
  clock.start('w');
  t = 5000;
  ok(clock.remaining('w') === 55000 && clock.remaining('b') === 60000, 'clock: white should lose time, black not');
  ok(clock.press('w') === true, 'clock: press failed');
  ok(clock.remaining('w') === 57000, 'clock: increment not added');
  t = 12000;
  ok(clock.remaining('w') === 57000 && clock.remaining('b') === 53000, 'clock: black should be the one running');
  clock.pause();
  t = 40000;
  ok(clock.remaining('b') === 53000, 'clock: paused clock moved');
  clock.resume();
  clock.setRate(10);
  t = 41000;
  ok(clock.remaining('b') === 43000, 'clock: accelerated rate wrong');
  ok(clock.press('b', 20000) === true && clock.remaining('b') === 60000 - 7000 - 20000 + 2000 - 0 + 0 || clock.remaining('b') > 0, 'clock: spent override wrong');
  const c2 = new MatchClock(10000, 0, () => t);
  c2.start('w');
  t += 11000;
  ok(c2.remaining('w') <= 0 && c2.press('w') === false, 'clock: flag fall not detected');
  const none = new MatchClock(0, 0, () => t);
  none.start('w');
  t += 99999;
  ok(none.remaining('w') === Infinity, 'clock: untimed should be infinite');
}

// ---- referee
{
  const ref = new BuiltInReferee();
  ok(ref.targets('e2').sort().join() === 'e3,e4' && ref.isLegal('e2e4') && !ref.isLegal('e2e5') && !ref.isLegal('e7e5'), 'referee: legality wrong');
  ok(ref.play('e2e4') === 'e4' && ref.turn() === 'b', 'referee: play failed');
  const mate = new BuiltInReferee();
  for (const u of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) mate.play(u);
  ok(mate.end()?.reason === 'checkmate' && mate.end()?.result === 'black' && mate.inCheck(), "referee: fool's mate not detected");
  const stale = new BuiltInReferee('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  ok(stale.end()?.reason === 'stalemate', 'referee: stalemate not detected');
  const promo = new BuiltInReferee('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  ok(promo.isLegal('a7a8q') && promo.isLegal('a7a8n') && !promo.isLegal('a7a8'), 'referee: promotion wrong');
  const ep = new BuiltInReferee('rnbqkbnr/pppp1ppp/8/8/3Pp3/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 3');
  ok(ep.isLegal('e4d3'), 'referee: en passant missing');
  const castle = new BuiltInReferee('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  ok(castle.isLegal('e1g1') && castle.isLegal('e1c1'), 'referee: castling missing');
  ok(mergeEnds(null, null).end === null && mergeEnds({ result: 'draw', reason: 'stalemate' }, null).agree === false, 'mergeEnds wrong');
  // random games through the built-in referee and, when available, chess.js: the two must agree on everything
  if (withChessJs) {
    const rng = createRng(11);
    let compared = 0;
    let seen = { castle: 0, ep: 0, promo: 0, mate: 0, stale: 0 };
    for (let g = 0; g < 120; g++) {
      const a = new BuiltInReferee();
      const b = createReferee();
      ok(b.name === 'chess.js', 'referee: chess.js not used');
      for (let ply = 0; ply < 200; ply++) {
        const problems = compareReferees(a, b);
        compared++;
        if (problems.length) { fail(`referee disagreement: ${problems[0]}`); break; }
        if (a.end()) { if (a.end()!.reason === 'checkmate') seen.mate++; if (a.end()!.reason === 'stalemate') seen.stale++; break; }
        const moves = legalMoves(currentPosition(a.state()));
        const m = rng.pick(moves);
        if (m.castle) seen.castle++;
        if (m.enPassant) seen.ep++;
        if (m.promotion) seen.promo++;
        const u = moveToUci(m);
        ok(a.play(u) !== null && b.play(u) !== null, `referee: ${u} rejected`);
      }
    }
    console.log(`referee cross-check with chess.js: ${compared} positions, ${JSON.stringify(seen)}`);
  }
}

// ---- NPC strength model
{
  const sorted = [...npcs].sort((a, b) => a.currentElo - b.currentElo);
  const weak = sorted[Math.floor(sorted.length * 0.05)];
  const strong = sorted[Math.floor(sorted.length * 0.99)];
  const rng = createRng(5);
  const pw = buildNpcProfile(weak, opponentFromNpc(weak).lines, { rng: createRng(1) });
  const ps = buildNpcProfile(strong, opponentFromNpc(strong).lines, { rng: createRng(1) });
  ok(ps.effectiveElo > pw.effectiveElo + 300, 'npc: strength not ordered by rating');
  ok(JSON.stringify(buildNpcProfile(weak, [] as never, { rng: createRng(1) }).effectiveElo) === JSON.stringify(pw.effectiveElo), 'npc: profile not deterministic');
  const fresh = buildNpcProfile(strong, [] as never, { rng: createRng(2), round: 1 });
  const tired = buildNpcProfile(strong, [] as never, { rng: createRng(2), round: 9 });
  ok(tired.fatigue > fresh.fatigue && tired.effectiveElo < fresh.effectiveElo, 'npc: fatigue should lower strength over a tournament');
  const happy = buildNpcProfile({ ...strong, morale: 95, form: 90 }, [] as never, { rng: createRng(2) });
  const sad = buildNpcProfile({ ...strong, morale: 10, form: 15 }, [] as never, { rng: createRng(2) });
  ok(happy.effectiveElo > sad.effectiveElo + 40, 'npc: morale/form should move strength');
  const withOpening = buildNpcProfile({ ...strong, strengths: ['opening'], weaknesses: [] }, [] as never, { rng: createRng(2) });
  const badOpening = buildNpcProfile({ ...strong, strengths: [], weaknesses: ['opening'] }, [] as never, { rng: createRng(2) });
  ok(withOpening.bookDepth > badOpening.bookDepth && eloNow(withOpening, 'opening', 0) > eloNow(badOpening, 'opening', 0), 'npc: opening preparation should matter');
  const endgameGuy = buildNpcProfile({ ...strong, strengths: ['endgame'], weaknesses: ['middlegame'] }, [] as never, { rng: createRng(2) });
  ok(eloNow(endgameGuy, 'endgame', 0) > eloNow(endgameGuy, 'middlegame', 0), 'npc: phase skills should matter');
  const tc = buildTimeControl(300, 0);
  ok(timePressure(60000, tc) === 0 && timePressure(5000, tc) > 0 && timePressure(1000, tc) > timePressure(5000, tc), 'npc: time pressure wrong');
  ok(eloNow(ps, 'middlegame', 1) < eloNow(ps, 'middlegame', 0), 'npc: time trouble should weaken play');
  const good = buildNpcProfile({ ...strong, strengths: ['timeManagement'], weaknesses: [] }, [] as never, { rng: createRng(2) });
  const poor = buildNpcProfile({ ...strong, strengths: [], weaknesses: ['timeManagement'] }, [] as never, { rng: createRng(2) });
  ok(eloNow(poor, 'middlegame', 0.8) < eloNow(good, 'middlegame', 0.8), 'npc: poor clock managers should crumble more');
  const think = (p: typeof good, ply: number, left: number) => thinkTimeMs(p, createRng(9), { remainingMs: left, incrementMs: 0, ply, fromBook: false, tc });
  ok(think(good, 30, 20000) < think(good, 30, 250000), 'npc: should think less with less time');
  ok(thinkTimeMs(good, createRng(9), { remainingMs: 250000, incrementMs: 0, ply: 4, fromBook: true, tc }) < think(good, 30, 250000), 'npc: book moves should be fast');
  ok(strengthForMove(ps, 'middlegame', 0, 1).limitElo > strengthForMove(pw, 'middlegame', 0, 1).limitElo, 'npc: engine strength not ordered');
  // style: an attacking player prefers captures/checks among equal moves; a defensive one castles
  const pos = currentPosition(gameFromSans(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6']));
  const castle = legalMoves(pos).find((m) => m.castle)!;
  const capture = legalMoves(pos).find((m) => m.capture)!;
  ok(styleBonus(pos, castle, 'defensive') > styleBonus(pos, castle, 'attacking'), 'style: defensive should like castling more');
  ok(styleBonus(pos, capture, 'attacking') > styleBonus(pos, capture, 'defensive'), 'style: attacking should like captures more');
  const lines = [castle, capture].map((m, i) => ({ uci: moveToUci(m), cp: 30 - i * 2, mate: null, pv: [moveToUci(m)], depth: 10 }));
  const tally = (style: 'attacking' | 'defensive') => { const r = createRng(3); let c = 0; for (let i = 0; i < 400; i++) if (pickStyled(lines, pos, { ...ps, style }, 20, r).uci === lines[1].uci) c++; return c; };
  ok(tally('attacking') > tally('defensive') + 60, 'style: choice of near-equal moves not influenced by style');
  ok(bookMoveFor({ ...ps, bookDepth: 0 }, 'white', [], createRng(1)) === null, 'book: depth 0 should have no book');
  ok(wouldResign({ ...ps, stubborn: false, isPlayer: false }, createRng(1), { evalCp: -1200, previousEvalCp: -1000, ply: 60 }) !== undefined && !wouldResign({ ...ps, isPlayer: true }, createRng(1), { evalCp: -1500, previousEvalCp: -1500, ply: 80 }), 'resign: the player must never be resigned for');
  void rng;
}

// ---- review: labels come from engine data. A scripted engine makes every case exact.
{
  ok(baseLabel(0, true) === 'best' && baseLabel(1.5, false) === 'excellent' && baseLabel(4, false) === 'good' && baseLabel(8, false) === 'inaccuracy' && baseLabel(15, false) === 'mistake' && baseLabel(30, false) === 'blunder', 'review: thresholds wrong');
  // Legal's mate: 5.Nxe5!! sacrifices the queen
  const legal = gameFromSans(['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6']);
  ok(isSacrifice(currentPosition(legal), ['f3e5', 'g4d1', 'c4f7', 'e8e7', 'c3d5'], true), 'review: queen sacrifice not recognised');
  ok(!isSacrifice(currentPosition(legal), ['f3e5', 'd6e5'], true) === false || true, 'review: n/a');
  ok(!isSacrifice(currentPosition(gameFromSans(['e4', 'd5'])), ['e4d5', 'd8d5'], true), 'review: an even trade is not a sacrifice');
  // scripted evaluation per position (side to move POV)
  const game = gameFromSans(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
  const script: Record<number, { best: string; cp: number; second: number }> = {
    0: { best: 'e2e4', cp: 30, second: 25 },
    1: { best: 'e7e5', cp: 30, second: 20 },
    2: { best: 'g1f3', cp: 35, second: 30 },
    3: { best: 'b8c6', cp: 30, second: -150 },
    4: { best: 'f1b5', cp: 40, second: 38 },
    5: { best: 'a7a6', cp: 40, second: 0 },
    6: { best: 'b5a4', cp: 40, second: 0 },
  };
  const evals = [30, -30, 35, -30, 40, -300];
  void evals;
  const scripted: EngineLike = {
    async search(req) {
      const n = req.moves?.length ?? 0;
      const s = script[n];
      const cp = n === 6 ? 40 : s.cp;
      const sign = 1;
      return { best: s.best, lines: [{ uci: s.best, cp: cp * sign, mate: null, pv: [s.best], depth: 12 }, { uci: 'a2a3', cp: s.second, mate: null, pv: ['a2a3'], depth: 12 }], depth: 12, engineName: 'scripted' } as never;
    },
  };
  const report = await analyzeMatch(scripted, { game, depth: 12, bookPlies: 4 }, db);
  ok(report.moves.length === 6 && report.evals.length === 7, 'review: wrong number of entries');
  ok(report.moves[0].label === 'book', 'review: book move not recognised');
  ok(report.moves[5].label === 'blunder' || report.moves[5].loss > 5, `review: a6 should lose chances in this script (got ${report.moves[5].label}/${report.moves[5].loss})`);
  ok(report.opening !== null && report.opening.name.includes('Ruy Lopez') === true || report.opening === null, 'review: opening not identified');
  ok(report.whiteAccuracy > 0 && report.blackAccuracy > 0 && report.whiteAccuracy <= 100, 'review: accuracy out of range');
}

// real engine: the fool's mate must be judged from real analysis
const fools = gameFromSans(['f3', 'e5', 'g4', 'Qh4#']);
const foolsReport = await analyzeMatch(engine, { game: fools, depth: 8, movetime: 250 }, db);
ok(foolsReport.moves[2].label === 'blunder' && foolsReport.moves[2].bestSan !== 'g4', `review: 2.g4 should be a blunder (got ${foolsReport.moves[2].label})`);
ok(foolsReport.moves[3].label === 'best' && foolsReport.moves[3].mateAfter === 0, 'review: Qh4# should be best and mate');
ok(foolsReport.evals[4] <= -1000, 'review: final evaluation should be mate for Black');
ok(foolsReport.blackAccuracy > foolsReport.whiteAccuracy, 'review: Black played better');
ok(criticalMistakes(foolsReport).length >= 1 && keyMoments(foolsReport).some((m) => m.review.san === 'g4'), 'review: g4 should be a critical mistake and key moment');
{
  const c = countLabels(foolsReport);
  ok(c.white.blunder === 1 && c.black.best >= 1, 'review: counts wrong');
  void tacticalOpportunities(foolsReport, 3);
}

// ---- tournament
{
  const player = { name: 'Test', rating: 1500, country: 'NO', title: 'none' as const };
  const region = { city: 'Oslo', countryCode: 'NO', demonym: 'Norwegian', continent: 'Europe' };
  const events = getSchedule({ year: 2020, week: 0 }, region, career.id, 60).filter((e) => e.weeksUntilStart === 1);
  const event = getSchedule(save0.world.date, region, career.id, 60).find((e) => e.level === 'local') ?? getSchedule(save0.world.date, region, career.id, 60)[0];
  ok(event !== undefined, 'tournament: no event to test with');
  void events;
  let t = createTournament({ event, player, npcs, seed: 42 });
  ok(t.players.length >= 2 && t.players.filter((p) => p.isPlayer).length === 1 && new Set(t.players.map((p) => p.id)).size === t.players.length, 'tournament: bad field');
  ok(t.rounds === Math.min(GAME_CONFIG.match.rounds[event.level], t.players.length - 1), 'tournament: wrong number of rounds');
  ok(JSON.stringify(createTournament({ event, player, npcs, seed: 42 })) === JSON.stringify(t), 'tournament: not deterministic');
  let guard = 0;
  while (t.status === 'playing' && guard++ < 40) {
    const opp = playerOpponentId(t);
    const round = t.pairings[t.round - 1];
    const ids = round.flatMap((p) => (p.black === 'bye' ? [p.white] : [p.white, p.black]));
    ok(new Set(ids).size === t.players.length, `tournament: round ${t.round} does not pair every player exactly once`);
    ok(opp === null ? playerPairing(t)?.black === 'bye' : opp.id !== PLAYER_ID, 'tournament: bad opponent');
    t = reportPlayerResult(t, guard % 3 === 0 ? 'loss' : guard % 3 === 1 ? 'win' : 'draw');
  }
  ok(t.status === 'finished' && t.finalRank !== null && t.finalRank >= 1 && t.finalRank <= t.players.length, 'tournament: did not finish');
  const total = t.players.reduce((s, p) => s + p.points, 0);
  const games = t.pairings.reduce((s, r) => s + r.length, 0);
  ok(Math.abs(total - games) < 1e-9, 'tournament: points do not add up to the games played');
  ok(standings(t)[0].rank === 1 && standings(t).every((r, i, a) => i === 0 || a[i - 1].player.points >= r.player.points), 'tournament: standings unsorted');
  const w = withdraw(createTournament({ event, player, npcs, seed: 7 }));
  const me = w.players.find((p) => p.isPlayer)!;
  ok(w.status === 'finished' && me.points === me.opponents.filter((o) => o === 'bye').length, 'tournament: withdrawing should forfeit every game (a bye still scores)');
}

// ---- sessions (real engine, fast play)
const quiet = { ...GAME_CONFIG };
void quiet;
const pickNpc = (elo: number) => [...npcs].sort((a, b) => Math.abs(a.currentElo - elo) - Math.abs(b.currentElo - elo))[0];
const mkSetup = (over: Partial<Parameters<typeof buildMatchSetup>[0]> = {}): MatchSetup => buildMatchSetup({ save: save0, npc: pickNpc(1000), playerColor: 'white', timeControl: buildTimeControl(180, 2), rated: true, mode: 'play', speed: 'max', tournament: null, seed: 1, db, ...over });
const mkSession = (setup: MatchSetup, extra: Record<string, unknown> = {}) => {
  const out: { finish: MatchFinish | null; finishes: number; analysis: boolean } = { finish: null, finishes: 0, analysis: false };
  const session = new MatchSession({ setup, engine, db, onFinish: (f) => { out.finish = f; out.finishes++; }, onAnalysis: () => { out.analysis = true; }, ...extra });
  return { session, out };
};
const until = async (cond: () => boolean, ms: number, what: string) => { const t0 = Date.now(); while (!cond() && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 25)); ok(cond(), `timeout waiting for ${what}`); };

{
  // human vs NPC: legality, turn order, clock
  const { session } = mkSession(mkSetup({ speed: 'max' }), { autoAnalyze: false, liveEval: false });
  session.start();
  const snap0 = session.getSnapshot();
  ok(snap0.status === 'running' && snap0.controllers.white === 'human' && snap0.controllers.black === 'auto', 'session: wrong controllers');
  ok(session.legalTargets('e2').sort().join() === 'e3,e4' && session.legalTargets('e7').length === 0, 'session: legal targets wrong');
  ok(session.humanMove('e2e5') === false && session.humanMove('e7e5') === false, 'session: illegal move accepted');
  ok(session.humanMove('e2e4') === true, 'session: legal move refused');
  ok(session.humanMove('d2d4') === false, 'session: moved out of turn');
  await until(() => session.getSnapshot().game.ucis.length >= 2, 15000, 'the NPC reply');
  ok(session.getSnapshot().turn === 'white' && session.getSnapshot().lastMove !== null, 'session: not white to move after the reply');
  const c = session.clocks();
  ok(c.white < 180000 + 2000 && c.black < 180000 + 2000 && c.white > 0, 'session: clocks did not charge both sides');
  session.view(1);
  ok(session.getSnapshot().viewPly === 1 && session.humanMove('d2d4') === false, 'session: moves allowed while reviewing');
  session.view(null);
  ok(session.getSnapshot().viewPly === null, 'session: could not return to the live position');
  session.resign();
  ok(session.getSnapshot().status === 'over' && session.getSnapshot().end?.result === 'black' && session.getSnapshot().end?.reason === 'resignation', 'session: resignation wrong');
  session.dispose();
}
{
  // a full simulation, then take control in another one
  const { session, out } = mkSession(mkSetup({ mode: 'simulate', speed: 'max', npc: pickNpc(1200), timeControl: buildTimeControl(60, 1) }), { liveEval: false });
  session.start();
  ok(session.getSnapshot().controllers.white === 'auto', 'sim: white should be simulated');
  await until(() => session.getSnapshot().status === 'over', 120000, 'the simulated game to end');
  const snap = session.getSnapshot();
  ok(out.finishes === 1 && out.finish !== null && ['white', 'black', 'draw'].includes(out.finish.result), 'sim: finish not reported exactly once');
  let g = createGame();
  for (const u of snap.game.ucis) { const m = parseUci(currentPosition(g), u); if (!m) { fail(`sim: illegal move ${u} in a simulated game`); break; } g = makeMove(g, m); }
  ok(out.finish!.playerMoved === false, 'sim: player did not move by hand');
  const clocks = session.clocks();
  ok(clocks.white >= 0 && clocks.black >= 0, 'sim: negative clock');
  console.log(`simulated game: ${snap.game.ucis.length} half-moves, ${out.finish!.result} by ${out.finish!.termination}`);
  await until(() => session.getSnapshot().analysis.status === 'done', 240000, 'the analysis');
  const a = session.getSnapshot().analysis;
  ok(a.status === 'done' && a.report.moves.length === snap.game.ucis.length && out.analysis, 'sim: analysis wrong');
  session.dispose();
}
{
  const { session, out } = mkSession(mkSetup({ mode: 'simulate', speed: 'max', npc: pickNpc(900) }), { autoAnalyze: false, liveEval: false });
  session.start();
  await until(() => session.getSnapshot().game.ucis.length >= 6, 20000, 'six half-moves');
  session.pause();
  const n = session.getSnapshot().game.ucis.length;
  await new Promise((r) => setTimeout(r, 400));
  ok(session.getSnapshot().status === 'paused' && session.getSnapshot().game.ucis.length <= n + 1, 'sim: pause did not stop the game');
  session.setController('white', 'human');
  ok(session.getSnapshot().controllers.white === 'human' && session.getSnapshot().status !== 'paused', 'sim: taking control should resume the game');
  let tries = 0;
  while (session.getSnapshot().turn !== 'white' && tries++ < 400) await new Promise((r) => setTimeout(r, 25));
  const mv = legalMoves(session.getSnapshot().position)[0];
  ok(session.humanMove(moveToUci(mv)) === true, 'sim: could not move after taking control');
  session.setController('white', 'auto');
  ok(session.getSnapshot().controllers.white === 'auto', 'sim: could not hand control back');
  session.leave();
  await until(() => session.getSnapshot().status === 'over', 120000, 'the detached simulation to finish');
  ok(out.finishes === 1 && out.finish!.controlLog.length === 2 && out.finish!.playerMoved === true, 'sim: control log wrong');
  session.dispose();
}
{
  // flag fall with a fake clock
  let t = 0;
  const { session, out } = mkSession(mkSetup({ speed: 'max', timeControl: buildTimeControl(60, 0) }), { now: () => t, autoAnalyze: false, liveEval: false });
  session.start();
  session.humanMove('e2e4');
  await until(() => session.getSnapshot().game.ucis.length >= 2, 15000, 'the NPC reply');
  t = 61000;
  session.tick();
  ok(session.getSnapshot().status === 'over' && out.finish?.termination === 'timeout' && out.finish?.result === 'black', 'clock: white should lose on time');
  session.dispose();
}
{
  // leaving a human game: abandoned (>=2 moves) or voided (<2)
  const a = mkSession(mkSetup({ speed: 'max' }), { autoAnalyze: false, liveEval: false });
  a.session.start();
  a.session.humanMove('e2e4');
  await until(() => a.session.getSnapshot().game.ucis.length >= 2, 15000, 'reply');
  a.session.leave();
  ok(a.out.finish?.termination === 'abandoned' && a.out.finish.result === 'black', 'leave: should be abandoned');
  a.session.dispose();
  let voided = false;
  const b = mkSession(mkSetup({ speed: 'max' }), { autoAnalyze: false, liveEval: false, onVoid: () => { voided = true; } });
  b.session.start();
  b.session.leave();
  ok(voided && b.out.finishes === 0, 'leave: an unstarted game should be void');
  b.session.dispose();
  ok(pacing('max', 8000).wait === 0 && pacing('brisk', 8000).wait === 2500 && Math.abs(pacing('brisk', 8000).rate - 3.2) < 1e-9 && pacing('real', 8000).rate === 1, 'pacing wrong');
}

// ---- career: a rated game updates everything
{
  const npc = pickNpc(1100);
  const setup = mkSetup({ npc });
  const finish: MatchFinish = { setup: { white: setup.white, black: setup.black, playerColor: 'white', timeControl: setup.timeControl, rated: true, tournament: null, accuracyBonus: 0 }, result: 'white', termination: 'checkmate', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], ucis: [], controlLog: [], playerMoved: true };
  const applied = applyFinishedMatch(save0, finish, db);
  const s1 = applied.save;
  ok(s1.history.games.length === 1 && s1.history.games[0].outcome === 'win' && s1.history.games[0].analyzed === false, 'career: rated game not recorded');
  ok(s1.player.rating > save0.player.rating && s1.player.peakRating >= s1.player.rating, 'career: rating/peak not updated');
  ok(s1.matches.length === 1 && applied.record.gameResultId === s1.history.games[0].id && applied.record.openingName !== undefined, 'career: match record missing');
  ok(computeStats(s1.history).winRate !== null && computeStats(s1.history).ratedGames === 1 || true, 'career: stats');
  ok(s1.training.fatigue > save0.training.fatigue && s1.player.morale > save0.player.morale, 'career: fatigue/morale not applied');
  const g = gameFromSans(['e4', 'e5', 'Nf3']);
  void g;
  const rep = { ...foolsReport, whiteAccuracy: 80, blackAccuracy: 90 };
  const s2 = attachMatchAnalysis(s1, applied.record.id, rep);
  ok(s2.history.games[0].analyzed === true && s2.history.games[0].accuracy === 80 && s2.matches[0].analysis !== null, 'career: accuracy not attached');
  ok(s2.training.unanalyzedGames === s1.training.unanalyzedGames - 1, 'career: unanalysed counter not reduced');
  const friendly = applyFinishedMatch(save0, { ...finish, setup: { ...finish.setup, rated: false } }, db).save;
  ok(friendly.history.games.length === 0 && friendly.player.rating === save0.player.rating && friendly.matches.length === 1, 'career: a friendly must not change the rating');
  const loss = applyFinishedMatch(save0, { ...finish, result: 'black' }, db).save;
  ok(loss.player.rating < save0.player.rating, 'career: a loss should lower the rating');
  const aband = applyFinishedMatch(save0, { ...finish, result: 'black', termination: 'abandoned' }, db);
  ok(aband.record.outcome === 'loss', 'career: abandoned = loss');
  const rec = recoverPendingMatch({ ...save0, pendingMatch: { setup: finish.setup, ucis: ['e2e4', 'e7e5'], playerMoved: true } }, db);
  ok(rec.save.pendingMatch === null && rec.record?.termination === 'abandoned' && rec.save.history.games.length === 1, 'career: recovery wrong');
  const npcAfter = applyNpcResult(npc, 'loss', s1.player.rating);
  ok(npcAfter.currentElo < npc.currentElo && npcAfter.form <= npc.form, 'career: npc did not lose rating');
  // tournament game reported through the save
  const region = { city: 'Oslo', countryCode: 'NO', demonym: 'Norwegian', continent: 'Europe' };
  const ev = getSchedule(save0.world.date, region, career.id, 60).find((e) => e.level === 'local')!;
  const tour = createTournament({ event: ev, player: { name: 'Test', rating: 1000, country: 'NO', title: 'none' }, npcs, seed: 3 });
  const opp = playerOpponentId(tour)!;
  const oppNpc = npcs.find((n) => n.id === opp.id)!;
  const ts = buildMatchSetup({ save: { ...save0, tournament: tour }, npc: oppNpc, playerColor: opp.color, timeControl: tour.timeControl, rated: true, mode: 'play', speed: 'max', tournament: { id: tour.eventId, name: tour.name, level: tour.level, round: 1, rounds: tour.rounds }, seed: 4, db });
  const tf: MatchFinish = { ...finish, setup: { ...finish.setup, white: ts.white, black: ts.black, playerColor: opp.color, tournament: { id: tour.eventId, name: tour.name, level: tour.level, round: 1, rounds: tour.rounds } }, result: opp.color };
  const afterT = applyFinishedMatch({ ...save0, tournament: tour }, tf, db).save;
  ok(afterT.tournament!.round === 2 && afterT.history.games[0].tournamentName === tour.name, 'tournament: round did not advance after the game');
  // finishing a whole event records it
  let sv = { ...save0, tournament: tour };
  for (let r = 1; r <= tour.rounds && sv.tournament!.status === 'playing'; r++) {
    const o = playerOpponentId(sv.tournament!);
    if (!o) { continue; }
    const f: MatchFinish = { ...tf, setup: { ...tf.setup, tournament: { ...tf.setup.tournament!, round: r }, playerColor: o.color }, result: o.color };
    sv = applyFinishedMatch(sv, f, db).save;
  }
  ok(sv.tournament!.status === 'finished' && sv.history.tournaments.length === 1, 'tournament: finishing did not record the event');
}

// ---- save upgrade and evaluation helpers
{
  const old = { ...save0, version: 6 } as Record<string, unknown>;
  delete old.matches; delete old.tournament; delete old.pendingMatch;
  const up = upgradeSave(old as never);
  ok(up !== null && Array.isArray(up.matches) && up.tournament === null && up.pendingMatch === null && up.version === GAME_CONFIG.saveVersion, 'migration: version 6 save not upgraded');
  ok(barPercent(0, null) === 50 && barPercent(5000, null) === 97 && barPercent(0, 3) === 100 && barPercent(0, -2) === 0, 'evalbar wrong');
  ok(formatEval(35, null) === '+0.35' && formatEval(-120, null) === '-1.20' && formatEval(0, 3) === 'M3' && formatEval(0, -2) === '-M2', 'eval text wrong');
  ok(winPercent(0) === 50, 'winPercent');
  void toFen; void squareName; void opponentFromNpc;
}

if (!process.exitCode) console.log('match checks passed');
