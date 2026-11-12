import assert from "node:assert/strict";
import { randomAppearance } from "../src/data/appearance.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs.ts";
import { rotatingEvents, dayStamp } from "../src/game/competition/agenda.ts";
import {
  createTournament,
  reportPlayerResult,
  completeRound,
} from "../src/game/match/tournament.ts";
import { updateBroadcast } from "../src/game/competition/broadcast.ts";
import { MatchSession } from "../src/game/match/session.ts";
import { buildNpcProfile } from "../src/game/match/npcProfile.ts";
import { getBaseOpeningDatabase } from "../src/game/openings/database.ts";
import { createRng } from "../src/game/rng.ts";
import {
  archiveTournament,
  historyYears,
  eventKind,
  retainedArchives,
} from "../src/game/competition/archive.ts";
import { archiveCompetition } from "../src/game/competition/preparation.ts";
import { simulateWorldCircuit } from "../src/game/npc/activity.ts";
import { createBackup, parseBackup } from "../src/store/backup.ts";
import "../src/game/match/chessjs.ts";
const options = {
  name: "Spectator QA",
  gender: "male" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: randomAppearance(),
  startYear: 2026,
  alternateHistory: false,
};
const base = createNewSave(options, createCareerRecord(options));
assert.deepEqual(historyYears(base), [2025, 2026]);
assert(!historyYears(base).includes(2027));
assert(
  historyYears({
    ...base,
    world: { ...base.world, date: { year: 2027, week: 1 } },
  }).includes(2027),
);
assert.equal(eventKind({ details: { format: "team" } }), "national");
assert.equal(eventKind({ details: { format: "swiss" } }), "regular");
const npcs = buildWorldNpcs(2026).filter((n) => n.careerStatus === "active");
const event = rotatingEvents(
  base.world.date,
  { city: "Bangkok", countryCode: "TH", continent: "Asia", demonym: "Thai" },
  52,
).find((e) => e.id === "rotation-2026-2-0")!;
let tournament = createTournament({
  event,
  player: {
    name: base.player.name,
    rating: 1000,
    country: "TH",
    title: "none",
  },
  npcs,
  fieldIds: npcs.slice(0, 11).map((n) => n.id),
  seed: 71,
});
const date = {
  year: event.year,
  week: event.week,
  day: event.details!.agenda!.startDay,
};
let save = {
  ...base,
  world: {
    ...base.world,
    date: { year: date.year, week: date.week },
    day: date.day,
  },
  tournament,
};
const index = tournament.pairings[0].findIndex(
  (p) => p.white !== "player" && p.black !== "player" && p.black !== "bye",
);
const pair = tournament.pairings[0][index];
const context = {
  careerId: save.career.id,
  eventId: tournament.eventId,
  round: 1,
  board: index,
  white: pair.white,
  black: pair.black,
};
const checkpoint = {
  ucis: ["f2f3", "e7e5", "g2g4"],
  clocks: { white: 45000, black: 47000 },
  rngState: 12345,
};
save = updateBroadcast(save, context, checkpoint) as typeof save;
assert.deepEqual(
  save.tournament!.pairings[0][index].broadcast!.ucis,
  checkpoint.ucis,
);
assert.equal(save.player.ap.current, base.player.ap.current);
assert.equal(save.player.rating, base.player.rating);
assert.equal(save.history.games.length, 0);
assert.equal(updateBroadcast(save, { ...context, round: 2 }, checkpoint), save);
assert.equal(
  updateBroadcast(save, { ...context, careerId: "other" }, checkpoint),
  save,
);
assert.equal(
  updateBroadcast(save, context, { ...checkpoint, ucis: ["e2e4"] }),
  save,
);
assert.equal(
  updateBroadcast(save, context, {
    ...checkpoint,
    ucis: [...checkpoint.ucis, "e2e8"],
  }),
  save,
);
const w = save.tournament!.players.find((p) => p.id === pair.white)!,
  b = save.tournament!.players.find((p) => p.id === pair.black)!;
