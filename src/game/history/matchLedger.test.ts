import { describe, expect, it } from "vitest";
import type { ArchivedEvent } from "@/game/competition/archive";
import {
  boardMatchId,
  indexRowsFromEvent,
  indexRowsFromMatch,
  openingAnalytics,
  rowMatches,
  summarizeRows,
} from "@/game/history/matchLedger";
import type { MatchRecord } from "@/types";

const event = (): ArchivedEvent => ({
  id: "event-a",
  year: 2026,
  week: 3,
  name: "Bangkok Open",
  kind: "regular",
  source: "calendar",
  startDay: 20,
  endDay: 22,
  fieldSize: 2,
  rounds: 1,
  format: "swiss",
  timeControl: "Classical",
  players: [
    { id: "n1", name: "Anan", elo: 1800, countryCode: "TH", title: "none", points: 1, rank: 1 },
    { id: "n2", name: "Bo", elo: 1700, countryCode: "TH", title: "none", points: 0, rank: 2 },
  ],
  pairings: [
    [
      {
        white: "n1",
        black: "n2",
        result: 1,
        matchKind: "result-only",
        whiteEloBefore: 1800,
        whiteEloAfter: 1807,
        blackEloBefore: 1700,
        blackEloAfter: 1693,
      },
      { white: "n1", black: "bye", result: 1 },
    ],
  ],
});

describe("match ledger", () => {
  it("indexes every played board once per side and never stores moves", () => {
    const rows = indexRowsFromEvent("career", event());
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.matchId)).size).toBe(1);
    expect(rows.every((row) => row.kind === "result-only" && row.replay === false)).toBe(true);
    expect(rows.every((row) => row.replayMatchId === undefined)).toBe(true);
    expect(rows.every((row) => !("moves" in row) && !("uci" in row) && !("eco" in row) && !("openingName" in row))).toBe(true);
    expect(boardMatchId("event-a", 1, "n1", "n2")).toBe("board:event-a:1:n1:n2");
    const again = indexRowsFromEvent("career", event());
    expect(again.map((row) => row.key)).toEqual(rows.map((row) => row.key));
  });

  it("finds one player by index in the same set a full scan returns", () => {
    const rows = indexRowsFromEvent("career", event());
    const scan = rows.filter((row) => row.npcId === "n2");
    const indexed = rows.filter((row) => rowMatches(row, { opponentId: "n1" }) && row.npcId === "n2");
    expect(indexed).toEqual(scan);
    const summary = summarizeRows(scan);
    expect(summary.games).toBe(1);
    expect(summary.wins).toBe(0);
    expect(summary.losses).toBe(1);
    expect(summary.winRate).toBe(0);
    expect(summary.scoreRate).toBe(0);
    expect(summary.eloGames).toBe(1);
  });

  it("keeps the player match id and ignores openings on games without moves", () => {
    const played = {
      id: "season-game:t:1",
      year: 2026,
      week: 1,
      day: 4,
      setup: {
        white: { id: "player", name: "You", elo: 1500, title: "none", countryCode: "TH", nationality: "Thai", flag: "", isPlayer: true },
        black: { id: "n2", name: "Bo", elo: 1700, title: "none", countryCode: "TH", nationality: "Thai", flag: "", isPlayer: false },
        playerColor: "white",
        timeControl: { id: "classical", label: "Classical", base: 90, increment: 30, category: "classical" },
        rated: true,
        tournament: { id: "event-a", name: "Bangkok Open", round: 1, rounds: 9 },
        accuracyBonus: 0,
      },
      result: "white",
      termination: "checkmate",
      outcome: "win",
      moves: ["e4", "e5"],
      gameResultId: "g1",
      openingName: "King's Pawn",
      openingEco: "B00",
      simulated: true,
      controlLog: [],
      ratingBefore: 1500,
      ratingAfter: 1510,
      analysis: null,
    } as unknown as MatchRecord;
    const bare = { ...played, id: "abstract-1", moves: [], openingName: "Invented", openingEco: "A00", recording: undefined };
    const rows = indexRowsFromMatch("career", played);
    expect(rows.map((row) => row.matchId)).toEqual(["season-game:t:1", "season-game:t:1"]);
    expect(rows.every((row) => row.replay && row.kind === "full-replay")).toBe(true);
    const report = openingAnalytics([played, bare]);
    expect(report.replayGames).toBe(1);
    expect(report.lines).toHaveLength(1);
    expect(report.lines[0].eco).toBe("B00");
    expect(report.lines[0].name).toBe("King's Pawn");
  });
});
