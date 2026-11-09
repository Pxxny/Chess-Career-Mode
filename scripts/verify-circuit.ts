import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { randomAppearance } from "../src/data/appearance.ts";
import { NATIONAL_NAMES } from "../src/data/world/nationalNames.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import { upgradeSave } from "../src/game/training/migrate.ts";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs.ts";
import { localCompetitors } from "../src/game/npc/localPool.ts";
import { recruitForYear } from "../src/game/npc/population.ts";
import { upgradeNpcIdentities } from "../src/game/npc/identity.ts";
import { syncNpcSaveNames } from "../src/game/npc/saveNames.ts";
import { getSchedule } from "../src/game/world/schedule.ts";
import {
  registrationCount,
  entryDay,
} from "../src/game/competition/entries.ts";
import { stampFromIndex, stampIndex } from "../src/game/competition/catalog.ts";
import { registrationIssue } from "../src/game/competition/eligibility.ts";
import { showcaseSelection } from "../src/game/competition/showcase.ts";
import { matchesTournamentSearch } from "../src/game/competition/finder.ts";
import {
  registerForEvent,
  previewEntrants,
  startRegisteredTournament,
  cancelRegistration,
} from "../src/game/match/registration.ts";
import type { GameSave } from "../src/types/index.ts";
const timings: Record<string, number> = {};
let at = performance.now();
const options = {
  name: "Circuit QA",
  gender: "male" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: randomAppearance(),
  startYear: 2026,
  alternateHistory: false,
  birthPlace: { countryCode: "JP", city: "Osaka" },
};
const career = { ...createCareerRecord(options), id: "circuit-test" };
const base = createNewSave(options, career);
const npcs = upgradeNpcIdentities([
  ...buildWorldNpcs(2026),
  ...localCompetitors("TH", "Bangkok", 2026),
  ...recruitForYear(2027),
]);
timings.worldAndIdentities = performance.now() - at;
assert.equal(
  new Set(npcs.map((n) => n.name)).size,
  npcs.length,
  "full names are unique across global, local and annual cohorts",
);
for (const n of npcs.filter(
  (n) => n.kind === "fictional" && n.nationality === "TH",
)) {
  const [first, last] = n.name.split(" ");
  assert(
    (n.gender === "male"
      ? NATIONAL_NAMES.TH.male
      : NATIONAL_NAMES.TH.female
    ).includes(first),
  );
  assert(NATIONAL_NAMES.TH.surnames.includes(last));
  assert(n.birthPlace?.city);
}
const th = npcs.filter((n) => n.nationality === "TH" && n.kind === "fictional");
console.log(
  `Thai NPCs: ${th.length}; distinct given names: ${new Set(th.map((n) => n.name.split(" ")[0])).size}; distinct surnames: ${new Set(th.map((n) => n.name.split(" ").at(-1))).size}`,
);
const legacy = npcs.map((n) =>
  n.kind === "legend"
    ? n
    : {
        ...n,
        name: n.nationality === "TH" ? "Fajar Santoso" : n.name,
        nameVersion: undefined,
        birthPlace: undefined,
      },
);
at = performance.now();
const upgraded = upgradeNpcIdentities(legacy);
timings.legacyIdentityUpgrade = performance.now() - at;
assert.equal(new Set(upgraded.map((n) => n.name)).size, upgraded.length);
assert.equal(
  upgradeNpcIdentities(upgraded),
  upgraded,
  "identity migration is idempotent and retains references",
);
assert.deepEqual(
  upgraded.map((n) => [
    n.id,
    n.currentElo,
    n.peakElo,
    n.dateOfBirth,
    n.tournamentHistory,
  ]),
  legacy.map((n) => [
    n.id,
    n.currentElo,
    n.peakElo,
    n.dateOfBirth,
    n.tournamentHistory,
  ]),
);
assert.deepEqual(
  upgraded.filter((n) => n.kind === "legend"),
  legacy.filter((n) => n.kind === "legend"),
);
assert(
  upgraded
    .filter((n) => n.nationality === "TH")
    .every((n) => n.name !== "Fajar Santoso"),
);
assert.deepEqual(base.player.birthPlace, {
  countryCode: "JP",
  city: "Osaka",
  source: "chosen",
});
assert.deepEqual(
  upgradeSave({
    ...base,
    player: {
      ...base.player,
      country: "DE",
      city: { name: "Berlin", custom: false },
    },
  }).player.birthPlace,
  base.player.birthPlace,
);
assert.equal(
  upgradeSave({ ...base, player: { ...base.player, birthPlace: undefined } })
    .player.birthPlace?.countryCode,
  "TH",
);
console.log(
  "PASS cultural names, duplicate handling, additive/idempotent NPC upgrade and independent birth place",
);

