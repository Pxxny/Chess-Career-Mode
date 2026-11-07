// Checks for practice games, the opening database and the repertoire. Run with: npm run test:play
import { randomAppearance } from '../src/data/appearance.ts';
import { FAMILY_META } from '../src/data/chess/eco/meta.ts';
import { GAME_CONFIG } from '../src/data/config.ts';
import { startPosition, playSan } from '../src/game/chess/board.ts';
import { START_FEN, createGame, currentPosition, detectEnd, gameFromSans, insufficientMaterial, makeMove, parseUci, timeoutResult } from '../src/game/chess/rules.ts';
import { createCareerRecord } from '../src/game/career/createCareer.ts';
import { createNewSave } from '../src/game/createNewSave.ts';
import { analyzeGame, combineAccuracy, classifyLoss, moveAccuracy, winPercent } from '../src/game/engine/analysis.ts';
import { BuiltinEngine } from '../src/game/engine/builtin.ts';
import { EngineManager } from '../src/game/engine/manager.ts';
import { chooseEngineMove } from '../src/game/engine/play.ts';
import { pickCandidate, strengthFor } from '../src/game/engine/strength.ts';
import { StockfishBackend, parseInfo, type UciWorker } from '../src/game/engine/stockfish.ts';
import type { EngineBackend, SearchRequest, SearchResult } from '../src/game/engine/types.ts';
import { buildOpeningDatabase, getBaseOpeningDatabase } from '../src/game/openings/database.ts';
import { exportPgn, importGameCollection, importOpeningLines, mergeUsage, parsePgn } from '../src/game/openings/pgn.ts';
import { SITUATIONS, chooseOpening, fitsSituation, type Preferences } from '../src/game/openings/situations.ts';
import { simulateGame } from '../src/game/openings/simulate.ts';
import { buildOpeningPerformance, collectOpeningGames, knowledgeFrom, perfForEntry } from '../src/game/openings/stats.ts';
import { findMatch, buildOnlinePool, opponentFromOnline, currentRating } from '../src/game/play/blitz.ts';
import { ENDINGS, flipFen, isValidSetup, oddsFen, setupFor } from '../src/game/play/objectives.ts';
import { engineOpponent, opponentBookMove, temperamentOf } from '../src/game/play/opponent.ts';
import { attachAnalysis, blitzRatingChange, practiceBlock, recordPracticeGame } from '../src/game/play/practice.ts';
import { findTimeControl, TRAINING_TIME_CONTROLS } from '../src/game/play/timeControls.ts';
import { upgradeSave } from '../src/game/training/migrate.ts';
import { createRng } from '../src/game/rng.ts';
import type { GameSave } from '../src/types/index.ts';

const fail = (msg: string) => { console.error('FAIL:', msg); process.exitCode = 1; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };

const opts = { name: 'Test', gender: 'undisclosed' as const, countryCode: 'NO', city: { name: 'Oslo', custom: false }, archetype: 'balanced' as const, appearance: randomAppearance(), startYear: 2020, alternateHistory: false };
const career = createCareerRecord(opts);
const base = createNewSave(opts, career);
const db = getBaseOpeningDatabase();

// ---- opening database
ok(db.entries.length >= 3000, `database too small: ${db.entries.length}`);
ok(db.ecoCodes === 500, `ECO coverage ${db.ecoCodes}/500`);
let illegal = 0;
for (const e of db.entries) if (gameFromSans(e.moves).sans.length !== e.moves.length) illegal++;
ok(illegal === 0, `${illegal} opening lines contain an illegal move`);
ok(new Set(db.entries.map((e) => e.id)).size === db.entries.length, 'opening ids are not unique');
for (const letter of 'ABCDE') for (let n = 0; n < 100; n++) {
  const code = `${letter}${String(n).padStart(2, '0')}`;
  if (!db.entries.some((e) => e.eco === code)) fail(`ECO code ${code} missing`);
}
ok(db.entries.every((e) => e.popularity >= 1 && e.popularity <= 5 && e.difficulty >= 1 && e.difficulty <= 5 && e.description.length > 20 && e.eras.length === 5), 'opening metadata out of range');
for (const key of Object.keys(FAMILY_META)) ok(db.familyByName.has(key), `family meta "${key}" matches no family`);
for (const f of db.families) {
  const main = db.byId.get(f.mainLineId)!;
  ok(!!main && main.family === f.name && main.isMainLine, `main line of ${f.name}`);
}
ok(db.entries.filter((e) => e.parentId).every((e) => db.byId.get(e.parentId!)!.depth < e.depth), 'parent lines must be shorter');
const najdorf = db.classify('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'.split(' '));
ok(najdorf?.entry.name.startsWith('Sicilian Defense: Najdorf') === true, 'classify Najdorf');
ok(db.classify(['a3', 'a6', 'b3', 'b6', 'Ra2', 'Ra7'])?.bookPlies !== 6, 'classify must stop at the end of the tree');

