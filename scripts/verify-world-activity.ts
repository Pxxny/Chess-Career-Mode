import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { Chess } from "chess.js";
import { DEFAULT_APPEARANCE } from "../src/data/appearance.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs.ts";
import { applyWorldState, rerankNpcs } from "../src/game/npc/worldState.ts";
import { weeklyCircuit } from "../src/game/career/expansion.ts";
import { reconcileTournamentHistory } from "../src/game/npc/tournamentHistory.ts";
import {
  createTournament,
  reportPlayerResult,
  standings,
} from "../src/game/match/tournament.ts";
import { extraCircuit, withTravel } from "../src/game/qol/schedule.ts";
import {
  recordGame,
  recordTournament,
} from "../src/game/history/recordGame.ts";
import { endDay, performSession } from "../src/game/training/engine.ts";
import { upgradeSave } from "../src/game/training/migrate.ts";
import { BuiltInReferee, ChessJsReferee } from "../src/game/match/referee.ts";
import { useGameStore } from "../src/store/gameStore.ts";
import { useNpcStore } from "../src/store/npcStore.ts";
import type { GameOutcome } from "../src/types/index.ts";
import type { ScheduledEvent as Event } from "../src/game/world/schedule.ts";

const started = performance.now();
const options = {
  name: "World QA",
  gender: "undisclosed" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: DEFAULT_APPEARANCE,
  startYear: 2026,
  alternateHistory: false,
};
const base = createNewSave(options, {
  ...createCareerRecord(options),
  id: "world-activity-qa",
});
let npcs = buildWorldNpcs(2026);
const region = {
  city: "Bangkok",
  countryCode: "TH",
  demonym: "Thai",
  continent: "Asia",
};
const away = extraCircuit(base.world.date, region, base.career.id, 52).filter(
  (e) => e.details?.country !== "TH",
);
assert.equal(away.length, 156);
assert(new Set(away.map((e) => e.details?.country)).size >= 25);
assert.equal(new Set(away.map((e) => e.id)).size, away.length);
for (let i = 0; i < away.length; i += 3)
  assert.equal(
    new Set(away.slice(i, i + 3).map((e) => e.details!.country)).size,
    3,
  );
assert(
  away.some(
    (e) => e.minElo === 0 && e.details?.timeControl.category === "rapid",
  ),
);
assert(away.some((e) => e.level === "international"));
assert.deepEqual(
  away,
  extraCircuit(base.world.date, region, base.career.id, 52).filter(
    (e) => e.details?.country !== "TH",
  ),
);
assert(
  away.every((e) =>
    [60, 120].includes(withTravel(e, "TH").details!.travelCost!),
  ),
);
console.log(
  "PASS 156 foreign events/year, diverse countries, stable IDs, distinct weekly hosts and normal travel costs.",
);

let circuitSave = base,
  totalBoards = 0;
