import { TEAM_EVENTS } from "../src/data/chess/nationalTeamEvents.ts";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { randomAppearance } from "../src/data/appearance.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import { getSchedule } from "../src/game/world/schedule.ts";
import {
  registerForEvent,
  startRegisteredTournament,
  cancelRegistration,
  previewEntrants,
} from "../src/game/match/registration.ts";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs.ts";
import {
  createTournament,
  reportPlayerResult,
  standings,
  withdraw,
  playerOpponentId,
} from "../src/game/match/tournament.ts";
import {
  maximumMatching,
  swissPairings,
} from "../src/game/competition/swiss.ts";
import {
  competitionOf,
  setCompetitionConfig,
  prepareEvent,
  scoutOpponent,
  applyPreparedProfile,
  reasonableEarlyDraw,
  archiveCompetition,
} from "../src/game/competition/preparation.ts";
import { eligibilityIssues } from "../src/game/competition/eligibility.ts";
import { getBaseOpeningDatabase } from "../src/game/openings/database.ts";
import {
  buildPlayerProfile,
  bookMoveFor,
  strengthForMove,
  thinkTimeMs,
} from "../src/game/match/npcProfile.ts";
import { recordTournament } from "../src/game/history/recordGame.ts";
import { registrationIssue } from "../src/game/competition/eligibility.ts";
import { upgradeSave } from "../src/game/training/migrate.ts";
import { createRng } from "../src/game/rng.ts";
import type {
  ActiveTournament,
  TournamentPlayer,
  GameSave,
} from "../src/types/index.ts";

const started = performance.now();
const opts = {
  name: "Complete QA",
  gender: "undisclosed" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: randomAppearance(),
  startYear: 2024,
  alternateHistory: false,
};
const base = createNewSave(opts, createCareerRecord(opts));
const npcs = buildWorldNpcs(2024),
  db = getBaseOpeningDatabase();
const region = {
  city: "Bangkok",
  countryCode: "TH",
  demonym: "Thai",
  continent: "Asia",
};
const events = getSchedule(base.world.date, region, base.career.id, 52);
assert.equal(new Set(events.map((e) => e.id)).size, events.length);
const categories = new Set(events.map((e) => e.details?.category));
assert.equal(categories.size, 14 + TEAM_EVENTS.length);
for (const spec of TEAM_EVENTS) assert(categories.has(spec.category));
const open = events.find(
  (e) =>
    e.level === "local" &&
    e.details?.format === "swiss" &&
    registrationIssue(
      { ...base, player: { ...base.player, money: 1000 } },
      e,
      npcs,
    ) === null,
)!;
let save: GameSave = {
  ...base,
  player: { ...base.player, money: 1000, ap: { current: 10, max: 10 } },
};
const paid = registerForEvent(save, open, npcs);
assert(paid.ok);
save = paid.save;
assert.equal(
  save.player.money,
  1000 - open.entryFee - (open.details?.travelCost ?? 0),
);
assert(!registerForEvent(save, open, npcs).ok);
const late = {
  ...base,
  world: {
    ...base.world,
    date: {
      year: open.registrationDeadline.year,
      week: open.registrationDeadline.week + 1,
    },
  },
};
assert(
  !registerForEvent(late, { ...open, weeksUntilDeadline: 999 }, npcs).ok,
  "stale relative deadline cannot bypass current date",
);
assert(!registerForEvent(base, { ...open, entryFee: -100 }, npcs).ok);
assert(!registerForEvent(base, { ...open, fieldSize: Infinity }, npcs).ok);
assert.equal(cancelRegistration(save, open.id).player.money, 1000);
assert(
  !startRegisteredTournament(save, open.id, npcs, 1).ok,
  "cannot start before event week",
);
const atEvent = {
  ...save,
  world: { ...save.world, date: { year: open.year, week: open.week } },
};
const active = startRegisteredTournament(atEvent, open.id, npcs, 1);
assert(active.ok && active.save.tournament);
assert.deepEqual(
  active.save.tournament.players.filter((p) => !p.isPlayer).map((p) => p.id),
  previewEntrants(atEvent, open, npcs).map((p) => p.id),
);
assert(
  !startRegisteredTournament(active.save, open.id, npcs, 1).ok,
  "cannot start twice",
);
for (const key of ["national", "candidates", "super", "world-championship"]) {
  const e = events.find((e) => e.id === `career-${key}-2024`)!;
  assert(eligibilityIssues(base, e).length > 0);
}
const candidates = events.find((e) => e.id === "career-candidates-2024")!;
let qualified: GameSave = {
  ...base,
  player: {
    ...base.player,
    rating: 2750,
    reputation: 100,
    league: "elite-grandmaster",
  },
  history: { ...base.history, titles: [{ year: 2024, week: 1, title: "GM" }] },
  competition: {
    ...competitionOf(base),
    qualifications: [{ kind: "candidates", year: 2024, source: "QA" }],
  },
};
assert.deepEqual(eligibilityIssues(qualified, candidates), []);
assert(
  eligibilityIssues(
    {
      ...qualified,
      world: { ...qualified.world, date: { year: 2027, week: 1 } },
    },
    candidates,
  ).includes("Previous qualification: candidates"),
);
assert(
  eligibilityIssues(qualified, {
    ...candidates,
    details: { ...candidates.details!, nationality: "NO" },
  }).includes("NO nationality"),
);
assert(
  eligibilityIssues(
    { ...qualified, player: { ...qualified.player, league: "club" } },
    events.find((e) => e.id === "career-super-2024")!,
  ).some((i) => i.includes("league")),
);
console.log(
  "PASS registration: real date, duplicate, negative fee, capacity, advance start, title, qualification, nationality, league",
);