// ---- PGN
const pgnText = `[Event "Study"]\n[Opening "Sicilian Defense"]\n[Variation "My Najdorf"]\n[Orientation "black"]\n\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. h3 {quiet} e5 (6... g6 7. g4 $1) 7. Nb3 *\n\n[Event "Bad"]\n\n1. e4 e5 2. Ke3 Nc6 *\n\n[Event "G"]\n[Date "1972.07.11"]\n[Result "1-0"]\n\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bg5 e6 1-0\n`;
const parsed = parsePgn(pgnText);
ok(parsed.length === 3 && parsed[0].lines.length === 2, 'PGN games / variations');
const lines = importOpeningLines(db, pgnText, { source: 't', includeVariations: true, maxPlies: 60 });
ok(lines.added.length === 2 && lines.truncated === 1, `PGN import added ${lines.added.length}, truncated ${lines.truncated}`);
const coll = importGameCollection(db, pgnText, 'test');
ok(coll.classified === 3, 'collection classification');
const db2 = buildOpeningDatabase(lines.added, mergeUsage({ test: coll.usage }));
ok(db2.entries.length === db.entries.length + 2 && db2.customCount === 2, 'custom openings join the database');
ok(db2.classify(lines.added[0].moves)?.entry.source === 'custom', 'custom line classified');
ok(parsePgn(exportPgn(lines.added)).length === 2, 'PGN export round trip');
ok(db2.entries.some((e) => e.usage && !e.estimated), 'imported usage replaces estimates');

// ---- rules
const sans = (s: string) => gameFromSans(s.split(' '));
ok(detectEnd(sans('f3 e5 g4 Qh4'))?.reason === 'checkmate', 'fool\'s mate');
ok(detectEnd(sans('e3 a5 Qh5 Ra6 Qxa5 h5 h4 Rah6 Qxc7 f6 Qxd7+ Kf7 Qxb7 Qd3 Qxb8 Qh7 Qxc8 Kg6 Qe6'))?.reason === 'stalemate', 'stalemate');
let rep = createGame();
for (const m of 'Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8'.split(' ')) rep = gameFromSans([...rep.sans, m]);
ok(detectEnd(rep)?.reason === 'repetition', 'threefold repetition');
ok(insufficientMaterial(currentPosition(createGame('8/8/8/4k3/8/8/4K3/6B1 w - - 0 1')).board), 'K+B vs K');
ok(!insufficientMaterial(currentPosition(createGame('8/8/8/4k3/8/8/3PK3/8 w - - 0 1')).board), 'K+P vs K can mate');
ok(timeoutResult(createGame('8/8/8/4k3/8/8/4K3/6B1 w - - 0 1'), 'b').result === 'draw', 'flag fall against lone bishop is a draw');
ok(timeoutResult(createGame(), 'b').result === 'white', 'flag fall');

// ---- objectives
for (const e of ENDINGS) ok(isValidSetup(e.fen) && isValidSetup(flipFen(e.fen)), `ending ${e.id} setup`);
for (const side of ['white', 'black'] as const) for (const o of ['pawn', 'knight', 'rook'] as const) ok(isValidSetup(oddsFen(side, o)), `odds ${side} ${o}`);
ok(setupFor('conversion', 'white', { odds: 'knight' }, createRng(1)).fen!.includes('r1bqkbnr'), 'conversion removes the opponent\'s knight');

