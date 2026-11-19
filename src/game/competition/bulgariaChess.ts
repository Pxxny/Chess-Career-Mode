import type { ActiveTournament, MatchTimeControl, TournamentPairing } from "@/types";
import type { ScheduledEvent } from "@/game/world/schedule";
import { dayStamp } from "./agenda";

const cities = ["Sofia", "Plovdiv", "Varna", "Burgas", "Ruse", "Stara Zagora"];
const classical: MatchTimeControl = {
  id: "bulgaria-classical", label: "120 min · +10s from move 41",
  base: 7200, increment: 10, incrementFromMove: 41, category: "classical",
};

export function bulgariaChessEvents(year: number): ScheduledEvent[] {
  const skopje = year >= 2030 && (year - 2030) % 5 === 0;
  const cityIndex = ((year - 2026) % cities.length + cities.length) % cities.length;
  const offset = Math.round((Date.UTC(year, 10, 25) - Date.UTC(year, 0, 1)) / 86400000);
  const start = year * 364 + offset;
  const { week, day } = dayStamp(start);
  return (["open", "women"] as const).map(section => ({
    id: `bulgaria-chess-${section}-${year}`,
    name: `Bulgaria Chess ${section === "women" ? "Women’s" : "Open"} ${year}`,
    year, week, level: "elite", fieldSize: 6, entryFee: 0, minElo: 0, minReputation: 0,
    registrationDeadline: { year, week: week - 1 }, weeksUntilStart: 0, weeksUntilDeadline: 0, invitational: false,
    details: {
      bulgariaChess: true, category: "Bulgaria Chess",
      country: skopje ? "MK" : "BG", location: skopje ? "Skopje" : cities[cityIndex],
      end: dayStamp(start + 9), format: "double-round-robin", rounds: 10, timeControl: classical,
      prize: 100000, prestige: 85, provenance: "fictional", host: { mode: "rotation" },
      organizer: { name: "Bulgaria Chess", status: "Unofficial", simulated: true },
      agenda: { days: 10, startDay: day, startMinute: 900, slotMinutes: 340, exactStart: true },
      ...(section === "women" ? { gender: "female" as const } : {}),
    },
  }));
}

export function awaitingArmageddon(t?: ActiveTournament | null): boolean {
  return !!(t?.status === "playing" && t.details?.bulgariaChess && t.pairings[t.round - 1]?.some(
    pair => (pair.white === "player" || pair.black === "player") && pair.result === .5 && pair.armageddonResult === undefined,
  ));
}

export function tournamentTimeControl(t: ActiveTournament): MatchTimeControl {
  if (!awaitingArmageddon(t)) return t.timeControl;
  return {
    id: "bulgaria-armageddon", label: t.year === 2026 ? "Armageddon · 10 vs 7 min · +1s from move 41" : "Armageddon · 10 vs 7 min",
    base: 600, blackBase: 420, increment: t.year === 2026 ? 1 : 0, incrementFromMove: 41, category: "blitz",
  };
}

export function bulgariaPoints(pair: TournamentPairing): [number, number] {
  if (pair.result === 1) return [3, 0];
  if (pair.result === 0) return [0, 3];
  if (pair.armageddonResult === undefined) return [0, 0];
  return pair.armageddonResult === 1 ? [1.5, 1] : [1, 1.5];
}
