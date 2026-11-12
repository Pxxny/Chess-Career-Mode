import {
  databaseChoice,
  type PlayerDatabaseSize,
} from "@/game/npc/playerDatabase";
import { FIDE_SNAPSHOT_YEAR, FIDE_PLAYER_COUNT } from "@/game/npc/fidePlayers";
const KEY = "chess-career-creation-times-v1";
const key = (size: PlayerDatabaseSize, year: number) =>
  size === "real" && year !== FIDE_SNAPSHOT_YEAR ? "real-historical" : size;
export function initialPlayerCount(size: PlayerDatabaseSize, year: number) {
  return size === "real"
    ? year === FIDE_SNAPSHOT_YEAR
      ? FIDE_PLAYER_COUNT
      : 82
    : databaseChoice(size).fictionalCount + 162;
}
export function creationEstimate(size: PlayerDatabaseSize, year: number) {
  const fallback =
    size === "real"
      ? year === FIDE_SNAPSHOT_YEAR
        ? [15, 120]
        : [1, 8]
      : databaseChoice(size).estimate;
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}"),
      samples: unknown = all[key(size, year)];
    if (Array.isArray(samples)) {
      const valid = samples.filter(
        (v): v is number =>
          typeof v === "number" && Number.isFinite(v) && v > 0 && v < 3600000,
      );
      if (valid.length) {
        const seconds = valid.reduce((a, b) => a + b, 0) / valid.length / 1000;
        return {
          lower: Math.max(1, Math.floor(seconds * 0.65)),
          upper: Math.max(2, Math.ceil(seconds * 1.8)),
          learned: true,
        };
      }
    }
  } catch {
    /* The estimate must never prevent character creation. */
  }
  return { lower: fallback[0], upper: fallback[1], learned: false };
}
export function rememberCreationTime(
  size: PlayerDatabaseSize,
  year: number,
  ms: number,
) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}"),
      k = key(size, year);
    all[k] = [...(Array.isArray(all[k]) ? all[k] : []), ms].slice(-5);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* Optional device-local timing history. */
  }
}