// ---- engines: legality, fallback, UCI wrapper
const engine = new EngineManager(async () => { throw new Error('no stockfish in tests'); });
let g = createGame();
const rng = createRng(7);
for (let i = 0; i < 30 && !detectEnd(g); i++) {
  const choice = await chooseEngineMove(engine, g, strengthFor(i % 2 ? 900 : 1800, { thinkMs: 100 }), rng);
  const move = parseUci(currentPosition(g), choice.uci);
  if (!move) { fail(`engine played an illegal move ${choice.uci}`); break; }
  g = makeMove(g, move);
}
ok(g.sans.length >= 20, 'engine game length');
ok(engine.getInfo().status === 'builtin' && !!engine.getInfo().problem, 'fallback engine reported');
// A broken engine that returns an illegal move must never reach the board.
class BrokenEngine implements EngineBackend { name = 'broken'; kind = 'stockfish' as const; async search(_r: SearchRequest): Promise<SearchResult> { return { best: 'e2e5', lines: [{ uci: 'e2e5', cp: 10, mate: null, pv: ['e2e5'], depth: 1 }], depth: 1 }; } stop() {} dispose() {} }
const broken = new EngineManager(async () => new StockfishBackendShim() as never);
class StockfishBackendShim { name = 'broken'; kind = 'stockfish'; async search() { return new BrokenEngine().search({} as never); } stop() {} dispose() {} }
const choice = await chooseEngineMove(broken, createGame(), strengthFor(2000), createRng(3));
ok(!!parseUci(currentPosition(createGame()), choice.uci), 'illegal engine move must be replaced');
// Fake UCI worker speaking the protocol.
class FakeWorker implements UciWorker {
  onmessage: UciWorker['onmessage'] = null; onerror: UciWorker['onerror'] = null; sent: string[] = [];
  postMessage(m: string) {
    this.sent.push(m);
    const say = (t: string) => setTimeout(() => this.onmessage?.({ data: t }), 0);
    if (m === 'uci') say('id name Fake\nuciok');
    else if (m === 'isready') say('readyok');
    else if (m.startsWith('go')) say('info depth 8 multipv 1 score cp 31 pv e2e4 e7e5\ninfo depth 8 multipv 2 score mate -3 pv d2d4\nbestmove e2e4 ponder e7e5');
  }
  terminate() {}
}
const fw = new FakeWorker();
const sf = new StockfishBackend(fw, 'Fake');
await sf.init(1000);
const res = await sf.search({ fen: START_FEN, moves: ['e2e4'], depth: 8, multiPv: 2, limitElo: 1500 });
ok(res.best === 'e2e4' && res.lines.length === 2 && res.lines[1].mate === -3 && res.lines[0].cp === 31, 'UCI parsing');
ok(fw.sent.includes('position startpos moves e2e4') && fw.sent.includes('setoption name UCI_Elo value 1500') && fw.sent.includes('setoption name MultiPV value 2'), 'UCI commands');
ok(parseInfo('info depth 5 score cp -20 nodes 1 pv e7e5')?.line.cp === -20, 'parseInfo');
const weak = strengthFor(800), strong = strengthFor(2600), full = strengthFor(3200, { full: true });
ok(weak.temperature > strong.temperature && weak.limitElo === 1320 && strong.limitElo === 2600 && full.full && !full.limitElo, 'strength mapping');
const cands = [{ uci: 'a', cp: 100, mate: null, pv: [], depth: 1 }, { uci: 'b', cp: -900, mate: null, pv: [], depth: 1 }];
ok(pickCandidate(cands, 100, createRng(1)).uci === 'a', 'candidate loss cap');

// ---- analysis maths and a short analysis
ok(Math.abs(winPercent(0) - 50) < 1e-6 && winPercent(600) > 85, 'win percent');
ok(moveAccuracy(0) > 99 && moveAccuracy(30) < 35 && classifyLoss(25, false) === 'blunder' && classifyLoss(7, false) === 'inaccuracy' && classifyLoss(0, true) === 'best', 'accuracy/labels');
ok(combineAccuracy([100, 100, 10]) < combineAccuracy([70, 70, 70]) + 20, 'combine accuracy');
const short = gameFromSans('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7'.split(' '));
const analysis = await analyzeGame(engine, { game: short, depth: 2, bookPlies: 6 });
ok(analysis.evals.length === short.sans.length + 1 && analysis.labels.length === short.sans.length, 'analysis lengths');
ok(analysis.whiteAccuracy > 0 && analysis.whiteAccuracy <= 100 && analysis.blackAccuracy <= 100, 'analysis accuracy range');
const mateGame = gameFromSans('f3 e5 g4 Qh4'.split(' '));
const mateAnalysis = await analyzeGame(engine, { game: mateGame, depth: 2 });
ok(mateAnalysis.evals[4] <= -1000, 'checkmate evaluates as lost for White');

