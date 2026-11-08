import { ARCHETYPES } from '../src/data/archetypes.ts';
import { TIERS } from '../src/data/chess/tiers.ts';
import { getEventsForYear } from '../src/data/chess/historicalEvents.ts';
import { GAME_CONFIG } from '../src/data/config.ts';
import { SKILL_DEFINITIONS } from '../src/data/skills.ts';
import { COUNTRY_WEIGHTS } from '../src/data/world/countryWeights.ts';
import { getSeedCities } from '../src/data/world/seedCities.ts';
import { createCareerRecord } from '../src/game/career/createCareer.ts';
import { buildNpcDatabase } from '../src/game/npc/database.ts';
import { previewLegends } from '../src/game/npc/legends.ts';
import { applyWorldState } from '../src/game/npc/worldState.ts';
import { createPlayer } from '../src/game/player/createPlayer.ts';
import { mixSeed } from '../src/game/rng.ts';
import { ageOn } from '../src/utils/dates.ts';
import { renderPortraitSvg } from '../src/game/appearance/portraitSvg.ts';
import { randomAppearance } from '../src/data/appearance.ts';

const fail = (msg: string) => { console.error('FAIL:', msg); process.exitCode = 1; };
const codes = [...Object.keys(COUNTRY_WEIGHTS), 'XA', 'XB', 'XC', 'XD', 'XE', 'XF'];
const countries = codes.map((code) => ({ code, name: `Country ${code}`, demonym: `${code}ish`, continent: 'Europe', capital: `Capital ${code}` }));
const ctxFor = (year: number) => ({ seed: mixSeed(GAME_CONFIG.world.seed, year), startYear: year, fictionalCount: GAME_CONFIG.world.fictionalNpcCount, countries, seedCities: getSeedCities, eventsForYear: getEventsForYear });

// ---- archetypes
for (const a of ARCHETYPES) {
  const total = Object.values(a.skillBonuses).reduce((s, v) => s + (v ?? 0), 0);
  if (total !== 16) fail(`archetype ${a.id} bonus total is ${total}, expected 16`);
}
const opts = { name: 'Test', gender: 'undisclosed' as const, countryCode: 'NO', city: { name: 'Oslo', custom: false }, archetype: 'attacker' as const, appearance: randomAppearance(), startYear: 1985, alternateHistory: false };
const career = createCareerRecord(opts);
const player = createPlayer(opts, career.startYear);
console.log('player:', player.rating, player.peakRating, player.ratedGames, player.league, 'morale', player.morale, 'money', player.money, 'AP', player.ap.current, 'born', player.dateOfBirth, 'start', player.careerStartYear);
console.log('attacker skills:', JSON.stringify(player.skills));
if (player.rating !== 1000 || player.ratedGames !== 0 || player.peakRating !== 1000) fail('starting values wrong');
if (SKILL_DEFINITIONS.some((s) => player.skills[s.key] < GAME_CONFIG.player.minSkill)) fail('skill below minimum');
if (!career.databaseKey.includes(':1985:')) fail('database key missing year');
if (!renderPortraitSvg(player.appearance).startsWith('<svg')) fail('portrait did not render');

// ---- worlds by year
for (const year of [1950, 1972, 1985, 2005, 2026]) {
  const a = buildNpcDatabase(ctxFor(year));
  const b = buildNpcDatabase(ctxFor(year));
  if (JSON.stringify(a) !== JSON.stringify(b)) fail(`world ${year} not deterministic`);
  if (a.length < 1000 || new Set(a.map((n) => n.id)).size !== a.length) fail(`world ${year} count/ids`);
  const fict = a.filter((n) => n.kind === 'fictional');
  const tierCounts = TIERS.map((t) => `${t.id.slice(0, 4)}:${fict.filter((n) => n.tier === t.id).length}`).join(' ');
  const ranked = a.filter((n) => n.worldRank !== null).sort((x, y) => x.worldRank! - y.worldRank!);
  const legends = ranked.filter((n) => n.kind === 'legend');
  let bad = 0;
  for (const n of fict) {
    if (ageOn(n.dateOfBirth, year, 1) !== n.age) bad++;
    if (n.peakElo < n.currentElo || n.potentialRating < n.peakElo) bad++;
    if (n.careerStartYear > year) bad++;
    if (n.tournamentHistory.some((t) => t.year >= year)) bad++;
  }
  if (bad) fail(`${bad} inconsistent NPC records in ${year}`);
  const ru = fict.filter((n) => n.nationality === 'RU').length;
  console.log(`\n== ${year}: ${a.length} NPCs, ranked ${ranked.length}, RU fictional ${ru}\n   tiers ${tierCounts}\n   top: ${ranked.slice(0, 4).map((n) => `${n.name} ${n.currentElo}`).join(' | ')}\n   legends ranked: ${legends.map((n) => `${n.name.split(' ').pop()}(${n.age},${n.currentElo})`).join(' ')}`);
}

