import { describe, expect, it } from "vitest";
import { buildWorldNpcs } from "@/game/npc/buildWorldNpcs";
import { createTournament, playerPairing, reportPlayerResult } from "@/game/match/tournament";
import { MatchClock, incrementAtPly } from "@/game/match/clock";
import { bookedStart, bookedEnd, dayLabel, tournamentSlot } from "./agenda";
import { awaitingArmageddon, bulgariaChessEvents, bulgariaPoints, tournamentTimeControl } from "./bulgariaChess";

describe("Bulgaria Chess", () => {
  it("has two synchronized six-player events every year and only Skopje as an alternate host", () => {
    for (let year = 2026; year <= 2035; year++) {
      const [open, women] = bulgariaChessEvents(year);
      expect(bookedStart(open)).toBe(bookedStart(women));
      expect(bookedEnd(open)).toBe(bookedEnd(women));
      expect(dayLabel(bookedStart(open)).slice(5, 10)).toBe("11-25");
      expect(dayLabel(bookedEnd(open)).slice(5, 10)).toBe("12-04");
      expect(open.fieldSize).toBe(6);
      expect(women.details?.gender).toBe("female");
      expect(open.details?.country === "BG" || (open.details?.country === "MK" && open.details.location === "Skopje")).toBe(true);
    }
    expect(bulgariaChessEvents(2030)[0].details?.location).toBe("Skopje");
  });

  it("plays each opponent twice with reversed colors and waits the same day for Armageddon", () => {
    const event = bulgariaChessEvents(2026)[0];
    const npcs = buildWorldNpcs(2026, 20).filter(n => n.careerStatus === "active").slice(0, 5);
    let t = createTournament({ event, npcs, fieldIds: npcs.map(n => n.id), seed: 3,
      player: { name: "QA", rating: 2200, country: "BG", title: "none" },
    });
    expect(t.players).toHaveLength(6);
    const first = playerPairing(t)!;
    const day = tournamentSlot(t).absoluteDay;
    t = reportPlayerResult(t, "draw");
    expect(awaitingArmageddon(t)).toBe(true);
    expect(t.round).toBe(1);
    expect(tournamentSlot(t).absoluteDay).toBe(day);
    expect(playerPairing(t)).toMatchObject({ white: first.white, black: first.black, result: .5 });
    expect(tournamentTimeControl(t)).toMatchObject({ base: 600, blackBase: 420, increment: 1 });
    t = reportPlayerResult(t, "draw");
    expect(awaitingArmageddon(t)).toBe(false);
    expect(t.pairings[0].find(p => p.white === first.white && p.black === first.black)).toMatchObject({
      result: .5, armageddonResult: .5, tiebreakWinner: first.black,
    });
    expect(t.players.find(p => p.id === "player")?.points).toBe(first.black === "player" ? 1.5 : 1);
    while (t.status === "playing") t = reportPlayerResult(t, "win");
    expect(t.pairings).toHaveLength(10);
    const rounds = t.pairings.flat().filter(p => p.white === "player" || p.black === "player");
    const opponents = new Set(rounds.map(p => p.white === "player" ? p.black : p.white));
    expect(opponents.size).toBe(5);
    for (const opponent of opponents) {
      expect(rounds.filter(p => p.black === opponent && p.white === "player")).toHaveLength(1);
      expect(rounds.filter(p => p.white === opponent && p.black === "player")).toHaveLength(1);
    }
  });

  it("awards the requested points and starts the increment for both colors on move 41", () => {
    const board = { white: "w", black: "b" };
    expect(bulgariaPoints({ ...board, result: 1 })).toEqual([3, 0]);
    expect(bulgariaPoints({ ...board, result: .5, armageddonResult: 1 })).toEqual([1.5, 1]);
    expect(bulgariaPoints({ ...board, result: .5, armageddonResult: .5 })).toEqual([1, 1.5]);
    const tc = bulgariaChessEvents(2026)[0].details!.timeControl;
    const clock = new MatchClock(600000, 1000, () => 0, 420000);
    clock.start("w");
    expect(clock.remaining("w")).toBe(600000);
    expect(clock.remaining("b")).toBe(420000);
    expect([78, 79, 80, 81].map(ply => incrementAtPly(tc, ply))).toEqual([0, 0, 10000, 10000]);
  });
});