// ---- opponents, book
const opp = { ...engineOpponent(1500), lines: { white: [['e4', 'e5', 'Nf3', 'Nc6']], black: [['e5', 'Nf3']] } };
ok(opponentBookMove(opp, 'white', [], createRng(1)) === 'e4' && opponentBookMove(opp, 'white', ['e4', 'e5'], createRng(1)) === 'Nf3', 'opponent book');
ok(opponentBookMove(opp, 'white', ['d4'], createRng(1)) === null, 'opponent leaves the book');
ok(temperamentOf('attacking') === 'aggressive' && temperamentOf('solid') === 'defensive' && temperamentOf('universal') === 'neutral', 'temperament');

// ---- situations and preferences
const idOf = (name: string) => db.entries.find((e) => e.name === name)!.id;
const prefs: Preferences = { white: [idOf('Ruy Lopez')], black: [idOf('Caro-Kann Defense')], 'vs-e4': [idOf('French Defense')], 'vs-d4': [idOf("King's Indian Defense")], 'vs-c4': [], 'vs-nf3': [], 'vs-aggressive': [idOf('Scandinavian Defense')], 'vs-defensive': [], critical: [idOf('Sicilian Defense')] };
ok(SITUATIONS.length === 9, 'nine situations');
ok(chooseOpening(db, prefs, { color: 'black', opponent: 'neutral', whiteFirstMove: 'e4' }, createRng(1))?.entry.name === 'French Defense', 'against 1.e4');
ok(chooseOpening(db, prefs, { color: 'black', opponent: 'neutral', whiteFirstMove: 'd4' }, createRng(1))?.entry.name === "King's Indian Defense", 'against 1.d4');
ok(chooseOpening(db, prefs, { color: 'black', opponent: 'neutral', whiteFirstMove: 'c4' }, createRng(1))?.entry.name === 'Caro-Kann Defense' ? false : true, 'Caro-Kann does not answer 1.c4 (first move e4)');
ok(chooseOpening(db, prefs, { color: 'white', opponent: 'neutral' }, createRng(1))?.entry.name === 'Ruy Lopez', 'as White');
ok(chooseOpening(db, prefs, { color: 'black', opponent: 'aggressive', whiteFirstMove: 'e4' }, createRng(1))?.entry.name === 'Scandinavian Defense', 'against aggressive');
ok(chooseOpening(db, prefs, { color: 'black', opponent: 'defensive', whiteFirstMove: 'e4', critical: true }, createRng(1))?.situation === 'critical', 'critical game');
ok(chooseOpening(db, { ...prefs, critical: [] }, { color: 'white', opponent: 'neutral' }, createRng(1))?.situation === 'white', 'falls through to the colour list');
ok(fitsSituation(SITUATIONS[2], db.byId.get(idOf('French Defense'))!) && !fitsSituation(SITUATIONS[3], db.byId.get(idOf('French Defense'))!), 'situation filters');

// ---- simulation: the preference must never change a result
const opponent = { ...engineOpponent(1500), name: 'Sim' };
let differences = 0, preferredWins = 0, otherWins = 0;
const N = 4000;
for (let seed = 1; seed <= N; seed++) {
  const base1 = simulateGame(db, prefs, { seed, playerRating: 1500, playerSkill: 40, color: seed % 2 ? 'white' : 'black', opponent });
  const base2 = simulateGame(db, { ...prefs, white: [], black: [], 'vs-e4': [], 'vs-d4': [], critical: [], 'vs-aggressive': [] }, { seed, playerRating: 1500, playerSkill: 40, color: seed % 2 ? 'white' : 'black', opponent });
  if (base1.outcome !== base2.outcome || base1.accuracy !== base2.accuracy) differences++;
  if (base1.situation) { if (base1.outcome === 'win') preferredWins++; } else if (base1.outcome === 'win') otherWins++;
}
ok(differences === 0, `preferences changed ${differences} simulated results`);
const wins = Array.from({ length: N }, (_, i) => simulateGame(db, prefs, { seed: 100000 + i, playerRating: 1500, playerSkill: 40, color: 'white', opponent }).outcome === 'win').filter(Boolean).length;
ok(Math.abs(wins / N - 0.34) < 0.03, `equal ratings should win about 34% (draws take 32%), got ${(wins / N * 100).toFixed(1)}%`);
void preferredWins; void otherWins;

