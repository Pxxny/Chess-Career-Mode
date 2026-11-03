/** Relative size of each country's competitive chess scene. Unlisted countries use the default. */
export const DEFAULT_COUNTRY_WEIGHT = 0.25;

export const COUNTRY_WEIGHTS: Record<string, number> = {
  RU: 10, IN: 9, US: 8, CN: 8, DE: 5, FR: 5, UA: 5, ES: 4, PL: 4, NL: 3, 'GB-ENG': 3, IT: 3, HU: 3,
  AM: 3, IR: 3, BR: 3, AR: 3, RO: 3, AZ: 2.5, TR: 2.5, CZ: 2.5, IL: 2.5, CU: 2, NO: 2, SE: 2, RS: 2,
  GR: 2, UZ: 2, GE: 2, BY: 2, PH: 2, VN: 2, ID: 2, MX: 2, CA: 2, DK: 1.5, KZ: 1.5, BG: 1.5, HR: 1.5,
  AT: 1.5, CH: 1.5, EG: 1.5, CO: 1.5, PE: 1.5, CL: 1.5, AU: 1.5, JP: 1.5, SK: 1.5, PT: 1.5, BE: 1.5,
  SI: 1.2, FI: 1, KR: 1, TW: 1, MN: 1, LT: 1, LV: 1, EE: 1, BA: 1, MD: 1, ZA: 1, NG: 1, 'GB-SCO': 0.8,
  'GB-WLS': 0.5, IE: 0.8, IS: 0.8, SG: 0.8, MA: 0.8, DZ: 0.8, TN: 0.8, KE: 0.5,
};

const SOVIET = new Set(['RU', 'UA', 'BY', 'GE', 'AM', 'AZ', 'LV', 'LT', 'EE', 'UZ', 'KZ', 'KG', 'TM', 'TJ', 'MD']);
const EMERGING = new Set(['IN', 'CN', 'VN', 'PH', 'ID', 'IR', 'TR', 'EG', 'BR', 'MX', 'SG', 'MY', 'KR', 'MN', 'PK', 'BD', 'NG', 'ZA', 'KE', 'MA', 'DZ', 'TN']);

/** Chess power shifts over time: Soviet dominance before 1992, Asian growth after 1970. */
export function eraMultiplier(code: string, year: number): number {
  if (SOVIET.has(code) && year < 1992) return 1.8;
  if (EMERGING.has(code)) return 0.2 + 0.8 * Math.min(1, Math.max(0, (year - 1950) / 60));
  return 1;
}
