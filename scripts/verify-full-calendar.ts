import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { randomAppearance } from "../src/data/appearance.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs.ts";
import { localCompetitors } from "../src/game/npc/localPool.ts";
import {
  annualEvents,
  advanceCalendarTournaments,
  calendarBusyIds,
} from "../src/game/competition/worldCalendar.ts";
import {
  gameDay,
  bookedStart,
  dayStamp,
} from "../src/game/competition/agenda.ts";
import { endDay } from "../src/game/training/engine.ts";
import {
  createTournament,
  completeRound,
} from "../src/game/match/tournament.ts";
import { updateBroadcast } from "../src/game/competition/broadcast.ts";
import { createBackup, parseBackup } from "../src/store/backup.ts";
import { getSeedCities } from "../src/data/world/seedCities.ts";
import { COUNTRIES } from "../src/data/world/countries.ts";
import { getMajorCities } from "../src/game/world/citySearch.ts";
import { GAME_CONFIG } from "../src/data/config.ts";
import "../src/game/match/chessjs.ts";
const options = {
  name: "Full Calendar QA",
  gender: "male" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: randomAppearance(),
  startYear: 2026,
  alternateHistory: false,
};
let save = createNewSave(options, createCareerRecord(options));
let npcs = [
  ...buildWorldNpcs(2026),
  ...localCompetitors("TH", "Bangkok", 2026),
];
const events = annualEvents(save, 2026);
assert(events.length > 100);
assert.equal(events.filter((e) => e.details?.format === "team").length, 20);
assert(events.some((e) => e.name.includes("World Cup")));
assert(events.some((e) => e.name.includes("Open Board Rotation")));
const started = performance.now();
const records = new Map<
  string,
  NonNullable<typeof save.tournamentArchivePending>[number]
>();
let games = 0,
  national = 0,
  regular = 0;
for (let day = 0; day < 364; day++) {
  const before = save;
  const result = advanceCalendarTournaments(before, endDay(before).save, npcs);
  const byId = new Map(result.changed.map((n) => [n.id, n]));
  npcs = npcs.map((n) => byId.get(n.id) ?? n);
  // An ordinary reload / repeated settlement never runs a completed day again.
  const replay = advanceCalendarTournaments(
    { ...result.save, world: before.world },
    result.save,
    npcs,
  );
  assert.equal(replay.save, result.save);
  assert.equal(replay.changed.length, 0);
  for (const r of result.save.tournamentArchivePending ?? []) {
    assert(!records.has(r.id), "each scheduled event is archived only once");
    assert(r.players.length >= 2 && r.players.every((p) => p.name));
    assert(
      r.players.every((p) => p.id !== "player"),
      "unattended events do not enter the human",
    );
    records.set(r.id, r);
    if (r.kind === "national") {
      national++;
      assert(
        r.players.every((p) => p.members?.length),
        "all actual team rosters are kept",
      );
      assert(r.teamBoards?.length);
    } else {
      regular++;
      assert(r.pairings.length);
      assert(r.pairings.flat().every((p) => p.result !== null));
      games += r.pairings.flat().filter((p) => p.black !== "bye").length;
      const count = r.pairings.flat().filter((p) => p.black !== "bye").length;
      const actual = npcs
        .filter((n) => r.players.some((p) => p.id === n.id))
        .reduce(
          (s, n) =>
            s +
            (n.tournamentHistory.find((h) => h.eventId === r.id)?.games ?? 0),
          0,
        );
      assert.equal(
        actual,
        count * 2,
        "each board is counted once for each NPC",
      );
    }
  }
  const playing = result.save.calendarTournaments?.active ?? [];
  const people = playing.flatMap((t) => t.players.map((p) => p.id));
  assert.equal(
    new Set(people).size,
    people.length,
    "active individual events have no overlapping participants",
  );
  assert(
    playing.every((t) =>
      t.players.every((p) => calendarBusyIds(result.save).has(p.id)),
    ),
  );
  assert.equal(result.save.player.rating, before.player.rating);
  assert.equal(result.save.history.games.length, 0);
  assert.equal(result.save.history.tournaments.length, 0);
  assert.equal(result.save.pendingMatch, null);
  save = { ...result.save, tournamentArchivePending: [] }; // emulate a successful IndexedDB flush
}
assert(
  regular > 80 && national >= 15,
  `broad calendar coverage: ${regular} regular, ${national} national`,
);
assert([...records.values()].some((r) => r.name.includes("World Cup")));
assert([...records.values()].some((r) => r.name.includes("Candidates")));
assert([...records.values()].some((r) => r.name.includes("African Games")));
assert([...records.values()].some((r) => r.format === "round-robin-bo3"));
assert([...records.values()].some((r) => r.format === "knockout"));
assert(npcs.some((n) => (n.competitionStats?.draws ?? 0) > 0));
console.log(
  `PASS full 364-day calendar: ${events.length} scheduled entries, ${regular} regular and ${national} national events recorded, ${games} regular boards, all rosters/names, NPC histories and ratings without human games. ${Math.round(performance.now() - started)} ms.`,
);

