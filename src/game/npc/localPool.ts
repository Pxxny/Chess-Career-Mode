import { getCountry } from "@/data/world/countries";
import { generateFictionalNpcs } from "./fictional";
import { hashString } from "@/utils/format";
import { mixSeed } from "@/game/rng";
import type { Npc } from "@/types";
import { getSeedCities } from "@/data/world/seedCities";
/** Domestic competitors are seeded once per country/cohort, spread across real cities. */
export function localCompetitors(
  countryCode: string,
  _city: string,
  year: number,
): Npc[] {
  const c = getCountry(countryCode);
  if (!c) return [];
  const prefix = `domestic-${countryCode}-${year}-`;
  return generateFictionalNpcs({
    seed: mixSeed(hashString(prefix), 0x10ca1),
    startYear: year,
    fictionalCount: 100,
    countries: [
      {
        code: c.code,
        name: c.name,
        demonym: c.nationality,
        continent: c.continent,
        capital: c.capital,
      },
    ],
    seedCities: () =>
      getSeedCities(countryCode).length
        ? getSeedCities(countryCode)
        : [c.capital ?? c.name],
    eventsForYear: () => [],
  })
    .filter(
      (n) => n.careerStatus === "active" || n.careerStatus === "semi-retired",
    )
    .slice(0, 80)
    .map((n, i) => ({ ...n, id: `${prefix}${i + 1}`, tournamentHistory: [] }));
}
export function mergeNpcAdditions(
  existing: Npc[],
  candidates: Npc[],
): { npcs: Npc[]; added: Npc[] } {
  const ids = new Set(existing.map((n) => n.id));
  const added = candidates.filter((n) => !ids.has(n.id));
  return { npcs: added.length ? [...existing, ...added] : existing, added };
}