// Independent exhaustive oracle verifies matching feasibility on random general graphs.
const oracle = (g: number[][], left: number[]): boolean => {
  if (!left.length) return true;
  const [a, ...rest] = left;
  return rest.some(
    (b) =>
      g[a].includes(b) &&
      oracle(
        g,
        rest.filter((x) => x !== b),
      ),
  );
};
const rng = createRng(9292);
for (let n = 2; n <= 10; n += 2)
  for (let iter = 0; iter < 150; iter++) {
    const g = Array.from({ length: n }, () => [] as number[]);
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++)
        if (rng.chance(0.45)) {
          g[a].push(b);
          g[b].push(a);
        }
    const m = maximumMatching(g);
    assert.equal(
      m.every((x) => x >= 0),
      oracle(
        g,
        Array.from({ length: n }, (_, i) => i),
      ),
      `matching ${n}/${iter}`,
    );
    m.forEach((b, a) => {
      if (b >= 0) {
        assert.equal(m[b], a);
        assert(g[a].includes(b));
      }
    });
  }
const players = (count: number): TournamentPlayer[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i === 0 ? "player" : `p${i}`,
    name: `P${i}`,
    elo: 2000 - i * 10,
    title: "none",
    countryCode: "TH",
    isPlayer: i === 0,
    points: 0,
    opponents: [],
    colors: [],
  }));
