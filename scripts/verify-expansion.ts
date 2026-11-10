import assert from "node:assert/strict";
import { registrationIssue } from "../src/game/competition/eligibility.ts";
import {
  APPEARANCE_OPTIONS,
  DEFAULT_APPEARANCE,
  optionsForGender,
  randomAppearance,
} from "../src/data/appearance";
import { renderPortraitSvg } from "../src/game/appearance/portraitSvg";
import { LEGENDS } from "../src/data/chess/legends";
import { createCareerRecord } from "../src/game/career/createCareer";
import { createNewSave } from "../src/game/createNewSave";
import { upgradeSave } from "../src/game/training/migrate";
import { endDay, performSession } from "../src/game/training/engine";
import { advancePopulation, recruitForYear } from "../src/game/npc/population";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs";
import { applyWorldState } from "../src/game/npc/worldState";
import {
  activeCoach,
  coachedGame,
  coachFee,
  COACHES,
  federationTeams,
  hireCoach,
  joinFederation,
  playTeamCup,
  stateOf,
  weeklyCircuit,
} from "../src/game/career/expansion";
import {
  previewEntrants,
  registerForEvent,
  startRegisteredTournament,
} from "../src/game/match/registration";
import { getSchedule } from "../src/game/world/schedule";
import { createRng } from "../src/game/rng";

const opts = {
  name: "Expansion Test",
  gender: "undisclosed" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: DEFAULT_APPEARANCE,
  startYear: 2026,
  alternateHistory: false,
};
const base = createNewSave(opts, createCareerRecord(opts));
for (const gender of ["male", "female"]) {
  const added = Object.entries(APPEARANCE_OPTIONS).flatMap(([field, os]) =>
    os
      .filter(
        (o) =>
          o.id.startsWith(`${gender}-`) ||
          o.id.startsWith("extra-accessory-") ||
          o.id.startsWith("palette-"),
      )
      .map((o) => ({ field: field as keyof typeof DEFAULT_APPEARANCE, o })),
  );
  assert.equal(added.length, 50, `${gender}:50new choices`);
  for (const { field, o } of added) {
    const original = renderPortraitSvg(DEFAULT_APPEARANCE),
      changed = renderPortraitSvg({ ...DEFAULT_APPEARANCE, [field]: o.id });
    assert.notEqual(changed, original, `${field}:${o.id} is rendered`);
  }
  const r = createRng(982);
  for (let i = 0; i < 200; i++) {
    const a = randomAppearance(r.next, gender);
    assert(a.hairStyle.startsWith(`${gender}-`));
    assert(a.clothing.startsWith(`${gender}-`));
    if (gender === "female") assert.equal(a.facialHair, "none");
  }
  assert(
    optionsForGender("hairStyle", gender).every(
      (o) => !o.id.startsWith(gender === "female" ? "male-" : "female-"),
    ),
  );
}
assert(LEGENDS.length >= 80);
assert.equal(new Set(LEGENDS.map((l) => l.slug)).size, LEGENDS.length);
assert(LEGENDS.filter((l) => Number(l.dob.slice(0, 4)) >= 1980).length >= 30);
const world = buildWorldNpcs(2026);
for (const year of [2027, 2028, 2050]) {
  const rows = recruitForYear(year);
  assert(rows.length >= 100 && rows.length <= 250);
  assert.deepEqual(rows, recruitForYear(year));
  assert(
    rows.every(
      (n) => n.careerStartYear === year && n.tournamentHistory.length === 0,
    ),
  );
}
const expanded = advancePopulation(world, 2026, 2028);
assert(
  expanded.length >= world.length + 200 &&
    expanded.length <= world.length + 500,
);
assert.strictEqual(advancePopulation(expanded, 2026, 2028), expanded);
assert.equal(new Set(expanded.map((n) => n.id)).size, expanded.length);
const aged = applyWorldState(world, {
  year: 2100,
  week: 1,
  alternateHistory: false,
});
assert(
  aged
    .filter((n) => n.kind === "fictional")
    .every((n) => n.careerStatus === "retired" && n.worldRank === null),
);
const migrated = upgradeSave({ ...base, expansion: undefined });
assert.equal(stateOf(migrated).coach, null);
const member = joinFederation(base);
assert(member.ok);
assert.equal(member.save.player.money, base.player.money - 35);
assert(!joinFederation(member.save).ok);
for (const term of ["game", "week", "month"] as const) {
  const r = hireCoach(base, COACHES[0].id, term);
  assert(r.ok);
  assert.equal(
    r.save.player.money,
    base.player.money - coachFee(base, COACHES[0], term),
  );
  assert(!hireCoach(r.save, COACHES[1].id, term).ok);
  assert(activeCoach(r.save));
  if (term !== "game") {
    let s = r.save;
    for (let i = 0; i < (term === "week" ? 7 : 30); i++) s = endDay(s).save;
    assert.equal(activeCoach(s), null);
  } else {
    const taught = coachedGame(r.save);
    assert.equal(stateOf(taught).coach, null);
    assert.equal(taught.training.xp.opening, 24);
    assert.equal(stateOf(taught).coachedGames, 1);
    assert.strictEqual(coachedGame(taught), taught);
  }
}
assert(
  !hireCoach(
    { ...base, player: { ...base.player, money: 0 } },
    COACHES[0].id,
    "game",
  ).ok,
);
const hired = hireCoach(base, COACHES[0].id, "week");
assert(hired.ok);
let capped = hired.save;
for (let i = 0; i < 10; i++) capped = coachedGame(capped);
assert.equal(stateOf(capped).coachedGames, 4);
const newDayLesson = coachedGame(endDay(capped).save);
assert.equal(stateOf(newDayLesson).coachedGames, 5);
const normal = performSession(base, "tactics-puzzle"),
  bonus = performSession(hired.save, "tactics-puzzle");
