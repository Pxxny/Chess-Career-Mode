import { stampIndex } from "./catalog";
import type { GameSave, Npc } from "@/types";
import type { ScheduledEvent } from "@/game/world/schedule";

const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
export const divisionName = (division: number) => `Newcomer ${roman[division]}`;

export function divisionState(save: GameSave) {
  let division = 10;
  let challenge: { direction: -1 | 1; year: number; half: number } | undefined;
  const records = save.history.tournaments.filter(event => event.tournamentId.startsWith("division-league-"))
    .sort((a, b) => stampIndex(a) - stampIndex(b));
  for (const result of records) {
    const half = result.week <= 26 ? 1 : 2;
    if (result.tournamentId.endsWith("-playoff") && challenge) {
      if (challenge.direction === -1 && result.rank === 1) division = Math.max(1, division - 1);
      if (challenge.direction === 1 && result.rank > 1) division = Math.min(10, division + 1);
      challenge = undefined;
    } else if (!result.tournamentId.endsWith("-playoff")) {
      challenge = undefined;
      if (result.rank === 1) division = Math.max(1, division - 1);
      else if (result.rank === 10) division = Math.min(10, division + 1);
      else if (result.rank === 2 && division > 1) challenge = { direction: -1, year: result.year, half };
      else if (result.rank === 9 && division < 10) challenge = { direction: 1, year: result.year, half };
    }
  }
  return { division, challenge };
}

export function divisionFixture(save: GameSave, npcs: Npc[], playoff: boolean): ScheduledEvent | undefined {
  const { division, challenge } = divisionState(save);
  const { year, week: current } = save.world.date;
  const half = current <= 26 ? 1 : 2;
  const week = (half === 1 ? 0 : 26) + (playoff ? 25 : 23);
  if (current >= week || (playoff && (challenge?.half !== half || challenge.year !== year))) return undefined;
  const id = `division-league-${year}-${half}-${division}${playoff ? "-playoff" : ""}`;
  const target = division + (playoff ? challenge!.direction : 0);
  const rating = 2550 - target * 145;
  const active = npcs.filter(npc => npc.careerStatus === "active")
    .sort((a, b) => Math.abs(a.currentElo - rating) - Math.abs(b.currentElo - rating) || a.id.localeCompare(b.id));
  const opponents = active.slice(playoff && challenge!.direction === -1 ? 8 : 0, playoff && challenge!.direction === -1 ? 9 : playoff ? 1 : 9);
  if (opponents.length !== (playoff ? 1 : 9)) return undefined;
  return {
    id, name: playoff ? `${divisionName(target)} Promotion Playoff` : `${divisionName(division)} League`,
    year, week, level: "local", fieldSize: opponents.length + 1, entryFee: 0, minElo: 0, minReputation: 0,
    registrationDeadline: { year, week: week - 1 }, weeksUntilStart: week - current, weeksUntilDeadline: week - current - 1, invitational: false,
    details: {
      leagueDivision: division, invitedNpcIds: opponents.map(npc => npc.id), twoGameRematch: playoff,
      category: "Division League", location: "Online", country: save.player.country, end: { year, week },
      format: playoff ? "round-robin-bo3" : "round-robin", rounds: playoff ? 3 : 9,
      host: { mode: "online" },
      timeControl: { id: "league-blitz", label: "5+3", base: 300, increment: 3, category: "blitz" },
      prize: 0, prestige: 10, provenance: "fictional",
      agenda: { days: 1, startDay: 7, startMinute: 1090, slotMinutes: 22, exactStart: true },
    },
  };
}
