import { getSeedCities } from '@/data/world/seedCities';
import type { City, Country } from '@/types';

const cache = new Map<string, City[] | null>();

/** Per-country files are produced by scripts/build-world-data.mjs as [name, population][]. */
async function fetchDataset(code: string): Promise<City[] | null> {
  if (cache.has(code)) return cache.get(code) ?? null;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/cities/${code}.json`);
    if (!response.ok) throw new Error(String(response.status));
    const rows: unknown = await response.json(); // a missing file returns index.html, which fails here
    if (!Array.isArray(rows)) throw new Error('unexpected city file');
    const cities = (rows as Array<[string, number]>).map(([name, population]) => ({ name, population }));
    cache.set(code, cities);
    return cities;
  } catch {
    cache.set(code, null);
    return null;
  }
}

/** Offline fallback: curated major cities plus the capital. */
export function fallbackCities(country: Country): City[] {
  const names = new Set<string>();
  const cities: City[] = [];
  const add = (name: string, isCapital = false) => {
    if (names.has(name)) return;
    names.add(name);
    cities.push({ name, population: 0, isCapital });
  };
  if (country.capital) add(country.capital, true);
  getSeedCities(country.code).forEach((name) => add(name, name === country.capital));
  return cities;
}

export async function loadCities(country: Country): Promise<{ cities: City[]; fromDataset: boolean }> {
  const dataset = await fetchDataset(country.code);
  if (!dataset) return { cities: fallbackCities(country), fromDataset: false };
  const capital = country.capital;
  const cities = dataset.map((c) => (capital && c.name === capital ? { ...c, isCapital: true } : c));
  if (capital && !cities.some((c) => c.isCapital)) cities.unshift({ name: capital, population: 0, isCapital: true });
  return { cities, fromDataset: true };
}
