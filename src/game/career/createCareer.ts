import { GAME_CONFIG } from "@/data/config";
import type { CareerRecord, NewCareerOptions } from "@/types";
import { validDatabaseSize } from "@/game/npc/playerDatabase";

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `career-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

export const clampStartYear = (year: number): number =>
  Math.min(
    GAME_CONFIG.startYear.max,
    Math.max(
      GAME_CONFIG.startYear.min,
      Math.round(year) || GAME_CONFIG.startYear.default,
    ),
  );

/**
 * The permanent record linking a player to a country, a city, a historical
 * period and the NPC database built for that period.
 */
export function createCareerRecord(options: NewCareerOptions): CareerRecord {
  const id = newId();
  const startYear = clampStartYear(options.startYear);
  return {
    ...(validDatabaseSize(options.playerDatabase)
      ? { playerDatabase: options.playerDatabase }
      : {}),
    id,
    startYear,
    countryCode: options.countryCode,
    city: { ...options.city },
    createdAt: Date.now(),
    databaseKey: `${GAME_CONFIG.world.seed}:${startYear}:${id}`,
  };
}