const base = createNewSave(options, createCareerRecord(options));
const e = annualEvents(base, 2026).find((e) => e.id === "rotation-2026-2-0")!;
const s = dayStamp(bookedStart(e));
const onDay = {
  ...base,
  world: { ...base.world, date: { year: s.year, week: s.week }, day: s.day },
};
const reserved = {
  ...onDay,
  registrations: [
    {
      eventId: e.id,
      name: e.name,
      year: e.year,
      week: e.week,
      level: e.level,
      fieldSize: e.fieldSize,
      entryFee: 0,
      details: e.details,
      entrantIds: npcs.slice(0, 11).map((n) => n.id),
    },
  ],
};
const skipped = advanceCalendarTournaments(
  reserved,
  endDay(reserved).save,
  npcs,
);
assert(
  !skipped.save.calendarTournaments!.active.some((t) => t.eventId === e.id),
);
assert(!skipped.save.tournamentArchivePending?.some((t) => t.id === e.id));
assert(
  !advanceCalendarTournaments(
    onDay,
    endDay(onDay).save,
    npcs,
  ).save.tournamentArchivePending?.some((r) => r.startDay < gameDay(onDay)),
  "upgrading does not generate previous weeks",
);
// The same normal tournament engine handles NPC-only RR, BO3 and knockout without a fictitious human.
for (const format of [
  "swiss",
  "round-robin",
  "double-round-robin",
  "round-robin-bo3",
  "knockout",
  "match",
] as const) {
  let t = createTournament({
    npcOnly: true,
    event: {
      ...e,
      fieldSize: format === "match" ? 2 : 7,
      details: { ...e.details!, format },
    },
    player: { name: "", rating: 1000, title: "none", country: "TH" },
    npcs,
    fieldIds: npcs
      .filter(
        (n) => n.careerStatus === "active" || n.careerStatus === "semi-retired",
      )
      .slice(0, format === "match" ? 2 : 7)
      .map((n) => n.id),
    seed: 7,
  });
  assert.equal(t.status, "playing");
  while (t.status === "playing") t = completeRound(t, null);
  assert.equal(t.finalRank, null);
  assert.equal(t.prize, 0);
  assert(t.players.every((p) => p.id !== "player" && !p.isPlayer));
}
// Watched results in a world calendar event persist and are settled by the same day progression.
let running = advanceCalendarTournaments(onDay, endDay(onDay).save, npcs).save;
const t = running.calendarTournaments!.active.find((t) => t.eventId === e.id)!;
assert(t && t.status === "playing");
const p = t.pairings[t.round - 1][0];
running = updateBroadcast(
  running,
  {
    careerId: running.career.id,
    eventId: t.eventId,
    round: t.round,
    board: 0,
    white: p.white,
    black: p.black,
  },
  {
    ucis: ["f2f3", "e7e5", "g2g4", "d8h4"],
    clocks: { white: 1000, black: 1000 },
    rngState: 31,
    result: "black",
    termination: "checkmate",
  },
);
assert.equal(
  running.calendarTournaments!.active.find((x) => x.eventId === e.id)!.pairings[
    t.round - 1
  ][0].result,
  0,
);
const copy = await parseBackup(
  JSON.stringify(await createBackup(running, npcs)),
);
assert.deepEqual(
  copy.payload.save.calendarTournaments,
  running.calendarTournaments,
);
assert.equal(copy.payload.save.tournament, base.tournament);
console.log(
  "PASS reserved human events, no invented old results, six NPC-only pairing formats, calendar live checkpoint and full backup.",
);

const normalize = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
const seeds = readFileSync(
  new URL("../src/data/world/seedCities.ts", import.meta.url),
  "utf8",
).match(/const RAW = `([\s\S]*?)`;/)![1];
const old = new Map(
  seeds
    .trim()
    .split("\n")
    .map((l) => {
      const [code, names] = l.split(":");
      return [code.trim(), names.split(",").map((n) => n.trim())] as const;
    }),
);
const index = JSON.parse(
  readFileSync(
    new URL("../public/data/cities/index.json", import.meta.url),
    "utf8",
  ),
);
let expanded = 0,
  limited = 0;
for (const country of COUNTRIES) {
  const names = getSeedCities(country.code),
    originals = old.get(country.code) ?? [];
  for (const name of originals)
    assert(names.includes(name), "curated city remains available");
  assert.equal(new Set(names.map(normalize)).size, names.length);
  if (index.countries[country.code] >= 70) {
    assert(names.length >= originals.length + 50, country.code);
  }
  if (names.length >= originals.length + 50) expanded++;
  else limited++;
}
for (const code of ["TH", "US", "IN", "FR", "GB-ENG", "GB-SCO", "GB-WLS"])
  assert(index.countries[code] > 62);
const cities = Array.from({ length: 100 }, (_, i) => ({
  name: `Place ${i}`,
  population: 100 - i,
}));
assert.equal(getMajorCities(cities).length, 100);
console.log(
  `PASS city expansion: 50 additional distinct seed cities in ${expanded} countries/federations; ${limited} smaller/missing datasets retain all available real places and custom input. No default city-list cap, separate England/Scotland/Wales data.`,
);
