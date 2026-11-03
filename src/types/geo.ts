export type Continent =
  | 'Africa'
  | 'Antarctica'
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'Oceania'
  | 'South America';

export interface Federation {
  /** FIDE federation code, e.g. "GER" */
  code: string;
  name: string;
}

export interface Country {
  /** ISO 3166-1 alpha-2, or a "GB-ENG" style code for additional FIDE federations */
  code: string;
  code3: string;
  name: string;
  officialName: string;
  /** Demonym, e.g. "German" */
  nationality: string;
  /** Flag emoji */
  flag: string;
  continent: Continent;
  subregion: string;
  capital: string | null;
  federation: Federation;
  /** Alternative spellings used by search */
  aliases: string[];
  status: 'sovereign' | 'territory' | 'additional';
}

export interface City {
  name: string;
  /** 0 when unknown */
  population: number;
  isCapital?: boolean;
}

export interface PlayerCity {
  name: string;
  /** True when the player typed a city that is not in the database */
  custom: boolean;
}
