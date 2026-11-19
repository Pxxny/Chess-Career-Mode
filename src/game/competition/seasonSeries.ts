import { getCountry } from "@/data/world/countries";
import type { GameSave, Npc } from "@/types";
import type { ScheduledEvent } from "@/game/world/schedule";
import type { EventDetails } from "./types";

export type PointsSeries = "fide-season" | "meridian-venues";

const legPoints = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const cities = [["Utrecht", "NL"], ["Lisbon", "PT"], ["Oslo", "NO"], ["Vienna", "AT"], ["Prague", "CZ"], ["Singapore", "SG"], ["Warsaw", "PL"], ["Berlin", "DE"]] as const;

export function annualSeriesEvents(year: number): ScheduledEvent[] {
  const make = (series: PointsSeries, week: number, leg: number, final = false): ScheduledEvent => {
    const fide = series === "fide-season";
    const title = fide ? "FIDE Season Points Circuit" : "Meridian Home & Away Cup";
    const [location, country] = cities[(year + leg) % cities.length];
    const size = final ? [16, 32, 64, 128][year % 4] : fide ? 96 : 32;
    return {
      id: `${series}-${year}-${final ? "final" : leg}`,
      name: `${title} — ${final ? "Finals" : fide ? `Leg ${leg}` : leg % 2 ? `Home leg ${(leg + 1) / 2}` : `Away leg ${leg / 2}`}`,
      year, week, level: "international", fieldSize: size, entryFee: 0, minElo: 0, minReputation: 0,
      registrationDeadline: { year, week: week - 1 }, weeksUntilStart: 0, weeksUntilDeadline: 0, invitational: final,
      details: {
        pointsSeries: { id: series, stage: final ? "final" : "leg", year, seats: final ? size : undefined },
        category: final ? "Season Finals" : "Points Circuit",
        location, country, host: { mode: "rotation" }, end: { year, week }, format: "swiss", rounds: final ? 9 : 7,
        timeControl: { id: "series-rapid", label: "15+10", base: 900, increment: 10, category: "rapid" },
        prize: final ? 100000 : 2500, prestige: final ? 90 : 35, provenance: fide ? "inspired" : "fictional",
        organizer: { name: fide ? "FIDE" : "Meridian Pulse", status: fide ? "Official" : "Unofficial", simulated: true, ...(fide ? {} : { sponsorId: "meridian-pulse" }) },
        agenda: { days: 2, startDay: 5, startMinute: 540, slotMinutes: 70, exactStart: true },
      },
    };
  };
  return [
    ...[5, 10, 15, 20, 25, 30, 35, 40, 45].map((week, index) => make("fide-season", week, index + 1)),
    make("fide-season", 51, 0, true),
    ...[7, 18, 29, 42].map((week, index) => make("meridian-venues", week, index + 1)),
  ];
}

export function seriesStandings(save: GameSave, npcs: Npc[], series: PointsSeries, year: number) {
  const prefix = `${series}-${year}-`;
  const score = (entries: { id?: string; rank: number }[]) => {
    const seen = new Set<string>();
    let points = 0, wins = 0, legs = 0;
    for (const { id, rank } of entries) {
      if (!id || !id.startsWith(prefix) || id.endsWith("-final") || seen.has(id) || rank < 1) continue;
      seen.add(id);
      points += legPoints[rank - 1] ?? 0;
      wins += Number(rank === 1);
      legs++;
    }
    return { points, wins, legs };
  };
  const rows = [
    ...npcs.map(npc => ({
      id: npc.id, name: npc.name, country: getCountry(npc.nationality)?.flag ?? "",
      ...score(npc.tournamentHistory.filter(result => result.year === year).map(result => ({ id: result.eventId, rank: result.rank }))),
    })),
    { id: "player", name: save.player.name, country: getCountry(save.player.country)?.flag ?? "",
      ...score(save.history.tournaments.filter(result => result.year === year).map(result => ({ id: result.tournamentId, rank: result.rank }))) },
  ].filter(row => row.points > 0);
  return rows.sort((a, b) => b.points - a.points || b.wins - a.wins || b.legs - a.legs || a.id.localeCompare(b.id));
}

export function seriesFinalists(save: GameSave, npcs: Npc[], details: EventDetails) {
  const series = details.pointsSeries!;
  return seriesStandings(save, npcs, series.id, series.year).slice(0, series.seats ?? 0);
}
