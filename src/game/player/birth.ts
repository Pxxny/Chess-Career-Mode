import { GAME_CONFIG } from '@/data/config';
import { ageOn } from '@/utils/dates';

export interface BirthDate {
  year: number;
  month: number;
  day: number;
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

const { startYear, player } = GAME_CONFIG;

/** Earliest and latest birth year the creator offers, whatever career start year is chosen. */
export const BIRTH_YEAR_MIN = startYear.min - player.maxStartAge;
export const BIRTH_YEAR_MAX = startYear.max - player.minStartAge;

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

export const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

export function isRealDate(b: BirthDate): boolean {
  if (![b.year, b.month, b.day].every(Number.isInteger)) return false;
  if (b.year < BIRTH_YEAR_MIN || b.year > BIRTH_YEAR_MAX || b.month < 1 || b.month > 12) return false;
  return b.day >= 1 && b.day <= daysInMonth(b.year, b.month);
}

export const toIsoDate = (b: BirthDate): string => `${pad(b.year, 4)}-${pad(b.month)}-${pad(b.day)}`;

export function parseIsoDate(iso: string): BirthDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const b = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  return isRealDate(b) ? b : null;
}

/** Born mid-year so a player is exactly `startingAge` on the first day of the career. */
export const defaultBirthDate = (careerStartYear: number): BirthDate => ({ year: careerStartYear - player.startingAge - 1, month: 6, day: 15 });

/** Whole years old on the first day of a career (week 1 of the start year). */
export const ageAtStart = (b: BirthDate, careerStartYear: number): number => ageOn(toIsoDate(b), careerStartYear, 1);

/** What is wrong with a birth date for this career start year, or null when it can be used. */
export function birthDateProblem(b: BirthDate, careerStartYear: number): string | null {
  if (!isRealDate(b)) return 'Choose a real date of birth.';
  const age = ageAtStart(b, careerStartYear);
  if (toIsoDate(b) > `${pad(careerStartYear, 4)}-01-01`) return `You would not be born yet in ${careerStartYear}. Choose an earlier birth date or a later start year.`;
  if (age < player.minStartAge) return `You would be ${age} when the career starts in ${careerStartYear}. The youngest allowed age is ${player.minStartAge}.`;
  if (age > player.maxStartAge) return `You would be ${age} when the career starts in ${careerStartYear}. The oldest allowed age is ${player.maxStartAge}.`;
  return null;
}

/** The birth date to use for a new player: the one chosen when it is valid, otherwise the default. */
export function resolveBirthDate(iso: string | undefined, careerStartYear: number): BirthDate {
  const parsed = iso ? parseIsoDate(iso) : null;
  return parsed && birthDateProblem(parsed, careerStartYear) === null ? parsed : defaultBirthDate(careerStartYear);
}
