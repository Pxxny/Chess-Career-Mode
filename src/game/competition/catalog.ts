import type { EventLevel } from "@/data/chess/tournaments";
import type { EventDetails } from "./types";
import type { Region, ScheduledEvent } from "@/game/world/schedule";
import type { GameStamp } from "@/types";
import { TEAM_EVENTS, resolveTeamEvent } from "@/data/chess/nationalTeamEvents";
export const stampIndex = (d: GameStamp): number => d.year * 52 + d.week - 1;
export const stampFromIndex = (i: number): GameStamp => ({
  year: Math.floor(i / 52),
  week: (((i % 52) + 52) % 52) + 1,
});
/** A 52-week career calendar, not a reconstruction of real historical schedules. */
export const dateLabel = (d: GameStamp): string => {
  const date = new Date(Date.UTC(d.year, 0, 1 + (d.week - 1) * 7));
  return `${date.toISOString().slice(0, 10)} (W${d.week})`;
};
const tc = (
  minutes: number,
  increment: number,
  category: "classical" | "rapid" | "blitz",
) => ({
  id: `event-${minutes}-${increment}`,
  label: `${minutes}+${increment}`,
  base: minutes * 60,
  increment,
  category,
});
interface Template {
  key: string;
  name: string;
  week: number;
  deadline: number;
  level: EventLevel;
  count: number;
  fee: number;
  elo: number;
  rep: number;
  details: Omit<EventDetails, "end" | "location" | "country">;
}
const classical = tc(90, 30, "classical");
/** National team competitions come from the data catalog; each edition resolves its own team count and boards. */
const teamTemplates = (year: number): Template[] =>
  TEAM_EVENTS.map((spec) => {
    const info = resolveTeamEvent(spec, year);
    return {
      key: spec.key,
      name: spec.name,
      week: spec.week,
      deadline: spec.deadline,
      level: "international",
      count: info.teams,
      fee: 0,
      elo: spec.minElo,
      rep: spec.minReputation,
      details: {
        category: spec.category,
        format: "team",
        rounds: info.teams <= 12 ? info.teams - 1 : spec.rounds,
        timeControl: spec.timeControl === "rapid" ? tc(15, 10, "rapid") : classical,
        prize: spec.prize,
        prestige: spec.prestige,
        provenance: "inspired",
        federation: true,
        teamEvent: info,
      },
    };
  });
