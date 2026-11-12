import assert from "node:assert/strict";
import { randomAppearance } from "../src/data/appearance.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import { newSeason, seasonTraining, seasonOf } from "../src/game/career/seasonSimulation.ts";
import { endDay } from "../src/game/training/engine.ts";
import { normalizeLearningFocus } from "../src/game/career/learningFocus.ts";
import { buildEloSeries } from "../src/game/history/eloSeries.ts";
import { recordGame } from "../src/game/history/recordGame.ts";
import type { GameSave, GameResult } from "../src/types/index.ts";

const options = {
  name: "Learning QA", gender: "undisclosed" as const, countryCode: "TH",
  city: { name: "Bangkok", custom: false }, archetype: "balanced" as const,
  appearance: randomAppearance(), startYear: 2026, alternateHistory: false,
  playerDatabase: "small" as const,
};
const base = createNewSave(options, createCareerRecord(options));
function train(focus: Parameters<typeof newSeason>[2]) {
  let save = structuredClone(base);
  save.player.money = 1000;
  save.seasonSimulation = newSeason(save, "learning", focus);
  for (let day = 0; day < 20; day++) {
    save = seasonTraining(save);
    assert(save.player.ap.current >= 0 && save.training.hoursUsedToday <= 8);
    assert(save.training.fatigue >= 0 && save.training.fatigue <= 100);
    // JSON round trips simulate persistent saves between every day.
    save = JSON.parse(JSON.stringify(endDay(save).save));
    assert(seasonOf(save));
  }
  return save;
}
const opening = train(["opening"]), endgame = train(["endgame"]), mixed = train(["opening", "endgame"]);
const count = (s: GameSave, id: string) => s.history.sessions.filter((r) => r.sessionId === id).length;
assert(count(opening, "opening-study") > count(endgame, "opening-study"));
assert(count(endgame, "endgame-practice") > count(opening, "endgame-practice"));
assert(count(mixed, "opening-study") >= 10);
assert(count(mixed, "endgame-practice") >= 10);
assert.deepEqual(mixed.seasonSimulation!.learningFocus, ["opening", "endgame"]);
assert.deepEqual(normalizeLearningFocus(["bogus", "opening", "opening", "endgame"]), ["opening", "endgame"]);
const legacy = structuredClone(mixed);
delete legacy.seasonSimulation!.learningFocus;
assert(seasonOf(legacy));
assert(seasonOf(seasonTraining(legacy)));
const blocked = structuredClone(base);
blocked.player.ap.current = 0;
blocked.seasonSimulation = newSeason(blocked, "learning", ["endgame"]);
assert.equal(seasonTraining(blocked).history.sessions.length, 0);
const corrupt = structuredClone(mixed);
(corrupt.seasonSimulation as any).learningFocus = ["bogus"];
assert.equal(seasonOf(corrupt), null);

const history = structuredClone(base.history);
const game = (id: string, year: number, week: number, day: number | undefined, before: number, after: number, tournamentId: string | null): GameResult => ({
  id, year, week, day, ratingBefore: before, ratingAfter: after, tournamentId,
  tournamentName: tournamentId ? "Open" : null, opponentId: null,
  opponentName: "QA", opponentElo: 1200, outcome: "win", color: "white", accuracy: 0, opening: null,
});
history.games = [
  game("g1", 2026, 1, 1, 1000, 1010, "open"),
  game("g2", 2026, 5, 3, 1010, 1020, "open"), // January 31
  game("g3", 2026, 5, 4, 1020, 1030, null), // February 1
  game("g4", 2026, 7, undefined, 1030, 1005, "cup"),
  game("g5", 2027, 1, 1, 1005, 1040, "open"),
];
history.ratingHistory = history.games.map((g) => ({ year: g.year, week: g.week, day: g.day, elo: g.ratingAfter }));
assert.deepEqual(buildEloSeries(history, "month").map((p) => [p.key, p.elo]), [["2026-01", 1020], ["2026-02", 1005], ["2027-01", 1040]]);
assert.deepEqual(buildEloSeries(history, "year").map((p) => p.elo), [1005, 1040]);
assert.deepEqual(buildEloSeries(history, "tournament").map((p) => [p.key, p.elo]), [["2026:open", 1020], ["2026:cup", 1005], ["2027:open", 1040]]);
assert(buildEloSeries(history, "month", "th-TH")[0].label.includes("2026"));
assert.deepEqual(buildEloSeries(base.history, "month"), []);
const fallback = { ...history, ratingHistory: [] };
assert.deepEqual(buildEloSeries(fallback, "month"), buildEloSeries(history, "month"));
// Monthly/yearly views keep the full snapshot history even after detailed games are pruned.
assert.equal(buildEloSeries({ ...history, games: [] }, "year").length, 2);
const dated = recordGame({ ...base, world: { ...base.world, day: 6 } }, { opponentId: null, opponentName: "QA", opponentElo: 1200, outcome: "draw", color: "white", accuracy: null });
assert.equal(dated.history.games[0].day, 6);
assert.equal(dated.history.ratingHistory[0].day, 6);
console.log(JSON.stringify({ ok: true, learningSessions: { opening: count(opening, "opening-study"), endgame: count(endgame, "endgame-practice"), mixedOpening: count(mixed, "opening-study"), mixedEndgame: count(mixed, "endgame-practice") }, checks: "focus selection, rotation, costs, blocked sessions, legacy saves, persistence, calendar boundaries, tournament grouping, full snapshots, empty data, exact game days" }, null, 2));