// ---- practice games recorded in the save
const t0 = createNewSave(opts, career);
ok(!practiceBlock(t0, 'training', findTimeControl('5+3')), 'a fresh player can start a training game');
ok(!!practiceBlock({ ...t0, training: { ...t0.training, fatigue: 95 } }, 'blitz', findTimeControl('3+0')), 'exhausted players cannot play');
ok(!!practiceBlock({ ...t0, training: { ...t0.training, hoursUsedToday: 8 } }, 'training', findTimeControl('5+3')), 'no hours left');
const moves = 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6'.split(' ');
const rec = recordPracticeGame(t0, { mode: 'blitz', opponent: { ...opponent, id: 'ol1', elo: 1500 }, color: 'white', outcome: 'win', termination: 'checkmate', timeControl: findTimeControl('3+2'), startFen: null, moves, objective: null, situation: null, rated: true }, db);
ok(rec.ratingChange !== null && rec.ratingChange > 0 && rec.save.practice.blitzRating === t0.practice.blitzRating + rec.ratingChange, 'blitz rating rises after a win');
ok(rec.save.practice.games[0].openingFamily === 'Sicilian Defense', 'opening classified');
ok(rec.save.training.unanalyzedGames === 1 && rec.save.training.fatigue > 0 && rec.save.training.hoursUsedToday === 0, 'blitz costs fatigue, not hours');
const tg = recordPracticeGame(t0, { mode: 'training', opponent: { ...opponent, id: 'n1' }, color: 'black', outcome: 'loss', termination: 'resignation', timeControl: findTimeControl('5+3'), startFen: null, moves, objective: 'opening', situation: 'vs-e4', rated: false }, db);
ok(tg.save.training.hoursUsedToday === 1 && tg.save.practice.blitzRating === t0.practice.blitzRating && tg.gains.length > 0 && tg.save.history.sessions.length === 1, 'training game costs an hour and gives XP');
ok(tg.gains.some((x) => x.xp > 0), 'training game XP');
const sim = recordPracticeGame(t0, { mode: 'training', opponent, color: 'white', outcome: 'win', termination: 'resignation', timeControl: findTimeControl('none'), startFen: null, moves, objective: null, situation: null, rated: false, simulated: true }, db);
ok(sim.save.training.fatigue > 0 && sim.gains.length > 0 && sim.gains.some((x) => x.xp > 0), 'simulated games earn experience and tire you');
ok(sim.save.training.unanalyzedGames === 0 && sim.save.training.hoursUsedToday === 1, 'simulated game: one hour, nothing to analyse');
// games use action points: 2 for a Training Game / Engine game, 1 per block of 5 Online Blitz games
const apOf = (g: typeof t0) => g.player.ap.current;
ok(apOf(tg.save) === apOf(t0) - 2 && apOf(sim.save) === apOf(t0) - 2, 'training game should cost 2 AP (played or simulated)');
const eg = recordPracticeGame(t0, { mode: 'engine', opponent: { ...opponent, id: 'sf', elo: 1500 }, color: 'white', outcome: 'draw', termination: 'agreement' as never, timeControl: findTimeControl('none'), startFen: null, moves, objective: null, situation: null, rated: false }, db);
ok(apOf(eg.save) === apOf(t0) - 2 && eg.gains.some((x) => x.xp > 0), 'engine game should cost 2 AP and give XP');
let bl = t0;
const blitzApSpent: number[] = [];
for (let i = 0; i < 11; i++) {
  const before = apOf(bl);
  const r = recordPracticeGame(bl, { mode: 'blitz', opponent: { ...opponent, id: 'ol1', elo: 1500 }, color: 'white', outcome: 'win', termination: 'checkmate', timeControl: findTimeControl('3+2'), startFen: null, moves, objective: null, situation: null, rated: true }, db);
  blitzApSpent.push(before - apOf(r.save));
  ok(r.gains.some((x) => x.xp > 0), `blitz game ${i + 1} earned no experience`);
  bl = { ...r.save, training: { ...r.save.training, fatigue: 0 } };
}
ok(blitzApSpent.join() === '1,0,0,0,0,1,0,0,0,0,1', `blitz AP per game wrong: ${blitzApSpent.join()}`);
ok(!!practiceBlock({ ...t0, player: { ...t0.player, ap: { ...t0.player.ap, current: 1 } } }, 'training', findTimeControl('5+3')), 'training game must be blocked without 2 AP');
ok(!practiceBlock({ ...t0, player: { ...t0.player, ap: { ...t0.player.ap, current: 1 } } }, 'blitz', findTimeControl('3+0')), 'blitz needs only 1 AP');
ok(blitzRatingChange(1500, 1500, 'win', 0) === 20 && blitzRatingChange(1500, 1500, 'loss', 100) < 0, 'blitz K factor');
const withAnalysis = attachAnalysis(rec.save, rec.game.id, { engine: 'x', depth: 2, evals: [], labels: '', whiteAccuracy: 88, blackAccuracy: 70 });
ok(withAnalysis.practice.games[0].accuracy === 88, 'accuracy attached for White');
// Record many games to test the cap and stats.
let busy: GameSave = t0;
for (let i = 0; i < 40; i++) {
  const r = recordPracticeGame({ ...busy, training: { ...busy.training, fatigue: 0 } }, { mode: i % 2 ? 'engine' : 'blitz', opponent: { ...opponent, id: 'ol' + (i % 3) }, color: i % 3 === 0 ? 'black' : 'white', outcome: i % 5 === 0 ? 'loss' : i % 7 === 0 ? 'draw' : 'win', termination: 'checkmate', timeControl: findTimeControl('none'), startFen: null, moves: i % 4 ? moves : 'd4 d5 c4 e6 Nc3 Nf6'.split(' '), objective: null, situation: null, rated: i % 2 === 0 }, db);
  busy = attachAnalysis(r.save, r.game.id, { engine: 'x', depth: 2, evals: [], labels: '', whiteAccuracy: 80, blackAccuracy: 70 });
}
const perf = buildOpeningPerformance(busy, db);
const sic = perf.find((p) => p.family === 'Sicilian Defense')!;
ok(!!sic && sic.games === sic.wins + sic.draws + sic.losses && sic.games > 20, 'opening performance totals');
ok(sic.mostCommonVariation?.name.includes('Najdorf') === true, `most common variation, got ${sic.mostCommonVariation?.name}`);
ok(sic.avgAccuracy !== null && sic.avgOpponentElo === 1500 && sic.knowledge.level >= 3, 'accuracy, opponent elo, knowledge');
const refs = collectOpeningGames(busy, db);
ok(perfForEntry(db, refs, db.entries.find((e) => e.name === 'Sicilian Defense')!).games === sic.games, 'family roll-up counts variations');
ok(knowledgeFrom(0).label === 'Unfamiliar' && knowledgeFrom(100).label === 'Master' && knowledgeFrom(100).next === null, 'knowledge levels');

