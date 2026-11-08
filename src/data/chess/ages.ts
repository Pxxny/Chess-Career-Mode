/**
 * Highest rating a young player can realistically have at each age. The curve follows the best prodigies
 * in chess history, so a child can be very strong but a nine-year-old is never a grandmaster.
 */
const AGE_ELO_CAPS: ReadonlyArray<readonly [age: number, cap: number]> = [
  [8, 1700],
  [9, 1900],
  [10, 2100],
  [11, 2250],
  [12, 2400],
  [13, 2500],
  [14, 2600],
  [15, 2680],
  [16, 2740],
  [17, 2790],
];

export const ADULT_AGE = 18;
export const YOUNGEST_NPC_AGE = AGE_ELO_CAPS[0][0];

/** The rating ceiling at an age. Adults have none. */
export function eloCapForAge(age: number): number {
  if (age >= ADULT_AGE) return Number.POSITIVE_INFINITY;
  let cap: number = AGE_ELO_CAPS[0][1];
  for (const [from, limit] of AGE_ELO_CAPS) if (age >= from) cap = limit;
  return cap;
}

/** The youngest age at which a rating is realistic. */
export function minAgeForElo(elo: number): number {
  for (const [age, cap] of AGE_ELO_CAPS) if (cap >= elo) return age;
  return ADULT_AGE;
}