const templates: Template[] = [
  {
    key: "national",
    name: "National Championship",
    week: 12,
    deadline: 3,
    level: "national",
    count: 24,
    fee: 60,
    elo: 1400,
    rep: 5,
    details: {
      category: "National Championships",
      format: "swiss",
      rounds: 7,
      timeControl: classical,
      prize: 3000,
      prestige: 35,
      provenance: "inspired",
      federation: true,
    },
  },
  {
    key: "continental",
    name: "Continental Championship",
    week: 16,
    deadline: 4,
    level: "international",
    count: 32,
    fee: 150,
    elo: 1900,
    rep: 20,
    details: {
      category: "Continental Championships",
      format: "swiss",
      rounds: 9,
      timeControl: classical,
      prize: 20000,
      prestige: 55,
      provenance: "inspired",
      qualification: "continental",
    },
  },
  {
    key: "world-cup",
    name: "World Cup",
    week: 20,
    deadline: 5,
    level: "elite",
    count: 32,
    fee: 250,
    elo: 2200,
    rep: 30,
    details: {
      category: "World Cup",
      format: "knockout",
      rounds: 5,
      timeControl: classical,
      prize: 150000,
      prestige: 85,
      provenance: "inspired",
      qualification: "world-cup",
    },
  },
  {
    key: "invitational",
    name: "Aurora Invitational",
    week: 26,
    deadline: 4,
    level: "international",
    count: 10,
    fee: 100,
    elo: 2100,
    rep: 35,
    details: {
      category: "Invitational Tournaments",
      format: "round-robin",
      rounds: 9,
      timeControl: classical,
      prize: 15000,
      prestige: 50,
      provenance: "fictional",
      minimumTitle: "FM",
    },
  },
  {
    key: "candidates",
    name: "Candidates Tournament",
    week: 30,
    deadline: 6,
    level: "elite",
    count: 8,
    fee: 0,
    elo: 2500,
    rep: 60,
    details: {
      category: "Candidates Tournament",
      format: "double-round-robin",
      rounds: 14,
      timeControl: classical,
      prize: 250000,
      prestige: 95,
      provenance: "inspired",
      minimumTitle: "GM",
      qualification: "candidates",
    },
  },
  {
    key: "grand-swiss",
    name: "Grand Swiss",
    week: 36,
    deadline: 4,
    level: "elite",
    count: 48,
    fee: 200,
    elo: 2200,
    rep: 30,
    details: {
      category: "Grand Swiss",
      format: "swiss",
      rounds: 11,
      timeControl: classical,
      prize: 100000,
      prestige: 80,
      provenance: "inspired",
      qualification: "grand-swiss",
    },
  },
  {
    key: "super",
    name: "Meridian Masters",
    week: 40,
    deadline: 6,
    level: "elite",
    count: 10,
    fee: 0,
    elo: 2600,
    rep: 70,
    details: {
      category: "Classical Super Tournaments",
      format: "round-robin",
      rounds: 9,
      timeControl: classical,
      prize: 180000,
      prestige: 90,
      provenance: "fictional",
      minimumTitle: "GM",
      minimumLeague: "elite-grandmaster",
      qualification: "super-invitation",
    },
  },
  {
    key: "world-championship",
    name: "World Chess Championship",
    week: 44,
    deadline: 8,
    level: "elite",
    count: 2,
    fee: 0,
    elo: 2500,
    rep: 60,
    details: {
      category: "World Chess Championship",
      format: "match",
      rounds: 14,
      timeControl: classical,
      prize: 1000000,
      prestige: 100,
      provenance: "inspired",
      minimumTitle: "GM",
      qualification: "world-championship",
    },
  },
  {
    key: "rapid",
    name: "World Rapid Championship",
    week: 48,
    deadline: 3,
    level: "international",
    count: 40,
    fee: 120,
    elo: 1800,
    rep: 15,
    details: {
      category: "Rapid Championships",
      format: "swiss",
      rounds: 9,
      timeControl: tc(15, 10, "rapid"),
      prize: 40000,
      prestige: 65,
      provenance: "inspired",
    },
  },
  {
    key: "blitz",
    name: "World Blitz Championship",
    week: 50,
    deadline: 2,
    level: "international",
    count: 40,
    fee: 100,
    elo: 1800,
    rep: 15,
    details: {
      category: "Blitz Championships",
      format: "swiss",
      rounds: 11,
      timeControl: tc(3, 2, "blitz"),
      prize: 30000,
      prestige: 60,
      provenance: "inspired",
    },
  },
];
export function careerEvents(
  now: GameStamp,
  region: Region,
  horizon: number,
): ScheduledEvent[] {
  const out: ScheduledEvent[] = [];
  for (
    let year = now.year;
    year <= stampFromIndex(stampIndex(now) + horizon).year;
    year++
  ) {
    for (const t of [...templates, ...teamTemplates(year)]) {
      const verified = year === 2024 && t.key === "candidates";
      const start = { year, week: verified ? 14 : t.week };
      const gap = stampIndex(start) - stampIndex(now);
      if (gap < 0 || gap > horizon) continue;
      let end = stampFromIndex(
        stampIndex(start) +
          (t.details.format === "match" ||
          t.details.format === "double-round-robin"
            ? 2
            : 1),
      );
      if (verified) end = { year: 2024, week: 17 };
      const details: EventDetails = {
        ...t.details,
        end,
        location: region.city,
        country: region.countryCode,
        ...(verified
          ? {
              location: "Toronto",
              country: "CA",
              historicalSchedule: {
                startDate: "2024-04-03",
                endDate: "2024-04-23",
                source: HISTORICAL_REFERENCE.url,
              },
            }
          : {}),
        ...(t.key === "national" ? { nationality: region.countryCode } : {}),
      };
      out.push({
        id: `career-${t.key}-${year}`,
        name: `${t.name} ${year}`,
        level: t.level,
        ...start,
        fieldSize: t.count,
        entryFee: t.fee,
        minElo: t.elo,
        minReputation: t.rep,
        registrationDeadline: stampFromIndex(stampIndex(start) - t.deadline),
        weeksUntilStart: gap,
        weeksUntilDeadline: gap - t.deadline,
        invitational: !!(details.minimumTitle || details.qualification),
        details,
      });
    }
  }
  return out;
}
export const HISTORICAL_REFERENCE = {
  name: "FIDE Candidates 2024",
  location: "Toronto, Canada",
  start: "2024-04-03",
  end: "2024-04-23",
  format: "8 players, double round-robin, 14 rounds",
  url: "https://www.fide.com/fide-publishes-regulations-for-2024-candidates-tournaments/",
};
