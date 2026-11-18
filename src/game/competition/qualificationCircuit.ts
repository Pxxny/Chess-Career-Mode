import majorCities from '../../data/world/fideMajorCities.json' with { type: 'json' };
import type { Npc } from '@/types';
import type { CompetitionState, EventDetails, Qualification } from './types';
import type { Region, ScheduledEvent } from '@/game/world/schedule';
import { COUNTRIES, getCountry } from '@/data/world/countries';
import { getSeedCities } from '@/data/world/seedCities';
import { hashString } from '@/utils/format';
import { createRng } from '@/game/rng';
import { span } from '@/diagnostics/spanSink';
import { SELECT_SPONSORS, SELECT_TOUR_TYPES, seriesName, SELECT_WORLD_FIELD, SELECT_BASE_SEATS, SELECT_BOOST_SEATS, selectSeriesId, selectTourType, selectNpcEligible } from './selectTours';

export const CIRCUIT_SPONSORS = [
  { id: '', name: 'Aurora Chess Foundation', final: 'Aurora World Qualification Finals' },
  { id: 'meridian', name: 'Meridian Strategy Group', final: 'Meridian World Qualification Finals' },
  { id: 'silverbrook', name: 'Silverbrook', final: 'Silverbrook World Qualification Finals' },
  { id: 'cobalt-lantern', name: 'Cobalt Lantern', final: 'Cobalt Lantern World Qualification Finals' },
  { id: 'zenith-arc', name: 'Zenith Arc', final: 'Zenith Arc World Qualification Finals' },
  { id: 'fide', name: 'FIDE Official Qualification Circuit', final: 'FIDE World Qualification Finals' },
] as const;
export function circuitQuota(stage: Circuit['stage'], year: number, scope: string, heat = 0, series = '') {
  const key = hashString(`${series}:${year}:${scope}:${stage}:${heat}:quota`);
  return stage === 'local' ? 1 + key % 5 : stage === 'national' ? 5 + key % 11 : stage === 'continental' ? 12 + key % 21 : 0;
}
export const CIRCUIT_LABELS: Partial<Record<Qualification, string>> = {
  'circuit-national': 'National Qualifying Championship',
  'circuit-continental': 'Continental Qualifying Championship',
  'circuit-world': 'World Qualification Finals',
};
type Circuit = NonNullable<EventDetails['qualificationCircuit']>;
type Earned = CompetitionState['qualifications'][number];
export const circuitEventId = (stage: Circuit['stage'], year: number, scope: string, heat = 0, series = '') =>
  `qualify-${stage}-${scope.replaceAll(' ', '-')}-${year}${stage === 'local' ? `-${heat}` : ''}${series ? `-${series}` : ''}`;