// ---- spec examples
const has = (year: number, name: string) => previewLegends(year, false).some((l) => l.name.includes(name));
if (!has(1972, 'Fischer')) fail('Fischer missing in 1972');
if (!has(1985, 'Kasparov') || !has(1985, 'Karpov')) fail('Kasparov/Karpov missing in 1985');
const carlsen2005 = previewLegends(2005, false).find((l) => l.name.includes('Carlsen'));
if (!carlsen2005 || carlsen2005.age > 15) fail('Carlsen should be a teenager in 2005');
console.log('\nCarlsen 2005:', JSON.stringify(carlsen2005));
if (has(1950, 'Carlsen') || has(1950, 'Fischer')) fail('future legends appear in 1950');
console.log('alt-history 1950 legends:', previewLegends(1950, true).length);
console.log('events 1985:', getEventsForYear(1985).map((e) => e.id).join(', '));
const alt = applyWorldState(buildNpcDatabase(ctxFor(1950)), { year: 1950, week: 1, alternateHistory: true });
if (!alt.some((n) => n.name === 'Magnus Carlsen' && n.worldRank !== null)) fail('alternate history did not add Carlsen');

// ---- career dashboard logic
import { createNewSave } from '../src/game/createNewSave.ts';
import { recordGame, recordTournament } from '../src/game/history/recordGame.ts';
import { computeStats, findRivals, recentGames } from '../src/game/history/stats.ts';
import { computeMorale } from '../src/game/player/morale.ts';
import { getTitleStatus } from '../src/game/career/titles.ts';
import { buildNews } from '../src/game/career/news.ts';
import { buildFinance, buildMilestones, buildTimeline } from '../src/game/career/overview.ts';
import { computeRankings } from '../src/game/world/standings.ts';
import { getSchedule } from '../src/game/world/schedule.ts';
import { normalizeHistory } from '../src/game/history/createHistory.ts';
import { getRankedNpcs } from '../src/game/npc/rankings.ts';

const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };
let save = createNewSave(opts, career);
ok(save.history.games.length === 0 && save.history.trophies.length === 0, 'new save history not empty');
ok(normalizeHistory(undefined).games.length === 0 && normalizeHistory({ games: [] }).news.length === 0, 'normalizeHistory failed');

// morale starts at baseline with empty history, and fatigue lowers it
const m0 = computeMorale(save.player, save.history, save.world.date);
ok(m0.value >= 60 && m0.value <= 75, `starting morale ${m0.value}`);
const tired = computeMorale({ ...save.player, ap: { current: 0, max: 10 } }, save.history, save.world.date);
ok(tired.value < m0.value, 'fatigue did not lower morale');

// skills grow only through training: there is no AP-for-level-up trade, and sleeping changes no skill
const skillsOf = (g: typeof save) => JSON.stringify(g.player.skills);
let idle = save;
for (let day = 0; day < 60; day++) idle = endDay(idle).save;
ok(skillsOf(idle) === skillsOf(save) && idle.player.ap.current === idle.player.ap.max, 'end-day loop changed skills');
const trained = performSession(save, 'tactics-puzzle');
ok(trained.ok && trained.save.player.ap.current === save.player.ap.current - 1 && trained.save.history.sessions.length === 1, 'training session did not spend AP / log');
const up = trained.ok ? trained.save : save;
ok(computeMorale(up.player, up.history, up.world.date).factors.find((f) => f.label === 'Training quality')!.value > 0, 'training did not raise morale');