assert(normal.ok && bonus.ok);
assert(bonus.outcome.record.gains[0].xp > normal.outcome.record.gains[0].xp);
// Participation now requires a paid, ready team registration; unregistered selection is rejected.
const strong = {
  ...member.save,
  player: { ...member.save.player, rating: 4000, reputation: 100 },
};
assert(!playTeamCup(strong, world).ok);
const teamEvent = getSchedule(
  strong.world.date,
  { city: "Bangkok", countryCode: "TH", demonym: "Thai", continent: "Asia" },
  strong.career.id,
  52,
).find((e) => e.details?.teamEvent?.key === "olympiad")!;
const teamEntry = registerForEvent(strong, teamEvent, world);
assert(teamEntry.ok);
const teamReady = {
  ...teamEntry.save,
  world: {
    ...teamEntry.save.world,
    date: { year: teamEvent.year, week: teamEvent.week },
  },
};
const selected = startRegisteredTournament(teamReady, teamEvent.id, world, 42);
assert(selected.ok);
assert(stateOf(selected.save).cups[0].represented);
assert.equal(selected.save.player.ap.current, strong.player.ap.current - 2);
assert.equal(selected.save.player.rating, strong.player.rating);
assert.equal(selected.save.registrations.length, 0);
assert(!playTeamCup(selected.save, world).ok);
assert.equal(
  selected.save.history.ledger.at(-1)?.amount,
  stateOf(selected.save).cups[0].prize,
);
assert.deepEqual(base.expansion, stateOf(base));
const bulletin = weeklyCircuit(base, world);
assert(bulletin.changed.length >= 8);
assert(
  bulletin.changed.every(
    (n) => n.tournamentHistory.at(-1)?.source === "world-circuit",
  ),
);
assert(
  bulletin.save.history.news.some(
    (n) => n.headline.includes("World Circuit") && n.detail?.includes("wins"),
  ),
);
assert.strictEqual(weeklyCircuit(bulletin.save, world).save, bulletin.save);
const event = getSchedule(
  base.world.date,
  { city: "Bangkok", countryCode: "TH", demonym: "Thai", continent: "Asia" },
  base.career.id,
  26,
).find(
  (e) =>
    e.minElo <= 1000 &&
    e.entryFee <= 250 &&
    e.minReputation === 0 &&
    registrationIssue(base, e, world) === null,
)!;
assert(event);
const preview = previewEntrants(base, event, world),
  reg = registerForEvent(base, event, world);
assert(reg.ok);
assert.deepEqual(
  previewEntrants(reg.save, event, world).map((n) => n.id),
  preview.map((n) => n.id),
);
const ready = {
  ...reg.save,
  world: {
    ...reg.save.world,
    date: { year: event.year, week: event.week },
    day: event.details?.agenda?.exactStart ? event.details.agenda.startDay : 1,
  },
};
const started = startRegisteredTournament(ready, event.id, world, 42);
assert(started.ok);
assert.deepEqual(
  started.save.tournament!.players.filter((p) => !p.isPlayer).map((p) => p.id),
  previewEntrants(ready, event, world).map((n) => n.id),
);
const noOpponents = startRegisteredTournament(
  ready,
  event.id,
  world.map((n) => ({ ...n, careerStatus: "retired" as const })),
  42,
);
assert(noOpponents.ok);
assert.equal(noOpponents.save.tournament, null);
assert.equal(noOpponents.save.player.money, base.player.money);
assert.equal(noOpponents.save.registrations.length, 0);
assert(federationTeams(base, world).length > 1);
console.log(
  `Expansion checks passed: 50 new choices per gender; ${LEGENDS.length} legends; annual cohorts/retirement; coach fees/expiry/XP; federation/team cup; news; locked tournament entrants.`,
);

// Compatibility reset must never erase a second character (real store, isolated memory I/O).
const { createMemorySlotBackend, idbSlotBackend, slotManager } = await import(
  "../src/store/saveSlots.ts"
);
const {
  createMemoryNpcBackend,
  idbNpcBackend,
  writeNpcDatabase,
  readNpcDatabase,
} = await import("../src/store/npcRepository.ts");
Object.assign(idbSlotBackend, createMemorySlotBackend());
Object.assign(idbNpcBackend, createMemoryNpcBackend());
const { useGameStore } = await import("../src/store/gameStore.ts");
await useGameStore.persist.rehydrate();
const careerA = createCareerRecord(opts),
  careerB = createCareerRecord({ ...opts, name: "Second" });
await writeNpcDatabase(world, careerA);
await writeNpcDatabase(world, careerB);
useGameStore.getState().startNewGame(opts, careerA, 1);
await slotManager.readSlot(1);
useGameStore.getState().startNewGame({ ...opts, name: "Second" }, careerB, 2);
await slotManager.readSlot(2);
assert(await useGameStore.getState().selectSlot(1));
await useGameStore.getState().clearSave();
assert.equal(await slotManager.readSlot(1), undefined);
assert.equal(
  JSON.parse((await slotManager.readSlot(2))!).state.save.career.id,
  careerB.id,
);
assert.equal((await readNpcDatabase(careerA)).npcs.length, 0);
assert.equal((await readNpcDatabase(careerB)).npcs.length, world.length);
await useGameStore.getState().clearSave();
assert(await slotManager.readSlot(2));
console.log(
  "clearSave compatibility passed: only active character/world deleted; second slot preserved; no active slot is a no-op.",
);