export const circuitVisible = (country: string, details?: EventDetails) => {
  const c = details?.qualificationCircuit;
  return !c || ((!c.country || c.country === country) && (!c.continent || c.continent === getCountry(country)?.continent));
};
export function qualificationMatches(q: Earned, event: Pick<ScheduledEvent, 'id' | 'year' | 'details'>, currentYear: number) {
  if (q.kind !== event.details?.qualification || q.year > currentYear) return false;
  const circuit = event.details?.qualificationCircuit;
  if (circuit) return q.eventId === event.id && q.year === circuit.season &&
    (!circuit.country || q.country === circuit.country) && (!circuit.continent || q.continent === circuit.continent);
  return q.year >= currentYear - 2;
}
export function circuitAdvancement(details?: EventDetails) {
  const c = details?.qualificationCircuit;
  if (c?.selectTour && c.stage === 'national') return `Top ${c.advanceTop ?? 1} from this country reach the ${c.worldFinalName ?? 'World Finals'}.`;
  if (c?.selectTour && c.stage === 'world') return 'Final stage · one seat per country.';
  if (!c?.advanceTop || !c.advanceKind) return '';
  return `Top ${c.advanceTop} qualify for ${CIRCUIT_LABELS[c.advanceKind]}.`;
}
export function qualificationCircuitEvents(year: number, region: Region): ScheduledEvent[] {
  const country = getCountry(region.countryCode), continent = country?.continent ?? region.continent;
  const domesticCities = [...new Set([...(getSeedCities(region.countryCode)), country?.capital ?? region.city])];
  const hosts = COUNTRIES.filter((c) => c.continent === continent && c.capital);
  const continentalHost = hosts[hashString(`${continent}:${year}`) % hosts.length] ?? country;
  const worldHosts = COUNTRIES.filter((c) => c.capital && c.continent !== 'Antarctica' && c.status === 'sovereign');
  const worldHost = worldHosts[hashString(`qualifier-world:${year}`) % worldHosts.length] ?? country;
  const make = (sponsor: typeof CIRCUIT_SPONSORS[number], stage: Circuit['stage'], week: number, heat = 0): ScheduledEvent => {
    const domestic = stage === 'local' || stage === 'national';
    const scope = domestic ? region.countryCode : stage === 'continental' ? continent : 'all';
    const advanceKind: Qualification | undefined = stage === 'local' ? 'circuit-national' : stage === 'national' ? 'circuit-continental' : stage === 'continental' ? 'circuit-world' : undefined;
    const nextStage = stage === 'local' ? 'national' : stage === 'national' ? 'continental' : 'world';
    const targetScope = stage === 'local' ? region.countryCode : stage === 'national' ? continent : 'all';
    const cities=majorCities as Record<string,Array<{name:string;population:number}>>;
    const majorHosts=worldHosts.filter(c=>cities[c.code]?.length);
    const regionalMajors=majorHosts.filter(c=>c.continent===continent);
    const fidePool=stage==='world'?majorHosts:regionalMajors.length?regionalMajors:majorHosts;
    const fideHost=domestic&&cities[region.countryCode]?.length?country:fidePool[hashString(`${year}:${stage}:${scope}:fide-host`)%fidePool.length];
    const host = sponsor.id==='fide'?fideHost:domestic?country:stage==='continental'?continentalHost:worldHost;
    const cityChoices=cities[host?.code??'']??[];
    const location = sponsor.id==='fide'?cityChoices[(hashString(`${year}:${stage}:${scope}`)+heat)%cityChoices.length].name:domestic?domesticCities[hashString(`${year}:${stage}:${heat}:${scope}`)%domesticCities.length]??region.city:host?.capital??region.city;
    const label = stage === 'local' ? `${country?.name ?? scope} Local Qualifier ${heat + 1}` : stage === 'national' ? `${country?.name ?? scope} National Qualifying Championship` : stage === 'continental' ? `${continent} Continental Qualifying Championship` : 'World Qualification Finals';
    return {
      id: circuitEventId(stage, year, scope, heat, sponsor.id), name: `${sponsor.id === '' ? 'Aurora' : sponsor.id === 'meridian' ? 'Meridian' : sponsor.id === 'fide' ? 'FIDE' : sponsor.name} ${label} ${year}`, year, week,
      level: stage === 'local' ? 'local' : stage === 'national' ? 'national' : stage === 'continental' ? 'international' : 'elite',
      fieldSize: stage === 'local' ? 32 : stage === 'national' ? 64 : stage === 'continental' ? 256 : 193,
      entryFee: stage === 'local' ? 5 : stage === 'national' ? 10 : stage === 'continental' ? 20 : 0,
      minElo: 0, minReputation: 0, registrationDeadline: { year, week: week - 1 },
      weeksUntilStart: 0, weeksUntilDeadline: 0, invitational: stage !== 'local',
      details: {
        qualificationCircuit: { stage, season: year, seriesId: sponsor.id, ...(sponsor.id==='fide'?{}:{sponsor:sponsor.name}), worldFinalId: circuitEventId('world', year, 'all', 0, sponsor.id), worldFinalName: `${sponsor.final} ${year}`, ...(domestic ? { country: scope } : stage === 'continental' ? { continent } : {}),
          ...(stage === 'local' ? { heat } : {}), ...(advanceKind ? { advanceKind, advanceTop: circuitQuota(stage, year, scope, heat, sponsor.id), targetEventId: circuitEventId(nextStage, year, targetScope, 0, sponsor.id) } : {}) },
        ...(stage !== 'local' ? { qualification: `circuit-${stage}` as Qualification } : {}),
        ...(domestic ? { nationality: region.countryCode } : {}),
        host: { mode: 'rotation' }, category: 'Qualification Circuit', country: host?.code ?? region.countryCode, location,
        end: { year, week }, format: 'swiss', rounds: stage === 'local' ? 5 : 9,
        timeControl: { id: 'qualifier-classical', label: '30+10', base: 1800, increment: 10, category: 'classical' },
        prize: stage === 'local' ? 100 : stage === 'national' ? 1000 : stage === 'continental' ? 10000 : 50000,
        prestige: stage === 'local' ? 10 : stage === 'national' ? 30 : stage === 'continental' ? 60 : 90,
        provenance: sponsor.id==='fide'?'inspired':'fictional', organizer: { name: sponsor.id==='fide'?'FIDE':sponsor.name, status: 'Official', simulated: true, ...(sponsor.id==='fide'?{}:{sponsorId:sponsor.id||'aurora-horizon'}) },
      },
    };
  };
  const selectEvents = (): ScheduledEvent[] => SELECT_SPONSORS.flatMap((sponsor, si) => SELECT_TOUR_TYPES.flatMap((type, ti) => {
    const series = selectSeriesId(sponsor.id, type.id), worldId = circuitEventId('world', year, 'all', 0, series);
    const name = seriesName(sponsor, type);
    const worldName = `${name} — World Finals`;
    const worldHost = worldHosts[hashString(`${series}:${year}:select-world`) % worldHosts.length] ?? country;
    const nationalWeek = 14 + ti * 2 + si, worldWeek = 32 + ti * 2 + si;
    const base = { year, minElo: 0, minReputation: 0, weeksUntilStart: 0, weeksUntilDeadline: 0 };
    const tc = { id: 'qualifier-classical', label: '30+10', base: 1800, increment: 10, category: 'classical' as const };
    const common = { gender: type.gender, maxAge: type.maxAge, category: 'Qualification Circuit', host: { mode: 'rotation' as const }, format: 'swiss' as const, timeControl: tc, provenance: 'fictional' as const,
      organizer: { name: sponsor.name, status: 'Official' as const, simulated: true, sponsorId: sponsor.id } };
    const select = { type: type.id, label: type.label };
    const national: ScheduledEvent = { ...base, id: circuitEventId('national', year, region.countryCode, 0, series), name: `${name} — National Qualifier`,
      week: nationalWeek, level: 'national', fieldSize: 64, entryFee: 15, registrationDeadline: { year, week: nationalWeek - 1 }, invitational: false,
      details: { ...common, qualificationCircuit: { stage: 'national', season: year, seriesId: series, sponsor: sponsor.name, worldFinalId: worldId, worldFinalName: worldName, country: region.countryCode,
          advanceKind: 'circuit-world', advanceTop: SELECT_BASE_SEATS, targetEventId: worldId, selectTour: select },
        nationality: region.countryCode,
        country: region.countryCode, location: domesticCities[hashString(`${year}:${series}:select-national:${region.countryCode}`) % domesticCities.length] ?? region.city,
        end: { year, week: nationalWeek }, rounds: 7, prize: 5000, prestige: 35 } };
    const world: ScheduledEvent = { ...base, id: worldId, name: worldName, week: worldWeek, level: 'elite', fieldSize: SELECT_WORLD_FIELD, entryFee: 0,
      registrationDeadline: { year, week: worldWeek - 1 }, invitational: true,
      details: { ...common, qualificationCircuit: { stage: 'world', season: year, seriesId: series, sponsor: sponsor.name, worldFinalId: worldId, worldFinalName: worldName, selectTour: select },
        qualification: 'circuit-world', country: worldHost?.code ?? region.countryCode, location: worldHost?.capital ?? region.city,
        end: { year, week: worldWeek }, rounds: 9, prize: type.worldPrize, prestige: 95 } };
    return [national, world];
  }));
  return [...CIRCUIT_SPONSORS.flatMap((sponsor, i) => [...Array.from({ length: 8 }, (_, heat) => make(sponsor, 'local', (i<2?4:4+(i-1)*2) + heat, heat)), make(sponsor, 'national', i<2?20+i*2:24+(i-2)*2), make(sponsor, 'continental', i<2?32+i*2:36+(i-2)*2), make(sponsor, 'world', i<2?46+i*2:44+(i-2)*2)]), ...selectEvents()];
}

