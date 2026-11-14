import type { Npc } from '@/types';
import type { CompetitionState, EventDetails, Qualification } from './types';
import type { Region, ScheduledEvent } from '@/game/world/schedule';
import { COUNTRIES, getCountry } from '@/data/world/countries';
import { getSeedCities } from '@/data/world/seedCities';
import { hashString } from '@/utils/format';
import { createRng } from '@/game/rng';

export const CIRCUIT_SPONSORS = [
  { id: '', name: 'Aurora Chess Foundation', final: 'Aurora World Qualification Finals' },
  { id: 'meridian', name: 'Meridian Strategy Group', final: 'Meridian World Qualification Finals' },
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
    const host = domestic ? country : stage === 'continental' ? continentalHost : worldHost;
    const location = domestic ? domesticCities[hashString(`${year}:${stage}:${heat}:${scope}`) % domesticCities.length] ?? region.city : host?.capital ?? region.city;
    const label = stage === 'local' ? `${country?.name ?? scope} Local Qualifier ${heat + 1}` : stage === 'national' ? `${country?.name ?? scope} National Qualifying Championship` : stage === 'continental' ? `${continent} Continental Qualifying Championship` : 'World Qualification Finals';
    return {
      id: circuitEventId(stage, year, scope, heat, sponsor.id), name: `${sponsor.id ? 'Meridian' : 'Aurora'} ${label} ${year}`, year, week,
      level: stage === 'local' ? 'local' : stage === 'national' ? 'national' : stage === 'continental' ? 'international' : 'elite',
      fieldSize: stage === 'local' ? 32 : stage === 'national' ? 64 : stage === 'continental' ? 256 : 193,
      entryFee: stage === 'local' ? 5 : stage === 'national' ? 10 : stage === 'continental' ? 20 : 0,
      minElo: 0, minReputation: 0, registrationDeadline: { year, week: week - 1 },
      weeksUntilStart: 0, weeksUntilDeadline: 0, invitational: stage !== 'local',
      details: {
        qualificationCircuit: { stage, season: year, seriesId: sponsor.id, sponsor: sponsor.name, worldFinalId: circuitEventId('world', year, 'all', 0, sponsor.id), worldFinalName: `${sponsor.final} ${year}`, ...(domestic ? { country: scope } : stage === 'continental' ? { continent } : {}),
          ...(stage === 'local' ? { heat } : {}), ...(advanceKind ? { advanceKind, advanceTop: circuitQuota(stage, year, scope, heat, sponsor.id), targetEventId: circuitEventId(nextStage, year, targetScope, 0, sponsor.id) } : {}) },
        ...(stage !== 'local' ? { qualification: `circuit-${stage}` as Qualification } : {}),
        ...(domestic ? { nationality: region.countryCode } : {}),
        host: { mode: 'rotation' }, category: 'Qualification Circuit', country: host?.code ?? region.countryCode, location,
        end: { year, week }, format: 'swiss', rounds: stage === 'local' ? 5 : 9,
        timeControl: { id: 'qualifier-classical', label: '30+10', base: 1800, increment: 10, category: 'classical' },
        prize: stage === 'local' ? 100 : stage === 'national' ? 1000 : stage === 'continental' ? 10000 : 50000,
        prestige: stage === 'local' ? 10 : stage === 'national' ? 30 : stage === 'continental' ? 60 : 90,
        provenance: 'fictional', organizer: { name: 'Career Qualification Circuit', status: 'Official', simulated: true },
      },
    };
  };
  return CIRCUIT_SPONSORS.flatMap((sponsor, i) => [...Array.from({ length: 8 }, (_, heat) => make(sponsor, 'local', 4 + heat, heat)), make(sponsor, 'national', 20 + i * 2), make(sponsor, 'continental', 32 + i * 2), make(sponsor, 'world', 46 + i * 2)]);
}

/** Background federation qualifiers use seeded game results. Real recorded results take precedence.
 * No NPC gains entry solely from a rating threshold; every selected ID has an advancing rank.
 */
const npcPools = new WeakMap<Npc[], Map<string, Npc[]>>();
export function circuitNpcField(event: Pick<ScheduledEvent, 'details'>, npcs: Npc[], seed: number): Npc[] {
  const c = event.details?.qualificationCircuit;
  if (!c) return npcs;
  let cache = npcPools.get(npcs);
  if (!cache) { cache = new Map(); npcPools.set(npcs, cache); }
  const key = JSON.stringify([c, seed]);
  const cached = cache.get(key); if (cached) return cached;
  const remember = (pool: Npc[]) => { cache!.set(key, pool); return pool; };
  const active = npcs.filter((n) => n.careerStatus === 'active' || n.careerStatus === 'semi-retired');
  const byCountry = new Map<string, Npc[]>();
  for (const n of active) { const pool = byCountry.get(n.nationality) ?? []; pool.push(n); byCountry.set(n.nationality, pool); }
  const top = (pool: Npc[], id: string, count: number): Npc[] => {
    const actual = pool.map((n) => ({ n, result: n.tournamentHistory.find((h) => h.eventId === id && h.rank > 0) })).filter((r) => r.result);
    if (actual.length) return actual.filter((r) => r.result!.rank <= count).sort((a,b) => a.result!.rank - b.result!.rank).map((r) => r.n);
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
  const local = (pool: Npc[], heat: number) => pool.filter((n) => hashString(`${c.season}:${n.id}:heat`) % 8 === heat);
  const national = (country: string, pool: Npc[]) => Array.from({length:8},(_,heat) => top(local(pool,heat), circuitEventId('local',c.season,country,heat,c.seriesId),circuitQuota('local',c.season,country,heat,c.seriesId))).flat();
  const continental = (continent: string) => [...byCountry].filter(([code]) => getCountry(code)?.continent === continent).flatMap(([code,pool]) => top(national(code,pool),circuitEventId('national',c.season,code,0,c.seriesId),circuitQuota('national',c.season,code,0,c.seriesId)));
  if (c.stage === 'local') return remember(local(byCountry.get(c.country!) ?? [], c.heat!));
  if (c.stage === 'national') return remember(national(c.country!,byCountry.get(c.country!) ?? []));
  if (c.stage === 'continental') return remember(continental(c.continent!));
  const continents = [...new Set([...byCountry.keys()].map((code) => getCountry(code)?.continent).filter((s): s is NonNullable<typeof s> => !!s && s !== 'Antarctica'))];
  return remember(continents.flatMap((continent) => top(continental(continent),circuitEventId('continental',c.season,continent,0,c.seriesId),circuitQuota('continental',c.season,continent,0,c.seriesId))));
}
