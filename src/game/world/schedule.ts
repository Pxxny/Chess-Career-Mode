import { careerEvents } from "@/game/competition/catalog";
import type { EventDetails } from "@/game/competition/types";
import {
  EVENT_FIELD_SIZE,
  EVENT_PATTERNS,
  type EventLevel,
} from "@/data/chess/tournaments";
import type { GameStamp } from "@/types";
import { hashString } from "@/utils/format";
import { weeksBetween } from "../history/createHistory";

export interface Region {
  city: string;
  countryCode: string;
  demonym: string;
  continent: string;
}

export interface ScheduledEvent extends GameStamp {
  details?: EventDetails;
  id: string;
  name: string;
  level: EventLevel;
  fieldSize: number;
  entryFee: number;
  minElo: number;
  minReputation: number;
  /** Last week (inclusive) registration is open */
  registrationDeadline: GameStamp;
  weeksUntilStart: number;
  weeksUntilDeadline: number;
  /** Invitation-only levels only appear when the player qualifies */
  invitational: boolean;
}

const LEVEL_RULES: Record<
  EventLevel,
  {
    every: number;
    fee: number;
    minElo: number;
    minReputation: number;
    deadlineWeeks: number;
  }
> = {
  local: { every: 4, fee: 15, minElo: 0, minReputation: 0, deadlineWeeks: 1 },
  national: {
    every: 9,
    fee: 60,
    minElo: 1400,
    minReputation: 5,
    deadlineWeeks: 2,
  },
  international: {
    every: 13,
    fee: 180,
    minElo: 1900,
    minReputation: 30,
    deadlineWeeks: 3,
  },
  elite: {
    every: 26,
    fee: 400,
    minElo: 2400,
    minReputation: 80,
    deadlineWeeks: 4,
  },
};

function normalize(year: number, week: number): GameStamp {
  const total = year * 52 + (week - 1);
  return { year: Math.floor(total / 52), week: (total % 52) + 1 };
}

function fill(pattern: string, region: Region): string {
  return pattern
    .replace("{city}", region.city)
    .replace("{demonym}", region.demonym)
    .replace("{continent}", region.continent);
}

/** Events starting within the next `horizon` weeks, soonest first. Deterministic for a given date, career and region. */
export function getSchedule(
  now: GameStamp,
  region: Region,
  careerId: string,
  horizon = 26,
): ScheduledEvent[] {
  const events: ScheduledEvent[] = [];
  const start = now.year * 52 + (now.week - 1);
  const levels = Object.keys(LEVEL_RULES) as EventLevel[];

  for (const level of levels) {
    const rule = LEVEL_RULES[level];
    const offset = hashString(`${careerId}:${level}`) % rule.every;
    // Every `every` weeks, starting at the level's offset.
    const first =
      start +
      1 +
      ((((offset - (start + 1)) % rule.every) + rule.every) % rule.every);
    for (let abs = first; abs <= start + horizon; abs += rule.every) {
      const when = normalize(Math.floor(abs / 52), (abs % 52) + 1);
      const seed = hashString(`${careerId}:${level}:${abs}`);
      let name: string;
      name = fill(
        EVENT_PATTERNS[level][seed % EVENT_PATTERNS[level].length],
        region,
      ).replace(/Junior/g, "Community");
      const [minField, maxField] = EVENT_FIELD_SIZE[level];
      const deadline = normalize(when.year, when.week - rule.deadlineWeeks);
      events.push({
        id: `${level}-${when.year}-${when.week}`,
        ...when,
        name,
        level,
        fieldSize: minField + (seed % (maxField - minField + 1)),
        entryFee: rule.fee,
        minElo: rule.minElo,
        minReputation: rule.minReputation,
        registrationDeadline: deadline,
        weeksUntilStart: weeksBetween(now, when),
        weeksUntilDeadline: weeksBetween(now, deadline),
        details: {
          category: "Open Tournaments",
          location: region.city,
          country: region.countryCode,
          end: when,
          format: "swiss",
          rounds: level === "local" ? 5 : 7,
          timeControl: /blitz/i.test(name)
            ? {
                id: "open-blitz",
                label: "3+2",
                base: 180,
                increment: 2,
                category: "blitz",
              }
            : /rapid/i.test(name)
              ? {
                  id: "open-rapid",
                  label: "15+10",
                  base: 900,
                  increment: 10,
                  category: "rapid",
                }
              : {
                  id: "open-classical",
                  label: "30+10",
                  base: 1800,
                  increment: 10,
                  category: "classical",
                },
          prize: rule.fee * (minField + (seed % (maxField - minField + 1))),
          prestige: level === "local" ? 10 : 30,
          provenance: "fictional",
        },
        invitational: level === "international" || level === "elite",
      });
    }
  }
  return [...events, ...careerEvents(now, region, horizon)].sort(
    (a, b) =>
      a.weeksUntilStart - b.weeksUntilStart || a.name.localeCompare(b.name),
  );
}

export const isEligible = (
  event: ScheduledEvent,
  rating: number,
  reputation: number,
): boolean => rating >= event.minElo && reputation >= event.minReputation;
export const registrationOpen = (event: ScheduledEvent): boolean =>
  event.weeksUntilDeadline >= 0;