const original = JSON.stringify(npcs);
const magnusId = "legend-magnus-carlsen";
for (let week = 2; week <= 9; week++) {
  circuitSave = {
    ...circuitSave,
    world: { ...circuitSave.world, date: { year: 2026, week } },
  };
  npcs = applyWorldState(npcs, {
    ...circuitSave.world.date,
    alternateHistory: false,
  });
  const result = weeklyCircuit(circuitSave, npcs);
  assert.deepEqual(
    result,
    weeklyCircuit(circuitSave, npcs),
    "same input has deterministic results",
  );
  const boards =
    result.changed.reduce(
      (sum, n) => sum + (n.tournamentHistory.at(-1)?.games ?? 0),
      0,
    ) / 2;
  assert(boards > 0);
  totalBoards += boards;
  assert.equal(result.save.prediction?.metrics.npc.adjusted.games, totalBoards);
  assert.strictEqual(weeklyCircuit(result.save, npcs).save, result.save);
  const updated = new Map(result.changed.map((n) => [n.id, n]));
  npcs = rerankNpcs(npcs.map((n) => updated.get(n.id) ?? n));
  circuitSave = result.save;
}
assert.notEqual(JSON.stringify(npcs), original);
const magnus = npcs.find((n) => n.id === magnusId)!;
assert(
  magnus.tournamentHistory.filter((t) => t.source === "world-circuit").length >=
    4,
  "elite players compete regularly",
);
assert(magnus.competitionStats!.games >= 12);
assert(
  npcs.some((n) =>
    n.tournamentHistory.some((h) => h.source === "world-circuit" && h.rank > 1),
  ),
  "all entrants, not only winners, get history",
);
assert(
  npcs.reduce((sum, n) => sum + (n.competitionStats?.draws ?? 0), 0) > 0,
  "background games really draw",
);
assert(
  npcs
    .filter(
      (n) =>
        n.kind === "fictional" &&
        ["active", "semi-retired"].includes(n.careerStatus),
    )
    .every((n) => n.competitionStats?.games),
  "rotation reaches every active fictional NPC in eight weeks",
);
assert.equal(
  npcs.find((n) => n.id === "legend-jose-raul-capablanca")?.competitionStats,
  undefined,
);
const synced = applyWorldState(npcs, {
  year: 2026,
  week: 9,
  alternateHistory: false,
});
assert.equal(
  synced.find((n) => n.id === magnusId)!.currentElo,
  magnus.currentElo,
  "historical sync does not erase earned Elo",
);
assert.equal(
  applyWorldState(synced, {
    year: 2026,
    week: 9,
    alternateHistory: false,
  }).find((n) => n.id === magnusId)!.currentElo,
  magnus.currentElo,
);
console.log(
  `PASS ${totalBoards} rated NPC boards: rotating participation, regular Magnus events, draws, dynamic rankings and idempotent world sync.`,
);

const event: Event = {
  id: "history-qa",
  name: "History QA Open",
  year: 2026,
  week: 1,
  level: "local",
  fieldSize: 8,
  entryFee: 0,
  minElo: 0,
  minReputation: 0,
  registrationDeadline: { year: 2026, week: 1 },
  weeksUntilStart: 0,
  weeksUntilDeadline: 0,
  invitational: false,
};
let t = createTournament({
  event,
  player: {
    name: base.player.name,
    rating: base.player.rating,
    country: "TH",
    title: "none",
  },
  npcs,
  seed: 555,
});
while (t.status === "playing")
  t = reportPlayerResult(
    t,
    t.round % 3 === 0 ? "draw" : t.round % 2 ? "win" : "loss",
  );
const finished = { ...base, tournament: t };
const updated = reconcileTournamentHistory(finished, npcs);
assert.equal(updated.length, t.players.length - 1);
const ranked = standings(t);
for (const npc of updated) {
  const h = npc.tournamentHistory.at(-1)!;
  assert.equal(h.eventId, t.eventId);
  assert.equal(h.rank, ranked.findIndex((r) => r.player.id === npc.id) + 1);
  assert.equal(h.points, t.players.find((p) => p.id === npc.id)!.points);
  assert.equal(h.games, (h.wins ?? 0) + (h.draws ?? 0) + (h.losses ?? 0));
}
const byId = new Map(updated.map((n) => [n.id, n]));
const reconciled = npcs.map((n) => byId.get(n.id) ?? n);
assert.deepEqual(reconcileTournamentHistory(finished, reconciled), []);
const archived = {
  ...base,
  competition: { ...base.competition!, archive: [t] },
};
const backfill = reconcileTournamentHistory(archived, npcs);
assert.equal(backfill.length, t.players.length - 1);
for (const n of backfill)
  assert.equal(
    n.currentElo,
    npcs.find((old) => old.id === n.id)!.currentElo,
    "legacy archive backfill invents no historical rating changes",
  );
useGameStore.setState({ save: null });
useNpcStore.setState({
  careerId: base.career.id,
  status: "ready",
  npcs,
  startYear: 2026,
});
useGameStore.setState({ save: finished });
for (const p of t.players.filter((p) => !p.isPlayer))
  assert(
    useNpcStore
      .getState()
      .npcs.find((n) => n.id === p.id)!
      .tournamentHistory.some((h) => h.eventId === event.id),
  );
const snapshot = JSON.stringify(useNpcStore.getState().npcs);
useGameStore.setState({ save: { ...finished, tournament: { ...t } } });
assert.equal(JSON.stringify(useNpcStore.getState().npcs), snapshot);
console.log(
  "PASS finished-event NPC history, standings, one-time ratings, old-archive repair and automatic store reconciliation.",
);

