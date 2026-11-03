import { getEventsForYear } from '@/data/chess/historicalEvents';
import { GAME_CONFIG } from '@/data/config';
import { COUNTRIES } from '@/data/world/countries';
import { getSeedCities } from '@/data/world/seedCities';
import type { Npc } from '@/types';
import { mixSeed } from '../rng';
import { buildNpcDatabase } from './database';

/** Builds the persistent NPC world for a start year. The same year always yields the same NPCs and IDs. */
export function buildWorldNpcs(startYear: number): Npc[] {
  return buildNpcDatabase({
    seed: mixSeed(GAME_CONFIG.world.seed, startYear),
    startYear,
    fictionalCount: GAME_CONFIG.world.fictionalNpcCount,
    seedCities: getSeedCities,
    eventsForYear: getEventsForYear,
    countries: COUNTRIES.filter((c) => c.continent !== 'Antarctica').map((c) => ({
      code: c.code,
      name: c.name,
      demonym: c.nationality,
      continent: c.continent,
      capital: c.capital,
    })),
  });
}
