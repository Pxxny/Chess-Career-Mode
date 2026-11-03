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
console.log(process.exitCode ? '\nVERIFICATION FAILED' : '\nverification passed');