const trap = players(4);
trap[2].opponents = ["p3"];
trap[3].opponents = ["p2"];
assert(
  swissPairings(trap, 2).every(
    (p) => !trap.find((x) => x.id === p.white)!.opponents.includes(p.black),
  ),
  "greedy trap repaired",
);
let swissMs = 0;
for (const size of [9, 16, 48, 128]) {
  let t = createTournament({
    event: {
      ...open,
      fieldSize: size,
      details: { ...open.details!, rounds: Math.min(11, size - 1) },
    },
    player: { name: "QA", rating: 2000, country: "TH", title: "none" },
    npcs,
    seed: 10,
  });
  const start = performance.now();
  while (t.status === "playing") {
    const round = t.pairings[t.round - 1],
      ids = round.flatMap((p) =>
        p.black === "bye" ? [p.white] : [p.white, p.black],
      );
    assert.equal(new Set(ids).size, size);
    assert.equal(ids.length, size);
    const bye = round.find((p) => p.black === "bye");
    if (
      size === 9 &&
      bye &&
      t.players.find((p) => p.id === bye.white)!.opponents.includes("bye")
    ) {
      const alternative = t.players.some((candidate) => {
        if (candidate.opponents.includes("bye")) return false;
        const pool = t.players.filter((p) => p !== candidate);
        const graph = pool.map((p, i) =>
          pool
            .map((_, j) => j)
            .filter(
              (j) =>
                j !== i &&
                !p.opponents.includes(pool[j].id) &&
                !pool[j].opponents.includes(p.id),
            ),
        );
        return oracle(
          graph,
          graph.map((_, i) => i),
        );
      });
      assert(
        !alternative,
        "repeat bye only when no fresh-bye/no-rematch complete pairing exists",
      );
    }
    round.forEach((p) => {
      if (p.black !== "bye")
        assert(
          !t.players.find((x) => x.id === p.white)!.opponents.includes(p.black),
          `no repeats ${size} round ${t.round}`,
        );
    });
    t = reportPlayerResult(t, "draw");
  }
  assert(t.players.every((p) => p.points >= 0 && p.points <= t.rounds));
  swissMs += performance.now() - start;
}
console.log(
  `PASS Swiss: 750 graphs vs exhaustive oracle, greedy trap, 9/16/48/128-player events (${swissMs.toFixed(1)} ms total)`,
);

for (const format of [
  "round-robin",
  "double-round-robin",
  "match",
  "knockout",
] as const) {
  for (const size of format === "match" ? [2] : [7, 8]) {
    let t = createTournament({
      event: {
        ...open,
        fieldSize: size,
        details: { ...open.details!, format },
      },
      player: { name: "QA", rating: 2000, country: "TH", title: "none" },
      npcs,
      seed: 88,
    });
    let guard = 0;
    while (t.status === "playing" && guard++ < 40)
      t = reportPlayerResult(t, "draw");
    assert.equal(t.status, "finished");
    assert.equal(standings(t)[0].rank, 1);
    if (format.includes("round-robin")) {
      const games = t.pairings.flat().filter((p) => p.black !== "bye");
      assert.equal(
        games.length,
        ((size * (size - 1)) / 2) * (format === "double-round-robin" ? 2 : 1),
      );
      const count = new Map<string, number>();
      for (const p of games) {
        const key = [p.white, p.black].sort().join(":");
        count.set(key, (count.get(key) ?? 0) + 1);
      }
      assert(
        [...count.values()].every(
          (v) => v === (format === "double-round-robin" ? 2 : 1),
        ),
      );
      if (format === "double-round-robin") {
        const colors = new Set(games.map((p) => `${p.white}:${p.black}`));
        assert.equal(colors.size, games.length);
      }
    }
    if (format === "knockout") {
      assert.equal(t.eliminated?.length, size - 1);
      assert.equal(t.knockoutWinners?.length, 1);
      assert.equal(standings(t)[0].player.id, t.knockoutWinners![0]);
    }
    const withdrawn = withdraw(
      createTournament({
        event: open,
        player: { name: "QA", rating: 2000, country: "TH", title: "none" },
        npcs,
        seed: 88,
      }),
    );
    assert.equal(withdrawn.prize, 0);
    assert(withdrawn.withdrawn);
  }
}
console.log(
  "PASS formats: single/double round-robin, odd fields, match tiebreak, knockout byes/elimination, withdrawal",
);

