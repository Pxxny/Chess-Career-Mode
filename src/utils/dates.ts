export function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

/** Converts a game date (year + week) into a UTC date. */
export function gameDateToDate(year: number, week: number): Date {
  return new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
}

/** Whole years between a date of birth and a game date. */
export function ageOn(dateOfBirth: string, year: number, week = 1): number {
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  const ref = gameDateToDate(year, week);
  let age = ref.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayThisYear = Date.UTC(ref.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate());
  if (ref.getTime() < birthdayThisYear) age -= 1;
  return Math.max(0, age);
}
