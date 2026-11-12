import type { HistoricalEvent } from '@/data/chess/historicalEvents';

export interface GenCountry {
  code: string;
  name: string;
  demonym: string;
  continent: string;
  capital: string | null;
}

export interface WorldGenContext {
  onProgress?: (generated:number,total:number) => void;
  /** Already mixed with the start year */
  seed: number;
  startYear: number;
  fictionalCount: number;
  countries: GenCountry[];
  seedCities: (countryCode: string) => string[];
  /** Real events that ran in a given year (used in tournament histories) */
  eventsForYear: (year: number) => HistoricalEvent[];
}
