import { getSeedCities } from "@/data/world/seedCities";
import type { City, Country } from "@/types";
import { logWarn } from "@/utils/log";
import { beginMeasurement } from "@/diagnostics/performance";

const cache = new Map<string, City[] | null>();

/** Keeps only well-formed [name, population] rows so one bad row can never crash rendering. */
function sanitizeRows(rows: unknown[]): City[] {
  const cities: City[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const [name, population] = row as [unknown, unknown];
    if (typeof name !== "string" || !name.trim()) continue;
    cities.push({
      name,
      population:
        typeof population === "number" &&
        Number.isFinite(population) &&
        population > 0
          ? population
          : 0,
    });
  }
  return cities;
}

/** Per-country files are produced by scripts/build-world-data.mjs as [name, population][]. */
async function fetchDataset(code: string): Promise<City[] | null> {
  if (cache.has(code)) return cache.get(code) ?? null;
  const downloaded = beginMeasurement("city.download");
  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}data/cities/${code}.json`,
    );
    if (!response.ok) throw new Error(String(response.status));
    const text = await response.text();
    downloaded({ country: code, status: "ok" });
    const parsed = beginMeasurement("city.parse");
    const rows: unknown = JSON.parse(text); // a missing file returns index.html, which fails here
    if (!Array.isArray(rows)) throw new Error("unexpected city file");
    const cities = sanitizeRows(rows);
    if (cities.length === 0) throw new Error("city file has no valid rows");
    parsed({ country: code, items: cities.length });
    cache.set(code, cities);
    return cities;
  } catch (error) {
    downloaded({ country: code, status: "error" });
    logWarn(
      "cities",
      `no city dataset for "${code}", using fallback`,
      error instanceof Error ? error.message : error,
    );
    cache.set(code, null);
    return null;
  }
}

/** Offline fallback: curated major cities plus the capital. */
export function fallbackCities(country: Country | null | undefined): City[] {
  if (!country) return [];
  const names = new Set<string>();
  const cities: City[] = [];
  const add = (name: string, isCapital = false) => {
    if (names.has(name)) return;
    names.add(name);
    cities.push({ name, population: 0, isCapital });
  };
  if (country.capital) add(country.capital, true);
  getSeedCities(country.code).forEach((name) =>
    add(name, name === country.capital),
  );
  return cities;
}

export async function loadCities(
  country: Country,
): Promise<{ cities: City[]; fromDataset: boolean }> {
  if (!country?.code) return { cities: [], fromDataset: false };
  const ready = beginMeasurement("city.load");
  const cached = cache.has(country.code);
  const dataset = await fetchDataset(country.code);
  if (!dataset) {
    const cities = fallbackCities(country);
    ready({
      country: country.code,
      source: cached ? "cached-fallback" : "fallback",
      items: cities.length,
    });
    return { cities, fromDataset: false };
  }
  const capital = country.capital;
  const cities = dataset.map((c) =>
    capital && c.name === capital ? { ...c, isCapital: true } : c,
  );
  if (capital && !cities.some((c) => c.isCapital))
    cities.unshift({ name: capital, population: 0, isCapital: true });
  ready({
    country: country.code,
    source: cached ? "memory" : "file",
    items: cities.length,
  });
  return { cities, fromDataset: true };
}
