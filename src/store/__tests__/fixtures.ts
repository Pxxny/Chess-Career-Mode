import type { ArchivedEvent } from "@/game/competition/archive";

/** Small synthetic Swiss event: `players` NPCs, `rounds` rounds, every board played. */
export function swissEvent(id: string, year: number, players: number, rounds: number, offset = 0): ArchivedEvent {
  const ids = Array.from({ length: players }, (_, i) => `npc-${offset + i}`);
  const pairings = Array.from({ length: rounds }, (_, r) =>
    Array.from({ length: Math.floor(players / 2) }, (_, b) => ({
      white: ids[(b + r) % players], black: ids[(players - 1 - b + r) % players], result: (b + r) % 3 / 2,
    })));
  return {
    id, year, name: `Event ${id}`, kind: "open", source: "calendar", startDay: 737464 + year, endDay: 737470 + year,
    fieldSize: players, rounds, format: "swiss", timeControl: "classical",
    players: ids.map((pid, i) => ({ id: pid, name: `Name ${pid}`, elo: 1500 + i, countryCode: "TH", points: 0, rank: i + 1 })),
    pairings,
  } as unknown as ArchivedEvent;
}

/** Team event: rows come from teamBoards (members, including a reserve not listed as a member). */
export function teamEvent(id: string, year: number): ArchivedEvent {
  return {
    id, year, name: `Team ${id}`, kind: "team", source: "calendar", startDay: 737600, endDay: 737605,
    fieldSize: 2, rounds: 1, format: "team", timeControl: "rapid",
    players: [
      { id: "team-a", name: "A", elo: 1600, countryCode: "TH", points: 1, rank: 1, members: [{ id: "m-a1", name: "A1", elo: 1600 }] },
      { id: "team-b", name: "B", elo: 1500, countryCode: "VN", points: 0, rank: 2, members: [{ id: "m-b1", name: "B1", elo: 1500 }] },
    ],
    pairings: [],
    teamBoards: [
      { round: 1, white: "A1", black: "B1", whiteId: "m-a1", blackId: "m-b1", score: 1 },
      { round: 1, white: "A-reserve", black: "B1", whiteId: "reserve-a", blackId: "m-b1", score: 0.5 },
    ],
  } as unknown as ArchivedEvent;
}