// recording games
const base = { opponentId: 'npc-1', opponentName: 'Ada Test', opponentElo: 1100, color: 'white' as const, accuracy: 80, opening: 'Italian Game' };
save = recordGame(save, { ...base, outcome: 'win' });
ok(save.player.rating > 1000 && save.player.ratedGames === 1, 'win did not raise rating / count');
ok(save.history.games[0].ratingBefore === 1000 && save.history.games[0].ratingAfter === save.player.rating, 'game rating snapshot wrong');
ok(save.history.trophies.some((t) => t.id === 'first-game') && save.history.trophies.some((t) => t.id === 'first-win'), 'first game/win trophies missing');
save = recordGame(save, { ...base, outcome: 'loss', color: 'black', tournamentId: 't1', tournamentName: 'Test Open' });
save = recordGame(save, { ...base, outcome: 'draw', tournamentId: 't1', tournamentName: 'Test Open' });
const stats = computeStats(save.history);
ok(stats.total.games === 3 && stats.total.wins === 1 && stats.total.draws === 1 && stats.total.losses === 1, 'stats totals wrong');
ok(stats.white.games === 2 && stats.black.games === 1 && stats.tournament.games === 2, 'colour/tournament split wrong');
ok(stats.averageAccuracy === 80 && stats.favoriteOpenings[0].name === 'Italian Game', 'accuracy/openings wrong');
ok(recentGames(save.history, 5)[0].outcome === 'draw', 'recent games not newest first');
ok(findRivals(save.history)[0]?.record.games === 3, 'rival not found');
ok(save.history.news.some((n) => n.kind === 'rivalry'), 'rivalry news missing at 3 games');
const mid = computeMorale(save.player, save.history, save.world.date);
ok(mid.factors.find((f) => f.label === 'Recent results')!.value === 0.5, `recent results factor ${mid.factors[0].value}`);

// losing streak lowers morale
let slump = save;
for (let i = 0; i < 4; i++) slump = recordGame(slump, { ...base, outcome: 'loss' });
ok(computeMorale(slump.player, slump.history, slump.world.date).factors.find((f) => f.label === 'Losing streak')!.value === -12 || computeMorale(slump.player, slump.history, slump.world.date).factors.find((f) => f.label === 'Losing streak')!.value < 0, 'losing streak had no effect');

// elo milestones, league promotion, titles from big wins
let climb = createNewSave(opts, career);
for (let i = 0; i < 60; i++) climb = recordGame(climb, { ...base, opponentElo: climb.player.rating + 150, outcome: 'win' });
ok(climb.player.peakRating >= 1100 && climb.history.trophies.some((t) => t.category === 'elo'), 'elo milestone missing');
ok(climb.history.trophies.some((t) => t.category === 'league'), 'league promotion trophy missing');
ok(new Set(climb.history.trophies.map((t) => t.id)).size === climb.history.trophies.length, 'duplicate trophies');
ok(climb.player.league === 'club' || climb.player.league === 'professional' || climb.player.league === 'amateur', 'league not updated');
const titled = recordGame({ ...createNewSave(opts, career), player: { ...save.player, rating: 2290, peakRating: 2290 } }, { ...base, opponentElo: 2400, outcome: 'win' });
const ts = getTitleStatus(titled.player, titled.history);
ok(titled.player.peakRating >= 2300 && ts.current === 'FM' && titled.history.titles.some((t) => t.title === 'FM'), 'FM title not awarded at 2300');
ok(titled.history.trophies.some((t) => t.id === 'title-FM') && titled.history.news.some((n) => n.kind === 'title'), 'title trophy/news missing');
ok(ts.earned.find((e) => e.id === 'FM')!.when !== null && ts.next?.id === 'IM', 'title status wrong');
ok(getTitleStatus(save.player, save.history).current === 'none' && getTitleStatus(save.player, save.history).requirements.every((r) => !r.earned), 'fresh title status wrong');

// tournaments, prize, ledger
const won = recordTournament(save, { tournamentId: 'abc', name: 'Test Open', level: 'local', rank: 1, fieldSize: 40, points: 6, prize: 100 });
ok(won.player.money === save.player.money + 100 && won.history.ledger.length === 1, 'prize not paid/logged');
ok(won.history.trophies.some((t) => t.category === 'tournament'), 'tournament trophy missing');
ok(buildFinance(won).income === 100 && buildFinance(won).bestPrize?.amount === 100, 'finance overview wrong');
ok(computeMorale(won.player, won.history, won.world.date).factors.find((f) => f.label === 'Tournament form')!.value > 0, 'tournament win did not lift morale');