const side = (p: typeof w) => ({
  id: p.id,
  name: p.name,
  elo: p.elo,
  title: p.title,
  countryCode: p.countryCode,
  nationality: p.countryCode,
  flag: "",
  isPlayer: false,
});
const profile = (id: string) => ({
  ...buildNpcProfile(
    npcs.find((n) => n.id === id)!,
    { white: [], black: [] },
    { rng: createRng(1) },
  ),
  bookDepth: 0,
  stubborn: true,
});
let final: any = null;
const session = new MatchSession({
  setup: {
    white: side(w),
    black: side(b),
    playerColor: "white",
    timeControl: {
      id: "broadcast",
      label: "60+0",
      base: 60,
      increment: 0,
      category: "blitz",
    },
    rated: false,
    tournament: null,
    accuracyBonus: 0,
    mode: "simulate",
    speed: "max",
    seed: 1,
    profiles: { white: profile(w.id), black: profile(b.id) },
  },
  initialState: checkpoint,
  db: getBaseOpeningDatabase(),
  engine: {
    search: async () => ({
      best: "d8h4",
      depth: 5,
      engineName: "fixture",
      lines: [{ uci: "d8h4", pv: ["d8h4"], depth: 5, mate: 1, cp: null }],
    }),
  } as any,
  autoAnalyze: false,
  liveEval: false,
  onFinish: (f) => {
    final = f;
  },
});
assert.equal(session.getSnapshot().game.ucis.length, 3);
assert.equal(session.getSnapshot().turn, "black");
assert.equal(session.clocks().white, 45000);
session.start();
for (let i = 0; i < 100 && !final; i++)
  await new Promise((r) => setTimeout(r, 10));
assert(final);
assert.equal(final.result, "black");
assert.equal(final.termination, "checkmate");
const done = session.broadcastState();
session.dispose();
save = updateBroadcast(save, context, done) as typeof save;
assert.equal(save.tournament!.pairings[0][index].result, 0);
assert.equal(
  save.tournament!.pairings[0][index].broadcast!.ucis.at(-1),
  "d8h4",
);
assert.equal(
  updateBroadcast(save, context, done),
  save,
  "A finished board cannot be settled twice",
);
const roundDone = completeRound(save.tournament!, 0.5);
assert.equal(
  roundDone.pairings[0][index].result,
  0,
  "Player finishing the round must keep the watched result",
);
assert.equal(roundDone.players.find((p) => p.id === b.id)!.points, 1);
let t = roundDone;
while (t.status === "playing") t = reportPlayerResult(t, "draw");
const archived = archiveCompetition({ ...save, tournament: t });
assert(archived.tournamentArchivePending?.some((e) => e.id === event.id));
const record = archiveTournament(t);
assert.equal(record.pairings[0][index].broadcast!.result, "black");
const circuit = simulateWorldCircuit(base, npcs.slice(0, 24));
assert(circuit.archives.length > 0);
for (const e of circuit.archives) {
  assert(e.pairings.length > 0);
  for (const p of e.players) {
    const points = e.pairings
      .flat()
      .reduce(
        (sum, b) =>
          sum +
          (b.white === p.id
            ? (b.result ?? 0)
            : b.black === p.id
              ? 1 - (b.result ?? 0)
              : 0),
        0,
      );
    assert.equal(points, p.points);
  }
}
const backup = await parseBackup(
  JSON.stringify(await createBackup(archived, npcs.slice(0, 11))),
);
assert(backup.payload.tournamentArchive?.some((e) => e.id === event.id));
assert.equal(
  retainedArchives(archived).find((e) => e.id === event.id)!.pairings[0][index]
    .result,
  0,
);
console.log(
  "PASS year limits, event categories, live legal NPC game, saved moves/clocks/RNG, cross-career/round/player-write guards, immutable watched result, one-time settlement, archive outbox, actual world standings/pairings and full backup roundtrip.",
);
