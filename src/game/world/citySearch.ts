import type { City } from "@/types";
import { normalizeText } from "@/utils/text";

/** Largest cities first; capitals always included. */
export function getMajorCities(cities: City[], limit = Infinity): City[] {
  const sorted = [...cities].sort(
    (a, b) => (b.population || 0) - (a.population || 0),
  );
  const top = sorted.slice(0, limit);
  const capital = cities.find((c) => c.isCapital);
  if (capital && !top.includes(capital)) top.unshift(capital);
  return top;
}

export function searchCities(
  cities: City[],
  query: string,
  limit = Infinity,
): City[] {
  const q = normalizeText(query);
  if (!q) return getMajorCities(cities, limit);
  const starts: City[] = [];
  const contains: City[] = [];
  for (const city of cities) {
    const n = normalizeText(city.name ?? "");
    if (n.startsWith(q)) starts.push(city);
    else if (n.includes(q)) contains.push(city);
    if (starts.length >= limit) break;
  }
  const byPopulation = (a: City, b: City) =>
    (b.population || 0) - (a.population || 0);
  return [...starts.sort(byPopulation), ...contains.sort(byPopulation)].slice(
    0,
    limit,
  );
}

export function hasExactCity(cities: City[], query: string): boolean {
  const q = normalizeText(query);
  return cities.some((c) => normalizeText(c.name ?? "") === q);
}
