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
import { applySkillUpgrade, upgradeCost } from '../src/game/player/training.ts';
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

// skill upgrades: cost, AP spend, history, affinity bonus, blocking
const before = save.player.skills.tactics;
const up = applySkillUpgrade(save, 'tactics')!;
ok(up.player.skills.tactics === before + 1, 'upgrade did not add 1');
ok(up.player.ap.current === 10 - upgradeCost(before), 'upgrade cost not spent');
ok(up.history.training.length === 1, 'training not logged');
ok(applySkillUpgrade({ ...save, player: { ...save.player, ap: { current: 0, max: 10 } } }, 'tactics') === null, 'upgrade allowed without AP');
ok(applySkillUpgrade({ ...save, player: { ...save.player, skills: { ...save.player.skills, tactics: 100 } } }, 'tactics') === null, 'upgrade allowed at max');
let aff = { ...save, player: { ...save.player, ap: { current: 99, max: 99 } } };
for (let i = 0; i < 4; i++) aff = applySkillUpgrade(aff, 'tactics')!;
ok(aff.player.skills.tactics === before + 5, `attacker affinity gain wrong: ${aff.player.skills.tactics - before}`);
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

console.log(process.exitCode ? '\nVERIFICATION FAILED' : '\nverification passed');