save = setCompetitionConfig(save, {
  target: open.id,
  plan: {
    approach: "All Out Attacks",
    decision: "Think Deeply",
    earlyDraw: true,
  },
  repertoire: {
    ...competitionOf(save).repertoire,
    white: [
      db.entries.find((e) => e.moves.length >= 12 && e.moves[0] === "e4")!.id,
    ],
  },
});
const prepared = prepareEvent(save, db);
assert(prepared.ok);
assert.equal(prepared.save.player.money, save.player.money - 40);
assert.equal(prepared.save.player.ap.current, 7);
assert.equal(prepared.save.training.hoursUsedToday, 3);
assert.equal(prepared.save.training.fatigue, 6);
assert(!prepareEvent(prepared.save, db).ok, "duplicate prepare rejected");
const p = buildPlayerProfile(save.player, 0, { white: [], black: [] });
const profile = applyPreparedProfile(p, prepared.save, open.id, db);
assert.equal(profile.style, "attacking");
assert.equal(profile.bookDepth, 12);
assert.equal(profile.earlyDraw, true);
assert.equal(bookMoveFor(profile, "white", [], createRng(1)), "e4");
assert.equal(applyPreparedProfile(p, prepared.save, "other-event", db), p);
assert(
  strengthForMove(profile, "opening", 0, 1).movetime >
    strengthForMove(p, "opening", 0, 1).movetime,
);
const times = {
  remainingMs: 1800000,
  incrementMs: 10000,
  ply: 20,
  fromBook: false,
  tc: open.details!.timeControl,
};
assert(
  thinkTimeMs(profile, createRng(3), times) >=
    thinkTimeMs(p, createRng(3), times),
);
const draft = setCompetitionConfig(prepared.save, {
  plan: { approach: "Rock Solid", decision: "Play Fast", earlyDraw: false },
});
assert.equal(
  applyPreparedProfile(p, draft, open.id, db).style,
  "attacking",
  "unpaid draft cannot replace paid snapshot",
);
assert(
  !prepareEvent(
    { ...save, player: { ...save.player, ap: { current: 0, max: 10 } } },
    db,
  ).ok,
);
assert(
  !prepareEvent(
    { ...save, training: { ...save.training, hoursUsedToday: 8 } },
    db,
  ).ok,
);
assert(!prepareEvent({ ...save, player: { ...save.player, money: 0 } }, db).ok);
const opponent = npcs.find((n) =>
  save.registrations[0].entrantIds!.includes(n.id),
)!;
const report = scoutOpponent(prepared.save, opponent, open.id);
assert(report.ok);
assert.equal(report.save.training.hoursUsedToday, 4);
assert(!scoutOpponent(report.save, opponent, open.id).ok);
assert.equal(
  JSON.stringify(upgradeSave(JSON.parse(JSON.stringify(report.save)))).includes(
    opponent.id,
  ),
  true,
);
assert(
  reasonableEarlyDraw({
    enabled: true,
    ply: 20,
    evalCp: 0,
    opponentStubborn: false,
    tournamentContext: true,
    drawUseful: true,
  }),
);
for (const patch of [
  { enabled: false },
  { evalCp: 26 },
  { ply: 19 },
  { opponentStubborn: true },
  { tournamentContext: false },
  { drawUseful: false },
])
  assert(
    !reasonableEarlyDraw({
      enabled: true,
      ply: 20,
      evalCp: 0,
      opponentStubborn: false,
      tournamentContext: true,
      drawUseful: true,
      ...patch,
    }),
  );
let winner = createTournament({
  event: open,
  player: { name: "QA", rating: 3000, country: "TH", title: "none" },
  npcs,
  seed: 7,
});
while (winner.status === "playing") winner = reportPlayerResult(winner, "win");
const awarded = archiveCompetition({ ...save, tournament: winner });
assert(
  competitionOf(awarded).qualifications.some((q) => q.kind === "grand-swiss"),
);
assert.equal(competitionOf(archiveCompetition(awarded)).archive.length, 1);
const entry = {
  tournamentId: winner.eventId,
  name: winner.name,
  level: winner.level,
  rank: 1,
  fieldSize: winner.players.length,
  points: 5,
  prize: 100,
};
const recorded = recordTournament({ ...save, tournament: winner }, entry);
assert.equal(recordTournament(recorded, entry), recorded, "prize idempotent");
assert.equal(
  competitionOf(
    archiveCompetition({ ...save, tournament: { ...winner, withdrawn: true } }),
  ).qualifications.length,
  0,
);
console.log(
  "PASS preparation: AP/money/hours/fatigue, snapshots, repertoire book moves, search budget, scout duplicates, migration, early draw, qualification/archive, prize idempotency",
);
console.log(
  `Complete verification passed (${(performance.now() - started).toFixed(1)} ms).`,
);

