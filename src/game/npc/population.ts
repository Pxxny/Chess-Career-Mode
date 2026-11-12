import { upgradeNpcIdentities } from "./identity";
import { GAME_CONFIG } from "@/data/config";
import { COUNTRIES } from "@/data/world/countries";
import { getSeedCities } from "@/data/world/seedCities";
import { getEventsForYear } from "@/data/chess/historicalEvents";
import { createRng, mixSeed } from "@/game/rng";
import { tierForElo, titleForPeak } from "@/data/chess/tiers";
import { generateFictionalNpcs } from "./fictional";
import type { Npc } from "@/types";
export const RETIREMENT_AGE = 65;
export function recruitForYear(
  year: number,
  baseCount: number = GAME_CONFIG.world.fictionalNpcCount,
): Npc[] {
  const seed = mixSeed(GAME_CONFIG.world.seed, year ^ 0xa771),
    rng = createRng(seed),
    count = Math.max(
      1,
      Math.round(
        (rng.int(100, 250) * baseCount) / GAME_CONFIG.world.fictionalNpcCount,
      ),
    );
  const generated = generateFictionalNpcs({
    seed,
    startYear: year,
    fictionalCount: count,
    seedCities: getSeedCities,
    eventsForYear: getEventsForYear,
    countries: COUNTRIES.filter((c) => c.continent !== "Antarctica").map(
      (c) => ({
        code: c.code,
        name: c.name,
        demonym: c.nationality,
        continent: c.continent,
        capital: c.capital,
      }),
    ),
  });
  return generated.map((n, i) => {
    const age = rng.int(18, 35),
      elo = Math.min(2200, n.currentElo),
      tier = tierForElo(elo);
    return {
      ...n,
      id: `recruit-${year}-${i + 1}`,
      age,
      dateOfBirth: `${year - age - 1}-06-15`,
      careerStartYear: year,
      careerStatus: "active",
      currentElo: elo,
      peakElo: elo,
      league: tier,
      tier,
      title: titleForPeak(elo),
      worldRank: null,
      tournamentHistory: [],
      potentialRating: Math.max(elo, n.potentialRating),
    };
  });
}
export function advancePopulation(
  npcs: Npc[],
  startYear: number,
  year: number,
  baseCount: number = GAME_CONFIG.world.fictionalNpcCount,
): Npc[] {
  if (
    !Number.isInteger(startYear) ||
    startYear < 1950 ||
    !Number.isInteger(year) ||
    year <= startYear ||
    year > 9999
  )
    return npcs;
  const existing = new Set(npcs.map((n) => n.id)),
    added: Npc[] = [];
  for (let y = startYear + 1; y <= year; y++) {
    if (existing.has(`recruit-${y}-1`)) continue;
    added.push(...recruitForYear(y, baseCount));
  }
  return added.length ? upgradeNpcIdentities([...npcs, ...added]) : npcs;
}
