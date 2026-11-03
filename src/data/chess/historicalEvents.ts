import type { EventLevel } from './tournaments';

/** Real events with the years they ran. Used for the competitive calendar and NPC tournament histories. */
export interface HistoricalEvent {
  id: string;
  name: string;
  city: string;
  countryCode: string;
  fromYear: number;
  /** null = still running */
  toYear: number | null;
  level: EventLevel;
}

export const HISTORICAL_EVENTS: HistoricalEvent[] = [
  { id: 'olympiad', name: 'Chess Olympiad', city: 'Host city varies', countryCode: 'UN', fromYear: 1927, toYear: null, level: 'international' },
  { id: 'zonals', name: 'FIDE Zonal Tournaments', city: 'Host city varies', countryCode: 'UN', fromYear: 1947, toYear: null, level: 'national' },
  { id: 'world-championship', name: 'World Championship cycle', city: 'Host city varies', countryCode: 'UN', fromYear: 1948, toYear: null, level: 'elite' },
  { id: 'candidates', name: 'Candidates Tournament', city: 'Host city varies', countryCode: 'UN', fromYear: 1950, toYear: null, level: 'elite' },
  { id: 'hastings', name: 'Hastings Chess Congress', city: 'Hastings', countryCode: 'GB-ENG', fromYear: 1920, toYear: null, level: 'international' },
  { id: 'wijk', name: 'Wijk aan Zee Tournament', city: 'Wijk aan Zee', countryCode: 'NL', fromYear: 1938, toYear: null, level: 'elite' },
  { id: 'reggio-emilia', name: 'Reggio Emilia Tournament', city: 'Reggio Emilia', countryCode: 'IT', fromYear: 1958, toYear: null, level: 'international' },
  { id: 'capablanca-memorial', name: 'Capablanca Memorial', city: 'Havana', countryCode: 'CU', fromYear: 1962, toYear: null, level: 'international' },
  { id: 'biel', name: 'Biel Chess Festival', city: 'Biel', countryCode: 'CH', fromYear: 1968, toYear: null, level: 'international' },
  { id: 'dortmund', name: 'Dortmund Chess Meeting', city: 'Dortmund', countryCode: 'DE', fromYear: 1973, toYear: null, level: 'elite' },
  { id: 'tilburg', name: 'Tilburg Tournament', city: 'Tilburg', countryCode: 'NL', fromYear: 1977, toYear: 1996, level: 'elite' },
  { id: 'linares', name: 'Linares Tournament', city: 'Linares', countryCode: 'ES', fromYear: 1978, toYear: 2010, level: 'elite' },
  { id: 'world-cup', name: 'FIDE World Cup', city: 'Host city varies', countryCode: 'UN', fromYear: 2005, toYear: null, level: 'elite' },
  { id: 'tal-memorial', name: 'Tal Memorial', city: 'Moscow', countryCode: 'RU', fromYear: 2006, toYear: null, level: 'elite' },
  { id: 'norway-chess', name: 'Norway Chess', city: 'Stavanger', countryCode: 'NO', fromYear: 2013, toYear: null, level: 'elite' },
  { id: 'sinquefield', name: 'Sinquefield Cup', city: 'Saint Louis', countryCode: 'US', fromYear: 2013, toYear: null, level: 'elite' },
  { id: 'grand-chess-tour', name: 'Grand Chess Tour', city: 'Host city varies', countryCode: 'UN', fromYear: 2015, toYear: null, level: 'elite' },
];

export const getEventsForYear = (year: number): HistoricalEvent[] =>
  HISTORICAL_EVENTS.filter((e) => year >= e.fromYear && (e.toYear === null || year <= e.toYear));
