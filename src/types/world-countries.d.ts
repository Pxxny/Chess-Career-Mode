declare module 'world-countries' {
  export interface RawCountry {
    cca2: string;
    cca3: string;
    name: { common: string; official: string };
    demonyms?: Record<string, { f: string; m: string }>;
    region: string;
    subregion: string;
    flag: string;
    capital: string[];
    independent?: boolean;
    status?: string;
    altSpellings?: string[];
  }
  const countries: RawCountry[];
  export default countries;
}