let year = base;
const outcomes: GameOutcome[] = ["win", "draw", "loss"];
for (let i = 0; i < 1105; i++)
  year = recordGame(year, {
    opponentId: "qa",
    opponentName: "QA",
    opponentElo: year.player.rating,
    outcome: outcomes[i % 3],
    color: "white",
    accuracy: 80,
  });
assert.equal(year.history.games.length, 1000);
assert.equal(year.yearReview!.current.rated.wins, 369);
assert.equal(year.yearReview!.current.rated.draws, 368);
assert.equal(year.yearReview!.current.rated.losses, 368);
for (let i = 0; i < 220; i++) {
  const trained = performSession(year, "tactics-puzzle");
  assert(trained.ok, trained.ok ? "" : trained.error);
  year = endDay(trained.save).save;
}
assert.equal(year.history.sessions.length, 200);
assert.equal(year.yearReview!.current.sessions, 220);
year = recordTournament(year, {
  tournamentId: "annual-qa",
  name: "Annual QA",
  level: "local",
  rank: 1,
  fieldSize: 8,
  points: 4,
  prize: 100,
});
year = recordTournament(year, {
  tournamentId: "annual-qa",
  name: "Annual QA",
  level: "local",
  rank: 1,
  fieldSize: 8,
  points: 4,
  prize: 100,
});
assert.equal(year.yearReview!.current.tournaments, 1);
year = {
  ...year,
  world: { ...year.world, date: { year: 2026, week: 52 }, day: 7 },
};
const endingRating = year.player.rating;
const crossed = endDay(year).save;
const review = crossed.yearReview!.reviews[0];
assert.equal(review.year, 2026);
assert.equal(review.endRating, endingRating);
assert.equal(review.startRating, 1000);
assert.equal(
  review.rated.wins + review.rated.draws + review.rated.losses,
  1105,
);
assert.equal(review.sessions, 220);
assert.equal(review.tournaments, 1);
assert.equal(review.tournamentWins, 1);
assert.equal(review.coverage, "complete");
assert.deepEqual(crossed.yearReview!.unread, [2026]);
assert.equal(crossed.yearReview!.current.year, 2027);
const later = recordGame(crossed, {
  opponentId: "qa",
  opponentName: "QA",
  opponentElo: 1000,
  outcome: "draw",
  color: "black",
  accuracy: 80,
});
assert.deepEqual(later.yearReview!.reviews[0], review);
assert.equal(later.yearReview!.current.rated.draws, 1);
const legacy = { ...year, version: 13, yearReview: undefined };
assert.equal(upgradeSave(legacy).yearReview!.current.coverage, "retained");
assert.deepEqual(
  upgradeSave(JSON.parse(JSON.stringify(crossed))).yearReview,
  crossed.yearReview,
);
useGameStore.setState({ save: crossed });
useGameStore.getState().dismissYearReview(2026);
assert.deepEqual(useGameStore.getState().save!.yearReview!.unread, []);
console.log(
  "PASS year-boundary summary, 1,105 games and 220 sessions beyond history limits, dedupe, archived summaries, migration and dismissal persistence.",
);

for (const factory of [
  (fen?: string) => new BuiltInReferee(fen),
  (fen?: string) => new ChessJsReferee(Chess, fen),
]) {
  assert.equal(
    factory("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").end()?.reason,
    "stalemate",
  );
  assert.equal(
    factory("7k/8/6K1/8/8/8/8/8 w - - 0 1").end()?.reason,
    "insufficient",
  );
  assert.equal(
    factory("7k/8/6K1/8/8/8/R7/8 w - - 100 51").end()?.reason,
    "fiftyMove",
  );
  const repetition = factory();
  for (const move of [
    "g1f3",
    "g8f6",
    "f3g1",
    "f6g8",
    "g1f3",
    "g8f6",
    "f3g1",
    "f6g8",
  ])
    assert(repetition.play(move));
  assert.equal(repetition.end()?.result, "draw");
  assert.equal(repetition.end()?.reason, "repetition");
}
console.log(
  "PASS real draw rules in both referees: stalemate, insufficient material, fifty-move rule and threefold repetition.",
);
console.log(
  `All world-activity checks passed in ${((performance.now() - started) / 1000).toFixed(2)}s.`,
);