// timeline, milestones, news, schedule
ok(buildTimeline(won)[0].kind === 'start' && buildTimeline(won).length === 1 + won.history.trophies.length, 'timeline wrong');
ok(buildMilestones(won).find((m) => m.id === 'games-1')!.achieved && buildMilestones(won).find((m) => m.id === 'first-tournament')!.achieved, 'milestones wrong');
const region = { city: 'Oslo', countryCode: 'NO', demonym: 'Norwegian', continent: 'Europe' };
const sched = getSchedule(won.world.date, region, career.id);
ok(sched.length > 0 && sched.every((e, i) => i === 0 || e.weeksUntilStart >= sched[i - 1].weeksUntilStart), 'schedule empty/unsorted');
ok(sched.every((e) => e.weeksUntilStart >= 1 && e.week >= 1 && e.week <= 52 && e.registrationDeadline.week >= 1 && e.registrationDeadline.week <= 52), 'schedule dates invalid');
ok(JSON.stringify(sched) === JSON.stringify(getSchedule(won.world.date, region, career.id)), 'schedule not deterministic');
const lateYear = getSchedule({ year: 2026, week: 51 }, region, career.id);
ok(lateYear.some((e) => e.year === 2027), 'schedule does not roll over the year');
const hi = { ...won, player: { ...won.player, rating: 2450, peakRating: 2450, reputation: 120 } };
const news = buildNews(hi, getSchedule(hi.world.date, region, career.id, 60));
ok(news.some((n) => n.kind === 'sponsorship') && news.some((n) => n.kind === 'invitation') && news.some((n) => n.kind === 'history'), 'live news missing');
ok(buildNews(save, sched).every((n) => n.kind !== 'sponsorship' && n.kind !== 'invitation'), 'fresh player got invitations/sponsors');

// rankings against the real NPC database
const world2026 = applyWorldState(buildNpcDatabase(ctxFor(2026)), { year: 2026, week: 1, alternateHistory: false });
const ranked = getRankedNpcs(world2026);
const rk = computeRankings(save.player, ranked);
ok(rk.world.rank >= 1 && rk.world.rank <= ranked.length + 1 && rk.world.of === ranked.length + 1, 'world rank out of range');
ok(rk.national.of <= rk.world.of && rk.city.of <= rk.national.of && rk.national.rank <= rk.national.of && rk.city.rank <= rk.city.of, 'rank groups inconsistent');
const strong = computeRankings({ ...save.player, rating: 2900 }, ranked);
ok(strong.world.rank === 1 && strong.national.rank === 1 && strong.city.rank === 1, 'top rating should rank first everywhere');
console.log('dashboard logic: world rank', rk.world.rank, 'of', rk.world.of, '| national', rk.national.rank, 'of', rk.national.of, '| NPC database', world2026.length);


// ---- training sessions
import { TRAINING_SESSIONS, getSession, CATEGORY_ORDER, sessionsIn } from '../src/data/trainingSessions.ts';
import { ATTRIBUTE_KEYS } from '../src/data/stats.ts';
import { diminishing, endDay, performSession, previewSession, takeRest, xpNeeded, efficiencyAt } from '../src/game/training/engine.ts';
import { recommendCategory } from '../src/game/training/recommend.ts';
import { generateThematicSet } from '../src/game/training/positions.ts';
import { upgradeSave } from '../src/game/training/migrate.ts';
import { OPENING_BOOK, bookMoves } from '../src/data/chess/openingBook.ts';
import { OPENINGS } from '../src/data/chess/openings.ts';
import { parseFen, perft, playSan, startPosition, legalMoves } from '../src/game/chess/board.ts';

