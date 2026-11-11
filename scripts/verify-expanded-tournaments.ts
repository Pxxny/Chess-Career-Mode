import assert from "node:assert/strict";
import {
  rotatingEvents,
  bookedStart,
  bookedEnd,
  eventAgenda,
  roundSlot,
  maximumPlayerGames,
} from "../src/game/competition/agenda.ts";
import {
  createTournament,
  reportPlayerResult,
  standings,
} from "../src/game/match/tournament.ts";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs.ts";

const region = {
  city: "Bangkok",
  countryCode: "TH",
  demonym: "Thai",
  continent: "Asia" as const,
};
const events = rotatingEvents({ year: 2026, week: 1 }, region, 52).filter(
  (e) => e.year === 2026,
);
assert.equal(events.length, 36);
for (let month = 1; month <= 12; month++) {
  const expected = [
    month % 2 === 0 ? 12 : 6,
    month % 3 === 0 ? 24 : 8,
    month % 3 === 0 ? 12 : 6,
  ];
  const editions = events.filter((e) =>
    e.id.startsWith(`rotation-2026-${month}-`),
  );
  assert.equal(editions.length, 3);
  for (let family = 0; family < 3; family++) {
    const e = editions.find((e) => e.id.endsWith(`-${family}`))!;
    assert.equal(e.fieldSize, expected[family]);
    assert.equal(
      e.details!.rounds,
      (expected[family] - 1) * (family === 2 ? 3 : 1),
    );
    assert.equal(maximumPlayerGames(e), e.details!.rounds);
    const a = eventAgenda(e),
      series = family === 2 ? 3 : 1;
    assert.equal(a.days, family === 0 ? 3 : 7);
    for (let round = 1; round <= e.details!.rounds; round++) {
      const slot = roundSlot(
        round,
        e.details!.rounds,
        a.days,
        a.slotMinutes,
        a.startMinute,
        series,
      );
      assert.ok(slot.day >= 0 && slot.day < a.days);
      assert.ok(
        slot.minute >= 540 && slot.endMinute <= 1140,
        "Every game fits a daytime slot",
      );
      if (series === 3)
        assert.equal(
          slot.day,
          roundSlot(
            Math.ceil(round / 3) * 3,
            e.details!.rounds,
            a.days,
            a.slotMinutes,
            a.startMinute,
            series,
          ).day,
        );
    }
  }
}
const sorted = [...events].sort((a, b) => bookedStart(a) - bookedStart(b));
for (let i = 1; i < sorted.length; i++)
  assert.ok(
    bookedEnd(sorted[i - 1]) < bookedStart(sorted[i]),
    "Rotations still do not overlap",
  );
const npcs = buildWorldNpcs(2026).filter((n) => n.careerStatus === "active");
const expanded = [
  events.find((e) => e.id === "rotation-2026-2-0")!,
  events.find((e) => e.id === "rotation-2026-3-1")!,
  events.find((e) => e.id === "rotation-2026-3-2")!,
];
for (const e of expanded)
  for (const outcome of ["win", "draw"] as const) {
    let t = createTournament({
      event: e,
      player: {
        name: "Extended Playtest",
        rating: 1000,
        country: "TH",
        title: "none",
      },
      npcs,
      fieldIds: npcs.slice(0, e.fieldSize - 1).map((n) => n.id),
      seed: 71,
    });
    assert.equal(t.players.length, e.fieldSize);
    assert.equal(t.rounds, e.details!.rounds);
    let games = 0;
    while (t.status === "playing") {
      assert.ok(games++ <= e.details!.rounds, "Tournament must finish");
      t = reportPlayerResult(JSON.parse(JSON.stringify(t)), outcome); // Resume each checkpoint.
    }
    assert.equal(
      games,
      e.details!.format === "round-robin-bo3" && outcome === "win"
        ? 2 * (e.fieldSize - 1)
        : maximumPlayerGames(e),
    );
    assert.equal(standings(t).length, e.fieldSize);
    if (outcome === "win") assert.equal(t.finalRank, 1);
    const meetings = new Map<string, number>();
    for (const p of t.pairings.flat()) {
      if (p.black === "bye") continue;
      assert.notEqual(p.result, null);
      const pair = [p.white, p.black].sort().join("|");
      meetings.set(pair, (meetings.get(pair) ?? 0) + 1);
    }
    assert.equal(
      meetings.size,
      (e.fieldSize * (e.fieldSize - 1)) / 2,
      "Every pair meets",
    );
    for (const count of meetings.values())
      assert.ok(
        e.details!.format === "round-robin-bo3"
          ? count >= 2 && count <= 3
          : count === 1,
      );
    console.log(
      `PASS ${e.id}: ${e.fieldSize} players, ${games} player games (${outcome}), saved checkpoints, all pairings, finished standings.`,
    );
  }
const old = {
  ...expanded[0],
  fieldSize: 6,
  details: { ...expanded[0].details!, rounds: 5 },
};
const snapshot = JSON.stringify(old);
assert.equal(
  maximumPlayerGames({
    ...old,
    fieldSize: 4,
    details: { ...old.details, format: "swiss", rounds: 9 },
  }),
  3,
);
assert.equal(
  maximumPlayerGames({
    ...old,
    fieldSize: 2,
    details: { ...old.details, format: "match", rounds: 14 },
  }),
  14,
);
const legacy = createTournament({
  event: old,
  player: {
    name: "Existing registration",
    rating: 1000,
    country: "TH",
    title: "none",
  },
  npcs,
  fieldIds: npcs.slice(0, 5).map((n) => n.id),
  seed: 1,
});
assert.equal(legacy.rounds, 5);
assert.equal(
  JSON.stringify(old),
  snapshot,
  "Existing event snapshots are not rewritten",
);
const underfilled = createTournament({
  event: expanded[1],
  player: {
    name: "Small actual field",
    rating: 1000,
    country: "TH",
    title: "none",
  },
  npcs,
  fieldIds: npcs.slice(0, 8).map((n) => n.id),
  seed: 2,
});
assert.equal(underfilled.players.length, 9);
assert.equal(underfilled.rounds, 9); // One bye per player, eight actual opponents.
assert.equal(
  maximumPlayerGames({ details: underfilled.details, fieldSize: 9 }),
  8,
);
console.log(
  "Expanded tournament checks passed: 36 selected/short editions, full RR/BO3 completion, date windows, daily slots, non-overlap, unchanged old snapshots and underfilled fields.",
);