const schedule = getSchedule(
  base.world.date,
  { city: "Bangkok", countryCode: "TH", demonym: "Thai", continent: "Asia" },
  career.id,
  52,
);
assert(
  schedule.every(
    (e) =>
      e.details?.organizer?.name &&
      ["Official", "Unofficial"].includes(e.details.organizer.status),
  ),
);
assert(schedule.some((e) => e.details?.organizer?.status === "Official"));
assert(schedule.some((e) => e.details?.organizer?.status === "Unofficial"));
const open = schedule.find(
  (e) => e.level === "local" && e.fieldSize === 32 && e.minElo === 0,
)!;
assert(open);
const close = (stampIndex(open.registrationDeadline) + 1) * 7 - 1;
function onDay(save: GameSave, day: number): GameSave {
  return {
    ...save,
    world: {
      ...save.world,
      date: stampFromIndex(Math.floor(day / 7)),
      day: (day % 7) + 1,
    },
  };
}
let previous: string[] = [];
for (let day = close - 70; day <= close; day++) {
  const save = onDay(base, day),
    field = previewEntrants(save, open, npcs);
  assert(field.length <= open.fieldSize && field.length >= previous.length);
  assert.deepEqual(
    field.slice(0, previous.length).map((n) => n.id),
    previous,
    "arrivals append without replacing existing identities",
  );
  assert.deepEqual(
    previewEntrants(
      { ...save, player: { ...save.player, rating: 3000 } },
      open,
      npcs,
    ),
    field,
    "player strength does not change the announced field",
  );
  previous = field.map((n) => n.id);
}
const fullEvent = Array.from({ length: 100 }, (_, i) => ({
  ...open,
  id: `capacity-case-${i}`,
})).find(
  (e) => registrationCount(onDay(base, close - 2), e, npcs) === e.fieldSize,
)!;
assert(fullEvent, "some events fill before the deadline");
const fullSave = onDay(base, close - 2);
assert.match(registrationIssue(fullSave, fullEvent, npcs) ?? "", /full/);
assert(!registerForEvent(fullSave, fullEvent, npcs).ok);
assert(
  !registerForEvent(JSON.parse(JSON.stringify(fullSave)), fullEvent, npcs).ok,
  "reload cannot reopen a full tournament",
);
const early = onDay(base, close - 40),
  paid = registerForEvent(early, fullEvent, npcs);
assert(paid.ok);
assert(
  !registerForEvent(paid.save, fullEvent, npcs).ok,
  "spam cannot charge/register twice",
);
const eventSave = onDay(paid.save, stampIndex(fullEvent) * 7);
const finalField = previewEntrants(eventSave, fullEvent, npcs);
assert.equal(finalField.length, fullEvent.fieldSize - 1);
const started = startRegisteredTournament(eventSave, fullEvent.id, npcs, 4);
assert(started.ok && started.save.tournament);
assert.deepEqual(
  started.save.tournament.players.filter((p) => !p.isPlayer).map((p) => p.id),
  finalField.map((n) => n.id),
);
assert.equal(started.save.tournament.players.length, fullEvent.fieldSize);
const oldRival = started.save.tournament.players.find((p) => !p.isPlayer)!;
const oldSave = {
  ...started.save,
  npcNameVersion: undefined,
  tournament: {
    ...started.save.tournament,
    players: started.save.tournament.players.map((p) =>
      p.id === oldRival.id ? { ...p, name: "Fajar Santoso" } : p,
    ),
  },
};
const linked = syncNpcSaveNames(oldSave, npcs);
assert.equal(
  linked.tournament!.players.find((p) => p.id === oldRival.id)?.name,
  oldRival.name,
);
assert.deepEqual(linked.tournament!.pairings, oldSave.tournament.pairings);
assert.deepEqual(linked.player, oldSave.player);
assert.equal(syncNpcSaveNames(linked, npcs), linked);
assert.equal(
  cancelRegistration(paid.save, fullEvent.id).player.money,
  early.player.money,
);
console.log(
  "PASS daily monotonic registration, stable arrivals, full events, reload/spam guards, reserved paid seat and final roster",
);