// ---- blitz pool and matchmaking
const pool = buildOnlinePool(123, db, 2020, GAME_CONFIG.practice.onlinePoolSize);
ok(pool.length === GAME_CONFIG.practice.onlinePoolSize && new Set(pool.map((p) => p.username)).size === pool.length, 'unique usernames');
ok(JSON.stringify(buildOnlinePool(123, db, 2020, 50)) === JSON.stringify(pool.slice(0, 50)), 'pool is deterministic');
let found = 0;
for (let s = 0; s < 50; s++) {
  const m = findMatch(pool, {}, { rating: 1500, timeControl: '5+0', maxRange: 300 }, s);
  if (m) { found++; ok(Math.abs(currentRating(m.player, {}) - 1500) <= m.range, 'match inside the rating window'); }
}
ok(found >= 48, `matchmaking found ${found}/50`);
ok(findMatch(pool, {}, { rating: 3500, timeControl: '5+0', maxRange: 100 }, 1) === null, 'no match when nobody is near');
const online = opponentFromOnline(pool[0], {}, db);
ok(online.lines.white.length > 0 || online.lines.black.length > 0, 'online players have repertoires');

// ---- migration
const old = { ...base } as Partial<GameSave>; delete old.practice; delete old.repertoire; (old as { version: number }).version = 5;
const migrated = upgradeSave(old as GameSave);
ok(!!migrated && migrated.practice.games.length === 0 && Object.keys(migrated.repertoire.preferences).length === 9 , 'save v5 migrates to v6');
void startPosition; void playSan; void TRAINING_TIME_CONTROLS; void BuiltinEngine;

console.log(process.exitCode ? '\nPLAY VERIFICATION FAILED' : `\nplay verification passed: ${db.entries.length} openings, ${db.families.length} families, ${db.ecoCodes} ECO codes`);