// Real MatchSession control flow, with a deterministic engine fixture (not a strength benchmark).
{
  const { MatchSession } = await import("../src/game/match/session.ts");
  const { buildMatchSetup } = await import("../src/game/match/setup.ts");
  const { acquireMatch, releaseMatch, matchRunning } = await import(
    "../src/store/matchLocks.ts"
  );
  const a = Symbol("A"),
    b = Symbol("B");
  assert(acquireMatch("qa-career", a));
  assert(!acquireMatch("qa-career", b));
  releaseMatch("qa-career", b);
  assert(matchRunning("qa-career"));
  releaseMatch("qa-career", a);
  assert(!matchRunning("qa-career"));
  const script =
    "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6b8 d2d4 b8d7".split(
      " ",
    );
  const t = active.save.tournament!;
  const setup = buildMatchSetup({
    save: active.save,
    npc: opponent,
    playerColor: "white",
    timeControl: {
      id: "none",
      label: "No clock",
      base: 0,
      increment: 0,
      category: "none",
    },
    rated: true,
    mode: "simulate",
    speed: "max",
    tournament: {
      id: t.eventId,
      name: t.name,
      level: t.level,
      round: t.rounds,
      rounds: t.rounds,
    },
    seed: 7,
    db,
  });
  setup.profiles.white = {
    ...setup.profiles.white,
    lines: { white: [], black: [] },
    earlyDraw: true,
    drawUseful: true,
  };
  setup.profiles.black = {
    ...setup.profiles.black,
    lines: { white: [], black: [] },
    stubborn: false,
  };
  let finished: import("../src/game/match/session.ts").MatchFinish | undefined;
  const session = new MatchSession({
    setup,
    db,
    autoAnalyze: false,
    liveEval: false,
    sleep: async () => {},
    engine: {
      search: async (req) => {
        const uci = script[req.moves.length] ?? "a2a3";
        return {
          best: uci,
          depth: 1,
          lines: [{ uci, cp: 0, mate: null, pv: [uci], depth: 1 }],
          engine: "builtin",
          engineName: "Deterministic test fixture",
        };
      },
    },
    onFinish: (f) => {
      finished = f;
    },
  });
  session.start();
  for (let i = 0; i < 100 && !finished; i++) await Promise.resolve();
  assert(finished);
  assert.equal(finished.termination, "agreement");
  assert.equal(finished.ucis.length, 20);
  session.dispose();
  console.log(
    "PASS MatchSession integration: 20-ply equal-position draw agreement; exclusive career match leases",
  );
}

// Round-robin rest rounds score zero; a championship ends when the lead is uncatchable.
{
  let rr = createTournament({
    event: {
      ...open,
      fieldSize: 7,
      details: { ...open.details!, format: "round-robin" },
    },
    player: { name: "QA", rating: 2000, country: "TH", title: "none" },
    npcs,
    seed: 17,
  });
  while (rr.status === "playing") rr = reportPlayerResult(rr, "draw");
  assert(
    rr.pairings
      .flat()
      .filter((p) => p.black === "bye")
      .every((p) => p.result === 0),
  );
  assert.equal(
    rr.players.reduce((sum, p) => sum + p.points, 0),
    (7 * 6) / 2,
  );
  let match = createTournament({
    event: {
      ...open,
      fieldSize: 2,
      details: { ...open.details!, format: "match" },
    },
    player: { name: "QA", rating: 2000, country: "TH", title: "none" },
    npcs,
    seed: 17,
  });
  while (match.status === "playing") match = reportPlayerResult(match, "win");
  assert.equal(match.round, 8);
  assert.equal(match.finalRank, 1);
  console.log(
    "PASS round-robin zero-point rest rounds and championship clinch after eight wins",
  );
}

