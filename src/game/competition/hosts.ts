import { teamSpec } from "@/data/chess/nationalTeamEvents";
import type { EventDetails } from "./types";

interface Venue {
  location: string;
  country: string;
}
const venues = (...pairs: [string, string][]): Venue[] =>
  pairs.map(([country, location]) => ({ country, location }));
const world = venues(
  ["HU", "Budapest"],
  ["IN", "Chennai"],
  ["GE", "Tbilisi"],
  ["AZ", "Baku"],
);
const europe = venues(
  ["RS", "Belgrade"],
  ["PL", "Warsaw"],
  ["GR", "Athens"],
  ["DE", "Berlin"],
);
const asia = venues(
  ["IN", "New Delhi"],
  ["CN", "Hangzhou"],
  ["KZ", "Astana"],
  ["UZ", "Tashkent"],
);
const pools: Record<string, Venue[]> = {
  olympiad: world,
  "women-olympiad": world,
  "world-team": world,
  "women-world-team": world,
  "online-olympiad": venues(["", "Online"]),
  "disability-olympiad": world,
  "youth-u16-olympiad": world,
  "senior-team": world,
  "european-team": europe,
  "european-women-team": europe,
  "european-youth-team": europe,
  "asian-nations-cup": asia,
  "asian-games": asia,
  aimag: asia,
  "pan-american-team": venues(
    ["AR", "Buenos Aires"],
    ["BR", "Sao Paulo"],
    ["CU", "Havana"],
    ["MX", "Mexico City"],
  ),
  "sea-games": venues(
    ["TH", "Bangkok"],
    ["VN", "Hanoi"],
    ["KH", "Phnom Penh"],
    ["MY", "Kuala Lumpur"],
  ),
  "african-games": venues(
    ["GH", "Accra"],
    ["MA", "Rabat"],
    ["EG", "Cairo"],
    ["DZ", "Algiers"],
  ),
  "mitropa-cup": venues(
    ["CZ", "Prague"],
    ["AT", "Vienna"],
    ["IT", "Rome"],
    ["DE", "Berlin"],
  ),
  "arab-team": venues(
    ["EG", "Cairo"],
    ["TN", "Tunis"],
    ["AE", "Abu Dhabi"],
    ["MA", "Rabat"],
  ),
  "ibero-american-team": venues(
    ["ES", "Madrid"],
    ["PT", "Lisbon"],
    ["AR", "Buenos Aires"],
    ["BR", "Sao Paulo"],
  ),
};
/** Career-calendar host rotation, not a claim about real historical hosting. Independent of the player. */
export function teamHost(
  key: string,
  year: number,
): Venue & { online: boolean } {
  if (!teamSpec(key) || !pools[key])
    throw new Error(`Unknown team event ${key}`);
  const pool = pools[key];
  return {
    ...pool[((year % pool.length) + pool.length) % pool.length],
    online: key === "online-olympiad",
  };
}
/** Repair only older team bookings without host metadata. Keep their field, dates and fees intact. */
export function withTeamHost<T extends EventDetails | undefined>(
  details: T,
  year: number,
): T {
  if (!details?.teamEvent || details.host || !teamSpec(details.teamEvent.key))
    return details;
  const host = teamHost(details.teamEvent.key, year);
  return {
    ...details,
    location: host.location,
    country: host.country,
    host: { mode: host.online ? "online" : "rotation" },
    ...(host.online ? { travelCost: 0 } : {}),
  } as T;
}
