import type { ActiveTournament, TournamentPairing } from "@/types";
import type { ScheduledEvent } from "@/game/world/schedule";
import { hashString } from "@/utils/format";
import { dayStamp } from "./agenda";

const hosts = [["EE", "Tallinn"], ["FI", "Helsinki"], ["CZ", "Prague"], ["NL", "Amsterdam"], ["ES", "Madrid"], ["DE", "Berlin"]];
const groupRounds = 24;
export const KERES_FORMAT = "Single elimination to 32 · 8 groups of 4 · top 2 per group to the round of 16 · best-of-7 final";
export const KERES_GROUP_RULES = "8 games against each group opponent (24 per player). Ties use game wins, then entry Elo.";

export function keresEvents(year: number): ScheduledEvent[] {
  const prize = 150_000 + (hashString(`fide-keres-fund:${year}`) % 31) * 5_000;
  const { rounds } = keresStructure(1024);
  return [13, 36].map((week, edition) => {
    const [country, location] = hosts[(((year - 2026) * 2 + edition) % hosts.length + hosts.length) % hosts.length];
    return {
      id: `paul-keres-${year}-${edition + 1}`, name: `Paul Keres Cup · ${edition === 0 ? "Spring" : "Autumn"} ${year}`,
      year, week, level: "international", fieldSize: 1024, entryFee: 0, minElo: 0, minReputation: 0,
      registrationDeadline: { year, week: week - 1 }, weeksUntilStart: 0, weeksUntilDeadline: 0, invitational: false,
      details: {
        keres: true, category: "Paul Keres Cup", country, location,
        end: dayStamp(year * 364 + (week - 1) * 7 + rounds - 1), format: "knockout", rounds,
        timeControl: { id: "keres-classical", label: "3 h · +30 s after move 50", base: 10800, increment: 30, incrementFromMove: 51, category: "classical" },
        prize, prestige: 94, provenance: "fictional", host: { mode: "rotation" },
        organizer: { name: "FIDE", status: "Official", simulated: true },
        agenda: { days: rounds, startDay: 1, startMinute: 540, slotMinutes: 390, exactStart: true },
      },
    };
  });
}

export function keresStructure(field: number) {
  const bracket = 2 ** Math.ceil(Math.log2(Math.max(1, field)));
  const groupField = Math.min(32, 2 ** Math.floor(Math.log2(Math.max(1, field))));
  const groups = groupField >= 4 ? groupField / 4 : 0;
  const prelim = groups ? Math.log2(bracket / groupField) : 0;
  const playoffs = Math.max(0, Math.log2(groups ? groups * 2 : bracket) - 1);
  return { groups, prelim, groupEnd: prelim + (groups ? groupRounds : 0), rounds: prelim + (groups ? groupRounds : 0) + playoffs + 7 };
}

export function keresStage(t: ActiveTournament) {
  const { prelim, groupEnd, rounds } = keresStructure(t.players.length);
  return t.round <= prelim ? "Qualifying knockout" : t.round <= groupEnd ? "Group stage" : t.round <= rounds - 7 ? "Playoffs" : "Final · Best of 7";
}

export function keresGroupPairs(groups: string[][], game: number): TournamentPairing[] {
  const opponent = [[1, 0, 3, 2], [2, 3, 0, 1], [3, 2, 1, 0]][Math.floor(game / 8)];
  return groups.flatMap(group => group.flatMap((id, index) => {
    const other = opponent[index];
    if (index > other) return [];
    return [{ white: game % 2 ? group[other] : id, black: game % 2 ? id : group[other], result: null }];
  }));
}

export function keresGroupTable(t: ActiveTournament) {
  const { prelim, groupEnd } = keresStructure(t.players.length);
  const stats = new Map(t.players.map(p => [p.id, { id: p.id, name: p.name, elo: p.elo, points: 0, wins: 0 }]));
  for (const round of t.pairings.slice(prelim, groupEnd)) {
    for (const p of round) {
      if (p.result === null) continue;
      const white = stats.get(p.white)!;
      const black = stats.get(p.black)!;
      white.points += p.result;
      black.points += 1 - p.result;
      white.wins += Number(p.result === 1);
      black.wins += Number(p.result === 0);
    }
  }
  return (t.keresGroups ?? []).map(group => group.map(id => stats.get(id)!).sort(
    (a, b) => b.points - a.points || b.wins - a.wins || b.elo - a.elo || a.id.localeCompare(b.id),
  ));
}