/** Calendar-only catalog: foreign editions are visible, never added to the entry schedule. */
const globalCircuitCache=new Map<number,ScheduledEvent[]>();
export function globalQualificationCalendar(year:number):ScheduledEvent[]{
 const cached=globalCircuitCache.get(year);if(cached)return cached;
 const events=new Map<string,ScheduledEvent>();
 for(const country of COUNTRIES.filter(c=>c.capital&&c.continent!=='Antarctica')){
  const region={countryCode:country.code,city:country.capital!,continent:country.continent,demonym:country.nationality};
  for(const event of qualificationCircuitEvents(year,region))if(!events.has(event.id))events.set(event.id,event);
 }
 const result=[...events.values()];if(globalCircuitCache.size>3)globalCircuitCache.clear();globalCircuitCache.set(year,result);return result;
}

/** Background federation qualifiers use seeded game results. Real recorded results take precedence.
 * No NPC gains entry solely from a rating threshold; every selected ID has an advancing rank.
 * The cache key is the circuit, the seed, and every field this function reads (identity, status,
 * age, gender, baseline, and each history row's event, rank and qualification target). History
 * length is not a key: two rows with the same count but different ranks must not collide.
 * Stored values are ids, mapped back onto the array passed in, so a later rating change is visible.
 */
const fieldCache = new Map<string, string[]>();
const dependencyByRoster = new WeakMap<Npc[], number>();
function mixHash(hash: number, value: number): number {
  return Math.imul(hash ^ value, 16777619);
}
function circuitDependency(npcs: Npc[]): number {
  const known = dependencyByRoster.get(npcs);
  if (known !== undefined) return known;
  const text = (value: unknown) =>
    hashString(typeof value === "string" ? value : "");
  let hash = 2166136261;
  for (const n of npcs) {
    hash = mixHash(hash, text(n.id));
    hash = mixHash(hash, text(n.nationality));
    hash = mixHash(hash, text(n.careerStatus));
    hash = mixHash(hash, n.age | 0);
    hash = mixHash(hash, text(n.gender));
    hash = mixHash(hash, (n.simulationPeakBase ?? n.potentialRating) | 0);
    for (const row of n.tournamentHistory ?? []) {
      hash = mixHash(hash, text(row.eventId));
      hash = mixHash(hash, row.rank | 0);
      hash = mixHash(hash, row.qualificationEvaluated ? 1 : 0);
      hash = mixHash(hash, text(row.qualificationTarget));
    }
    hash = mixHash(hash, 0x9e3779b9);
  }
  const done = hash >>> 0;
  dependencyByRoster.set(npcs, done);
  return done;
}
export function circuitNpcField(event: Pick<ScheduledEvent, 'details'>, npcs: Npc[], seed: number): Npc[] {
  return span("calendar.qualifiers", () => {
    const c = event.details?.qualificationCircuit;
    if (!c) return npcs;
    const key = `${seed}:${circuitDependency(npcs)}:${JSON.stringify(c)}`;
    const cached = fieldCache.get(key);
    if (cached) {
      const byId = new Map(npcs.map((n) => [n.id, n]));
      const resolved = cached.map((id) => byId.get(id));
      if (resolved.every((n): n is Npc => !!n)) return resolved;
    }
    const pool = circuitNpcFieldUncached(event, npcs, seed);
    if (fieldCache.size > 64) fieldCache.clear();
    fieldCache.set(key, pool.map((n) => n.id));
    return pool;
  });
}
function circuitNpcFieldUncached(event: Pick<ScheduledEvent, 'details'>, npcs: Npc[], seed: number): Npc[] {
  const c = event.details?.qualificationCircuit;
  if (!c) return npcs;
  const active = npcs.filter((n) => n.careerStatus === 'active' || n.careerStatus === 'semi-retired');
  const byCountry = new Map<string, Npc[]>();
  for (const n of active) { const pool = byCountry.get(n.nationality) ?? []; pool.push(n); byCountry.set(n.nationality, pool); }
  const top = (pool: Npc[], id: string, count: number): Npc[] => {
    const actual = pool.map((n) => ({ n, result: n.tournamentHistory.find((h) => h.eventId === id && h.rank > 0) })).filter((r) => r.result);
    if (actual.length) return actual.filter((r) => r.result!.qualificationEvaluated ? !!r.result!.qualificationTarget : r.result!.rank <= count).sort((a,b) => a.result!.rank - b.result!.rank).map((r) => r.n);
    const sorted = [...pool].sort((a,b) => a.id.localeCompare(b.id));
    const rng = createRng(hashString(`${seed}:${id}`));
    const points = new Map(sorted.map((n) => [n.id, 0]));
    // Seven rounds of seeded pairings; Elo affects game probability, never automatic qualification.
    for (let r = 0; r < 7; r++) {
      const order = rng.shuffle(sorted);
      for (let i = 0; i < order.length; i += 2) {
        const a = order[i], b = order[i+1];
        if (!b) { points.set(a.id, points.get(a.id)! + 1); continue; }
        const baseline = (n: Npc) => n.simulationPeakBase ?? n.potentialRating;
        const expected = 1 / (1 + 10 ** ((baseline(b) - baseline(a)) / 400));
        const score = rng.chance(0.3) ? 0.5 : rng.chance(expected) ? 1 : 0;
        points.set(a.id, points.get(a.id)! + score); points.set(b.id, points.get(b.id)! + 1 - score);
      }
    }
    return sorted.sort((a,b) => points.get(b.id)! - points.get(a.id)! || hashString(`${id}:${a.id}`) - hashString(`${id}:${b.id}`) || a.id.localeCompare(b.id)).slice(0, count);
  };
  const sel = c.selectTour;
  if (sel) {
    // Select tours: no Local/Continental rounds. National pool is every eligible player of the country.
    const type = selectTourType(sel.type);
    const eligible = (code: string) => (byCountry.get(code) ?? []).filter((n) => selectNpcEligible(n, type));
    const seats = (code: string) => (sel.quotaBoost?.includes(code) ? SELECT_BOOST_SEATS : SELECT_BASE_SEATS);
    if (c.stage === 'national') return (eligible(c.country!));
    return ([...byCountry.keys()].flatMap((code) => top(eligible(code), circuitEventId('national', c.season, code, 0, c.seriesId), seats(code))));
  }
  const local = (pool: Npc[], heat: number) => pool.filter((n) => hashString(`${c.season}:${n.id}:heat`) % 8 === heat);
  const national = (country: string, pool: Npc[]) => Array.from({length:8},(_,heat) => top(local(pool,heat), circuitEventId('local',c.season,country,heat,c.seriesId),circuitQuota('local',c.season,country,heat,c.seriesId))).flat();
  const continental = (continent: string) => [...byCountry].filter(([code]) => getCountry(code)?.continent === continent).flatMap(([code,pool]) => top(national(code,pool),circuitEventId('national',c.season,code,0,c.seriesId),circuitQuota('national',c.season,code,0,c.seriesId)));
  if (c.stage === 'local') return (local(byCountry.get(c.country!) ?? [], c.heat!));
  if (c.stage === 'national') return (national(c.country!,byCountry.get(c.country!) ?? []));
  if (c.stage === 'continental') return (continental(c.continent!));
  const continents = [...new Set([...byCountry.keys()].map((code) => getCountry(code)?.continent).filter((s): s is NonNullable<typeof s> => !!s && s !== 'Antarctica'))];
  return (continents.flatMap((continent) => top(continental(continent),circuitEventId('continental',c.season,continent,0,c.seriesId),circuitQuota('continental',c.season,continent,0,c.seriesId))));
}