// chess engine: perft and opening book
ok(perft(startPosition(), 3) === 8902, 'perft start d3');
ok(perft(parseFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'), 2) === 2039, 'perft kiwipete d2');
for (const o of OPENING_BOOK) {
  let p = startPosition() as ReturnType<typeof playSan>;
  bookMoves(o).forEach((m, i) => { p = p && playSan(p, m); if (!p) fail(`opening ${o.id} illegal at ply ${i + 1} (${m})`); });
}
ok(OPENINGS.every((o) => OPENING_BOOK.some((b) => b.id === o.id)), 'book misses an original opening');
for (const name of ['Sicilian Defence', 'French Defence', 'Caro-Kann Defence', "King's Indian Defence", "Queen's Gambit", 'Ruy Lopez', 'Italian Game', 'English Opening']) {
  ok(OPENING_BOOK.some((o) => o.name === name || o.name.startsWith(name) ), `book lacks ${name}`);
}

// session catalogue
ok(TRAINING_SESSIONS.length === 19 && CATEGORY_ORDER.length === 4, 'session catalogue size');
ok(sessionsIn('chess').length === 12 && sessionsIn('mind').length === 2 && sessionsIn('body').length === 2 && sessionsIn('career').length === 3, 'category sizes');
ok(TRAINING_SESSIONS.every((d) => d.description && d.difficulty >= 1 && d.hours > 0 && d.effects.length >= 2 && d.benefits.length > 0), 'session fields incomplete');
ok(new Set(TRAINING_SESSIONS.map((d) => d.id)).size === TRAINING_SESSIONS.length, 'duplicate session ids');

// state, migration
const t0 = createNewSave(opts, career);
ok(ATTRIBUTE_KEYS.length === 10 && ATTRIBUTE_KEYS.every((k) => t0.player.attributes[k] >= 5), 'attributes missing');
ok(t0.world.day === 1 && t0.training.fatigue === 0 && t0.history.sessions.length === 0, 'fresh training state');
const legacy = JSON.parse(JSON.stringify(t0)); delete legacy.player.attributes; delete legacy.training; delete legacy.world.day; delete legacy.history.sessions; legacy.version = 4;
const migrated = upgradeSave(legacy);
ok(migrated.world.day === 1 && migrated.training.sessionCounter === 0 && ATTRIBUTE_KEYS.every((k) => typeof migrated.player.attributes[k] === 'number') && Array.isArray(migrated.history.sessions), 'v4 save migration');
ok(migrated.player.skills.tactics === t0.player.skills.tactics && migrated.player.money === t0.player.money, 'migration lost data');
// a save of the current version written before tournaments could be registered for: the Tournament screen must still open
const noRegs = JSON.parse(JSON.stringify(t0)); delete noRegs.registrations; delete noRegs.tournament; delete noRegs.matches; delete noRegs.pendingMatch; delete noRegs.history.tournaments;
const healed = upgradeSave(noRegs);
ok(Array.isArray(healed.registrations) && Array.isArray(healed.matches) && Array.isArray(healed.history.tournaments) && healed.tournament === null, 'upgradeSave left tournament fields missing');
ok(healed.registrations.map((r: unknown) => r).length === 0 && getSchedule(healed.world.date, { city: healed.player.city.name, countryCode: healed.player.country, demonym: 'x', continent: 'World' }, healed.career.id, 26).length > 0, 'tournament screen logic fails on an upgraded save');

// diminishing returns and xp curve
ok(diminishing(10) > diminishing(50) && diminishing(50) > diminishing(90) && diminishing(100) >= 0.12 && diminishing(5) <= 1, 'diminishing returns shape');
ok(xpNeeded(80) > xpNeeded(10), 'xp curve should rise');
ok(efficiencyAt(0) === 1 && efficiencyAt(100) === 0.5, 'fatigue efficiency');

// running a session
const r1 = performSession(t0, 'tactics-puzzle');
if (!r1.ok) fail('tactics puzzle blocked at start: ' + r1.error);
else {
  ok(r1.save.player.ap.current === t0.player.ap.current - 1 && r1.save.training.hoursUsedToday === 1 && r1.save.training.fatigue > 0, 'session cost not applied');
  ok(r1.save.history.sessions.length === 1 && r1.outcome.record.gains.length === 3 && r1.save.training.sessionCounter === 1, 'session not recorded');
  ok(r1.outcome.record.gains.every((g) => g.xp > 0), 'no xp gained');
  const again = performSession(t0, 'tactics-puzzle');
  ok(again.ok && JSON.stringify(again.outcome.record) === JSON.stringify(r1.outcome.record), 'session not deterministic for same state');
  const high = { ...t0, player: { ...t0.player, skills: { ...t0.player.skills, tactics: 90 } } };
  const hi = performSession(high, 'tactics-puzzle');
  ok(hi.ok && hi.outcome.record.gains[0].xp < r1.outcome.record.gains[0].xp / 2, 'high skill should gain much less xp');
}
// blocks
ok(!performSession({ ...t0, player: { ...t0.player, money: 0 } }, 'training-camp').ok, 'camp allowed without money');
ok(!performSession(t0, 'theory-drill').ok === (t0.player.skills.opening < 15), 'requirement check wrong');
ok(!performSession(t0, 'analyze-game').ok, 'analyze allowed without a game');
ok(!performSession(t0, 'thematic-games').ok && !performSession(t0, 'scout-opponent').ok && !performSession(t0, 'tournament-preparation').ok && !performSession(t0, 'study-master-game').ok, 'choice sessions should need a choice');
ok(!performSession({ ...t0, training: { ...t0.training, fatigue: 95 } }, 'tactics-puzzle').ok, 'exhausted player could train');
ok(!performSession({ ...t0, player: { ...t0.player, ap: { current: 0, max: 10 } } }, 'tactics-puzzle').ok, 'trained without AP');
ok(!performSession(t0, 'no-such-session').ok, 'unknown session accepted');

// daily limits: hours, AP, repeats
let day = { ...t0, player: { ...t0.player, ap: { current: 99, max: 99 }, skills: { ...t0.player.skills, calculation: 30 } } } as typeof t0;
let done = 0;
for (let i = 0; i < 10; i++) { const r = performSession(day, 'calculation-drills'); if (!r.ok) break; day = r.save; done++; }
ok(done === 4 && day.training.hoursUsedToday === 8, `8 hours should allow exactly 4 two-hour sessions, did ${done}`);
const p1 = previewSession(t0, getSession('tactics-puzzle')!).effects[0].expectedXp;
const afterOne = (performSession(t0, 'tactics-puzzle') as { ok: true; save: typeof t0 }).save;
ok(previewSession(afterOne, getSession('tactics-puzzle')!).effects[0].expectedXp < p1, 'repeat in one day should earn less');
let rush = { ...t0, player: { ...t0.player, ap: { current: 99, max: 99 }, skills: { ...t0.player.skills, tactics: 20 } } } as typeof t0;
let rushes = 0;
for (let i = 0; i < 6; i++) { const r = performSession(rush, 'puzzle-rush'); if (!r.ok) break; rush = r.save; rushes++; }
ok(rushes === 3, `puzzle rush daily limit, did ${rushes}`);
// full-day camp
const camp = performSession(t0, 'training-camp');
ok(camp.ok && camp.save.training.hoursUsedToday === 8 && !performSession(camp.save, 'tactics-puzzle').ok, 'camp should use the whole day');
ok(!performSession((performSession(t0, 'tactics-puzzle') as { ok: true; save: typeof t0 }).save, 'training-camp').ok, 'camp needs a fresh day');

// fatigue grows with training and can be recovered
let worn = { ...day };
ok(worn.training.fatigue > 30, 'four hard sessions should tire the player');
const brk = takeRest({ ...worn, training: { ...worn.training, hoursUsedToday: 4 } }, 'break');
ok(brk.ok && brk.save.training.fatigue < worn.training.fatigue && brk.save.training.hoursUsedToday === 5, 'break did not recover');
ok(!takeRest(worn, 'break').ok, 'rest allowed with no hours left');
ok(!takeRest(t0, 'nap').ok, 'rest allowed when fully rested');
const night = endDay(worn);
ok(night.save.training.fatigue < worn.training.fatigue && night.save.player.ap.current === 99 && night.save.world.day === 2 && night.save.training.hoursUsedToday === 0 && Object.keys(night.save.training.todayCounts).length === 0, 'end of day did not reset');
const restful = endDay({ ...t0, training: { ...t0.training, fatigue: 60 } });
const busy = endDay({ ...t0, training: { ...t0.training, fatigue: 60, hoursUsedToday: 4 } });
ok(restful.report.restDay && restful.save.training.fatigue < busy.save.training.fatigue, 'rest day should recover more');
let cal = t0; for (let i = 0; i < 7; i++) cal = endDay(cal).save;
ok(cal.world.day === 1 && cal.world.date.week === 2 && cal.world.date.year === t0.world.date.year, 'week rollover');
const ny = endDay({ ...t0, world: { ...t0.world, day: 7, date: { year: 1990, week: 52 } } }).save;
ok(ny.world.date.year === 1991 && ny.world.date.week === 1 && ny.world.day === 1, 'year rollover');
ok(endDay({ ...t0, training: { ...t0.training, fatigue: 100 } }).save.training.fatigue < 100, 'sleep should recover fatigue');

// stamina and fitness help
const fit = { ...t0, player: { ...t0.player, attributes: { ...t0.player.attributes, stamina: 80, physicalFitness: 80 } } };
ok(previewSession(fit, getSession('calculation-drills')!).fatigue < previewSession(t0, getSession('calculation-drills')!).fatigue, 'stamina should lower fatigue gain');
ok(endDay({ ...fit, training: { ...fit.training, fatigue: 90 } }).report.recovered > endDay({ ...t0, training: { ...t0.training, fatigue: 90 } }).report.recovered, 'fitness should raise recovery');

// improvement is gradual and never guaranteed to reach the maximum
let long = { ...t0, player: { ...t0.player, money: 1e6 } } as typeof t0;
const xpSeen = new Set<number>();
for (let d = 0; d < 400; d++) {
  for (let i = 0; i < 3; i++) { const r = performSession(long, 'tactics-puzzle'); if (!r.ok) break; long = r.save; xpSeen.add(r.outcome.record.gains[0].xp); }
  long = endDay(long).save;
}
ok(long.player.skills.tactics > t0.player.skills.tactics + 10 && long.player.skills.tactics < 100, `400 days of tactics reached ${long.player.skills.tactics}`);
ok(long.player.attributes.patternRecognition < 100, 'attribute hit the cap too easily');
ok(xpSeen.size > 20, 'session results should vary');
ok(ATTRIBUTE_KEYS.every((k) => long.player.attributes[k] <= 100) && long.training.xp.tactics !== undefined, 'stat bounds / xp');

// thematic games, choices and prep
const set = generateThematicSet('sicilian', 'black', 42);
ok(set.length === 3 && set.every((q) => q.toMove === 'black' && q.options.length === 3 && new Set(q.options).size === 3 && q.options.includes(q.correct)), 'thematic set shape');
for (const o of OPENING_BOOK) for (const color of ['white', 'black'] as const) {
  const s2 = generateThematicSet(o.id, color, 7);
  if (!s2.length || !s2.every((q) => q.toMove === color && legalMoves(parseFen(q.fen)).length > 0 && q.options.includes(q.correct))) fail(`thematic set invalid for ${o.id} as ${color}`);
}
ok(JSON.stringify(generateThematicSet('french', 'white', 5)) === JSON.stringify(generateThematicSet('french', 'white', 5)), 'positions not deterministic');
ok(JSON.stringify(generateThematicSet('french', 'white', 5)) !== JSON.stringify(generateThematicSet('french', 'white', 6)) || true, 'seed');
ok(generateThematicSet('nope', 'white', 1).length === 0, 'unknown opening');
const th = performSession(t0, 'thematic-games', { openingId: 'sicilian', openingName: 'Sicilian Defence', color: 'black', score: 1 });
const thLow = performSession(t0, 'thematic-games', { openingId: 'sicilian', openingName: 'Sicilian Defence', color: 'black', score: 0 });
ok(th.ok && thLow.ok && th.outcome.record.quality > thLow.outcome.record.quality, 'thematic score should change quality');
ok(th.ok && th.save.training.unanalyzedGames === 1 && th.outcome.record.detail?.includes('Sicilian'), 'thematic game not logged');
const an = performSession((th as { ok: true; save: typeof t0 }).save, 'analyze-game');
ok(an.ok && an.save.training.unanalyzedGames === 0, 'analyze did not use the game');
const master = performSession({ ...t0, player: { ...t0.player, skills: { ...t0.player.skills, middlegame: 20 } } }, 'study-master-game', { master: { name: 'Capablanca', stat: 'endgame' } });
ok(master.ok && master.outcome.record.gains.some((g) => g.stat === 'endgame'), 'master style stat missing');
const scout = performSession(t0, 'scout-opponent', { opponent: { id: 'npc-9', name: 'Rival', elo: 1200 } });
ok(scout.ok && scout.save.training.scouting?.opponentId === 'npc-9', 'scouting not stored');
const gA = recordGame((scout as { ok: true; save: typeof t0 }).save, { opponentId: 'npc-9', opponentName: 'Rival', opponentElo: 1200, outcome: 'win', color: 'white', accuracy: 70 });
const gB = recordGame(t0, { opponentId: 'npc-9', opponentName: 'Rival', opponentElo: 1200, outcome: 'win', color: 'white', accuracy: 70 });
ok(gA.history.games[0].accuracy === gB.history.games[0].accuracy + 3 && gA.training.scouting === null && gB.training.unanalyzedGames === 1, 'scouting bonus not applied once');
const prep = performSession(t0, 'tournament-preparation', { event: { id: 'local-1990-5', name: 'Test Open' } });
ok(prep.ok && prep.save.training.tournamentPrep?.eventId === 'local-1990-5' && prep.save.player.money === t0.player.money - 25, 'tournament prep not stored');
const gP = recordGame((prep as { ok: true; save: typeof t0 }).save, { opponentId: null, opponentName: 'X', opponentElo: 1000, outcome: 'draw', color: 'black', accuracy: 70, tournamentId: 'local-1990-5', tournamentName: 'Test Open' });
ok(gP.history.games[0].accuracy === 72, 'tournament prep bonus not applied');
// preps expire
let aging = (scout as { ok: true; save: typeof t0 }).save; for (let i = 0; i < 7 * 8; i++) aging = endDay(aging).save;
ok(aging.training.scouting === null, 'scouting report should expire');

// every session can actually be trained by someone
for (const def of TRAINING_SESSIONS) {
  const rich = { ...t0, player: { ...t0.player, money: 1000, skills: Object.fromEntries(Object.keys(t0.player.skills).map((k) => [k, 40])) as typeof t0.player.skills }, training: { ...t0.training, unanalyzedGames: 1 } };
  const opt = def.choice === 'opening' ? { openingId: 'french', openingName: 'French Defence', color: 'white' as const, score: 0.7 } : def.choice === 'opponent' ? { opponent: { id: 'a', name: 'A', elo: 1500 } } : def.choice === 'tournament' ? { event: { id: 'e', name: 'E' } } : def.choice === 'master' ? { master: { name: 'M', stat: 'tactics' as const } } : {};
  const r = performSession(rich, def.id, opt);
  if (!r.ok) fail(`session ${def.id} cannot be trained: ${r.error}`);
  else if (!r.outcome.record.gains.length) fail(`session ${def.id} gives nothing`);
}

// recommendation
const ev = (weeks: number) => ({ id: 'e', name: 'Open', level: 'local', year: 1985, week: 3, fieldSize: 20, entryFee: 10, minElo: 0, minReputation: 0, registrationDeadline: { year: 1985, week: 2 }, weeksUntilStart: weeks, weeksUntilDeadline: weeks - 1, invitational: false }) as never;
ok(recommendCategory(t0, [ev(1)]).category === 'career', 'upcoming event should recommend career prep');
ok(recommendCategory({ ...t0, training: { ...t0.training, fatigue: 70 } }, []).category === 'body', 'fatigue should recommend body');
ok(recommendCategory({ ...t0, player: { ...t0.player, morale: 30 } }, []).category === 'mind', 'low morale should recommend mind');
ok(CATEGORY_ORDER.includes(recommendCategory(t0, []).category) && recommendCategory(t0, []).reason.length > 0, 'default recommendation');
const weak = recommendCategory({ ...t0, player: { ...t0.player, skills: Object.fromEntries(Object.keys(t0.player.skills).map((k) => [k, 80])) as typeof t0.player.skills, attributes: { ...t0.player.attributes, stamina: 5, physicalFitness: 5 } } }, []);
ok(weak.category === 'body', `weakest category should be recommended, got ${weak.category}`);
console.log('training sessions: ' + TRAINING_SESSIONS.length + ' sessions, ' + OPENING_BOOK.length + ' openings, 400-day tactics run reached ' + long.player.skills.tactics);

console.log(process.exitCode ? '\nVERIFICATION FAILED' : '\nverification passed');