{
  const { expireCompetition } = await import(
    "../src/game/competition/calendar.ts"
  );
  const { stampFromIndex, stampIndex } = await import(
    "../src/game/competition/catalog.ts"
  );
  const running = active.save;
  assert.equal(expireCompetition(running), running);
  const advanced = {
    ...running,
    world: {
      ...running.world,
      date: stampFromIndex(stampIndex(running.tournament!.details!.end) + 1),
    },
  };
  const expired = expireCompetition(advanced);
  assert.equal(expired.tournament?.status, "finished");
  assert.equal(expired.tournament?.withdrawn, true);
  assert.equal(expired.player.money, advanced.player.money);
  assert.equal(expired.history.tournaments.length, 1);
  assert.equal(competitionOf(expired).qualifications.length, 0);
  assert.equal(expireCompetition(expired), expired);
  console.log(
    "PASS calendar: overdue event forfeits exactly once, without prize or qualification",
  );
}

{
  const historical = events.find((e) => e.id === "career-candidates-2024")!;
  assert.equal(historical.week, 14);
  assert.equal(historical.details?.location, "Toronto");
  assert.equal(historical.details?.historicalSchedule?.startDate, "2024-04-03");
  assert.equal(historical.details?.format, "double-round-robin");
  console.log(
    "PASS verified 2024 Candidates dates/venue/format; simulated career fields remain labelled",
  );
}

{
  const sicilian = db.entries.find(
    (e) => e.moves[0] === "e4" && e.moves[1] === "c5" && e.moves.length >= 4,
  )!;
  const kingPawn = db.entries.find(
    (e) => e.moves[0] === "e4" && e.moves[1] === "e5" && e.moves.length >= 4,
  )!;
  const dutch = db.entries.find(
    (e) =>
      e.side === "black" &&
      e.moves[0] === "d4" &&
      e.moves[1] === "f5" &&
      e.moves.length >= 4,
  )!;
  const s = competitionOf(prepared.save);
  const configured = {
    ...prepared.save,
    competition: {
      ...s,
      prepared: {
        ...s.prepared!,
        repertoire: {
          ...s.prepared!.repertoire,
          black: [kingPawn.id],
          "vs-e4": [sicilian.id],
          backups: [dutch.id],
        },
      },
    },
  };
  const profile = applyPreparedProfile(p, configured, open.id, db);
  assert.equal(bookMoveFor(profile, "black", ["e4"], createRng(1)), "c5");
  assert.equal(bookMoveFor(profile, "black", ["d4"], createRng(1)), "f5");
  console.log(
    "PASS response overrides general black repertoire; backup follows off-primary move sequence",
  );
}

// A repeat bye must not be preferred merely to satisfy a colour preference.
for (let trial = 0; trial < 100; trial++) {
  const field = players(7);
  for (let a = 0; a < 7; a++) {
    field[a].colors = [rng.pick([-1, 1]), rng.pick([-1, 1])];
    if (rng.chance(0.4)) field[a].opponents.push("bye");
    for (let b = a + 1; b < 7; b++)
      if (rng.chance(0.25)) {
        field[a].opponents.push(field[b].id);
        field[b].opponents.push(field[a].id);
      }
  }
  const canAvoid = field.some(
    (bye) =>
      !bye.opponents.includes("bye") &&
      (() => {
        const pool = field.filter((p) => p !== bye);
        const graph = pool.map((p, i) =>
          pool
            .map((q, j) => j)
            .filter((j) => i !== j && !p.opponents.includes(pool[j].id)),
        );
        return oracle(
          graph,
          graph.map((_, i) => i),
        );
      })(),
  );
  if (canAvoid) {
    const pairs = swissPairings(field, 3),
      bye = pairs.find((p) => p.black === "bye")!;
    assert(!field.find((p) => p.id === bye.white)!.opponents.includes("bye"));
  }
}
console.log("PASS Swiss bye priority across 100 adversarial odd fields");
