import worldCountries from 'world-countries';
import type { Continent, Country } from '@/types';
import { normalizeText } from '@/utils/text';
import { buildFederation } from './federations';

/**
 * Countries come from the maintained `world-countries` dataset (ISO 3166-1 plus
 * territories). Nothing here is a hand-written country list.
 */

function continentOf(region: string, subregion: string): Continent {
  switch (region) {
    case 'Americas':
      return subregion === 'South America' ? 'South America' : 'North America';
    case 'Antarctic':
      return 'Antarctica';
    case 'Africa':
    case 'Asia':
    case 'Europe':
    case 'Oceania':
      return region;
    default:
      return 'Asia';
  }
}

const fromDataset: Country[] = worldCountries.map((c) => ({
  code: c.cca2,
  code3: c.cca3,
  name: c.name.common,
  officialName: c.name.official,
  nationality: c.demonyms?.eng?.m || c.demonyms?.eng?.f || `${c.name.common} national`,
  flag: c.flag,
  continent: continentOf(c.region, c.subregion),
  subregion: c.subregion,
  capital: c.capital?.[0] ?? null,
  federation: buildFederation(c.cca3, c.name.common),
  aliases: c.altSpellings ?? [],
  status: c.independent ? 'sovereign' : 'territory',
}));

/** FIDE home-nation federations that have no ISO 3166-1 code of their own. */
const TAG = (letters: string) => [...letters].map((ch) => String.fromCodePoint(0xe0000 + ch.charCodeAt(0))).join('');
const SUBDIVISION_FLAG = (tag: string) => `\u{1F3F4}${TAG(tag)}\u{E007F}`;

const additional: Country[] = [
  { code: 'GB-ENG', code3: 'ENG', name: 'England', nationality: 'English', flag: SUBDIVISION_FLAG('gbeng'), capital: 'London' },
  { code: 'GB-SCO', code3: 'SCO', name: 'Scotland', nationality: 'Scottish', flag: SUBDIVISION_FLAG('gbsct'), capital: 'Edinburgh' },
  { code: 'GB-WLS', code3: 'WLS', name: 'Wales', nationality: 'Welsh', flag: SUBDIVISION_FLAG('gbwls'), capital: 'Cardiff' },
].map((c) => ({
  ...c,
  officialName: c.name,
  continent: 'Europe' as const,
  subregion: 'Northern Europe',
  federation: buildFederation(c.code3, c.name),
  aliases: [],
  status: 'additional' as const,
}));

export const COUNTRIES: Country[] = [...fromDataset, ...additional].sort((a, b) =>
  a.name.localeCompare(b.name, 'en'),
);

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export const getCountry = (code: string): Country | undefined => BY_CODE.get(code);
export const getCountryName = (code: string): string => BY_CODE.get(code)?.name ?? code;

const SEARCH_INDEX = COUNTRIES.map((country) => ({
  country,
  name: normalizeText(country.name),
  other: normalizeText(
    [country.officialName, country.nationality, country.code, country.code3, country.federation.code, ...country.aliases].join(' '),
  ),
}));

export function searchCountries(query: string, limit = 300): Country[] {
  const q = normalizeText(query);
  if (!q) return COUNTRIES.slice(0, limit);
  const scored: Array<{ country: Country; score: number }> = [];
  for (const entry of SEARCH_INDEX) {
    let score = 0;
    if (entry.name.startsWith(q)) score = 3;
    else if (entry.name.includes(q)) score = 2;
    else if (entry.other.includes(q)) score = 1;
    if (score) scored.push({ country: entry.country, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.country.name.localeCompare(b.country.name, 'en'))
    .slice(0, limit)
    .map((s) => s.country);
}
