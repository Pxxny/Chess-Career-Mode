import { describe, expect, it } from "vitest";
import { getSchedule } from "@/game/world/schedule";
import { incrementAtPly } from "@/game/match/clock";
import { completeRound, standings, startRound } from "@/game/match/tournament";
import type { ActiveTournament, TournamentPlayer } from "@/types";
import { keresEvents, keresGroupTable, keresStructure } from "./keres";

function fixture(field: number) {
  const event = keresEvents(2026)[0];
  const players: TournamentPlayer[] = Array.from({ length: field }, (_, index) => ({
    id: String(index), name: `Seed ${index + 1}`, elo: 2700 - index,
    title: "none", countryCode: "EE", isPlayer: false, points: 0, opponents: [], colors: [],
  }));
  const t: ActiveTournament = {
    eventId: event.id, name: event.name, details: event.details, level: event.level,
    year: event.year, week: event.week, round: 1, rounds: keresStructure(field).rounds,
    status: "playing", players, pairings: [], timeControl: event.details!.timeControl,
    seed: 765, entryFee: 0, prizeFund: event.details!.prize, finalRank: null, prize: 0,
  };
  return startRound(t);
}

describe("Paul Keres Cup", () => {
  it("adds two FIDE events to the season and awards clock increment after move 50", () => {
    const region = { countryCode: "TH", city: "Bangkok", continent: "Asia", demonym: "Thai" };
    const events = getSchedule({year: 2026, week: 1}, region, "keres-test", 51).filter(e => e.details?.keres);
    expect(events.map(e => e.details!.country)).toEqual(["EE", "FI"]);
    for (const e of events) {
      expect(e.fieldSize).toBe(1024);
      expect(e.details!.organizer?.name).toBe("FIDE");
      expect(e.details!.timeControl.base).toBe(10800);
      expect(incrementAtPly(e.details!.timeControl, 99)).toBe(0);
      expect(incrementAtPly(e.details!.timeControl, 100)).toBe(30000);
    }
    expect(keresEvents(2026)[0].details!.prize).not.toBe(keresEvents(2027)[0].details!.prize);
  });

  it("runs 1024 entrants through all stages and preserves the bracket across a save round-trip", () => {
    let t = fixture(1024);
    const { prelim, groupEnd, rounds } = keresStructure(1024);
    for (let i = 0; i < prelim; i++) t = completeRound(t, null);
    expect(t.keresGroups?.map(g => g.length)).toEqual(Array(8).fill(4));
    while (t.round <= groupEnd) {
      t = completeRound(t, null);
      if (t.round === prelim + 8) t = JSON.parse(JSON.stringify(t));
    }
    const groupGames = t.pairings.slice(prelim, groupEnd).flat();
    for (const group of t.keresGroups!) {
      for (const [i, id] of group.entries()) {
        for (const other of group.slice(i + 1)) {
          expect(groupGames.filter(p => p.white === id && p.black === other)).toHaveLength(4);
          expect(groupGames.filter(p => p.white === other && p.black === id)).toHaveLength(4);
        }
      }
    }
    expect(t.knockoutWinners).toEqual(keresGroupTable(t).flatMap(g => g.slice(0, 2).map(p => p.id)));
    expect(t.pairings.at(-1)).toHaveLength(8);
    while (t.round <= rounds - 7) t = completeRound(t, null);
    const finalists = t.knockoutWinners;
    while (t.status === "playing") t = completeRound(t, null);
    expect(t.pairings.slice(rounds - 7).length).toBeGreaterThanOrEqual(4);
    expect(t.pairings.slice(rounds - 7).length).toBeLessThanOrEqual(7);
    expect(standings(t).slice(0, 2).map(row => row.player.id).sort()).toEqual(finalists!.slice().sort());
    expect(new Set(t.eliminated).size).toBe(1023);
  });

  it("handles an undersubscribed field with byes", () => {
    let t = fixture(95);
    while (t.status === "playing") t = completeRound(t, null);
    expect(t.keresGroups?.flat()).toHaveLength(32);
    expect(t.eliminated).toHaveLength(94);
  });
});