const show = schedule.find((e) => e.details?.showcase)!;
assert(show);
const inviteSave = {
  ...base,
  player: { ...base.player, age: 20, rating: 3500, money: 100000 },
};
const selection = showcaseSelection(inviteSave, show, npcs);
assert(selection.invited);
assert(selection.countries <= 50 && selection.entrants.length <= 249);
const nationalityCount = new Map<string, number>([["TH", 1]]);
for (const n of selection.entrants) {
  assert(n.age <= 25);
  nationalityCount.set(
    n.nationality,
    (nationalityCount.get(n.nationality) ?? 0) + 1,
  );
}
assert([...nationalityCount.values()].every((n) => n <= 5));
assert(
  !registerForEvent(inviteSave, show, npcs).ok,
  "public registration is blocked even for a selected player",
);
const accepted = registerForEvent(inviteSave, show, npcs, true);
assert(accepted.ok && accepted.save.registrations[0].invitationAccepted);
assert(
  !registerForEvent(
    { ...inviteSave, player: { ...inviteSave.player, age: 26 } },
    show,
    npcs,
    true,
  ).ok,
);
assert(
  !registerForEvent(
    { ...inviteSave, player: { ...inviteSave.player, rating: 100 } },
    show,
    npcs,
    true,
  ).ok,
);
const showStarted = startRegisteredTournament(
  onDay(accepted.save, stampIndex(show) * 7),
  show.id,
  npcs,
  3,
);
assert(showStarted.ok && showStarted.save.tournament?.rounds === 10);
assert.deepEqual(
  new Set(
    showStarted.save.tournament.players
      .filter((p) => !p.isPlayer)
      .map((p) => p.id),
  ),
  new Set(selection.entrants.map((n) => n.id)),
);
console.log(
  "PASS real organizer selection, nationality quota, age/rating boundaries, accept-only invitation and 10-round showcase",
);

const filter = {
  fromWeek: open.weeksUntilStart,
  toWeek: open.weeksUntilStart,
  minElo: open.minElo,
  maxElo: open.minElo,
  continent: "Asia",
  minPlayers: open.fieldSize,
  maxPlayers: open.fieldSize,
  availableOnly: false,
};
assert(matchesTournamentSearch(open, filter));
assert(!matchesTournamentSearch(open, { ...filter, continent: "Europe" }));
assert(
  !matchesTournamentSearch(open, {
    ...filter,
    toWeek: open.weeksUntilStart - 1,
  }),
);
assert(
  !matchesTournamentSearch(open, { ...filter, maxPlayers: open.fieldSize - 1 }),
);
at = performance.now();
for (let i = 0; i < 100; i++)
  for (const e of schedule) {
    matchesTournamentSearch(e, filter);
    registrationCount(base, e, npcs);
  }
timings.catalogueFilterAndCountsPerPass = (performance.now() - at) / 100;
assert.equal(entryDay(onDay(base, close)), close);
console.log(
  "PASS inclusive tournament finder boundaries and organizer metadata",
);
console.log(
  JSON.stringify(
    {
      timingsMs: timings,
      npcs: npcs.length,
      events: schedule.length,
      showcaseCountries: selection.countries,
      showcasePlayers: selection.entrants.length + 1,
    },
    null,
    2,
  ),
);
