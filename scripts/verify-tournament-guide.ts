import assert from "node:assert/strict";
import { TEAM_EVENTS } from "../src/data/chess/nationalTeamEvents.ts";
import { teamHost, withTeamHost } from "../src/game/competition/hosts.ts";
import { regionAllows } from "../src/game/competition/teamEligibility.ts";
import { careerEvents } from "../src/game/competition/catalog.ts";
import { getCountry } from "../src/data/world/countries.ts";
import { randomAppearance } from "../src/data/appearance.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import { registrationWindow } from "../src/game/competition/registrationWindow.ts";
import { registrationCount } from "../src/game/competition/entries.ts";
import { registrationIssue } from "../src/game/competition/eligibility.ts";
import { dayStamp } from "../src/game/competition/agenda.ts";
import { withTravel } from "../src/game/qol/schedule.ts";
import { upgradeSave } from "../src/game/training/migrate.ts";
const a = {
  city: "Bangkok",
  countryCode: "TH",
  demonym: "Thai",
  continent: "Asia",
};
const b = {
  city: "London",
  countryCode: "GB",
  demonym: "British",
  continent: "Europe",
};
for (let year = 1950; year <= 2100; year++)
  for (const spec of TEAM_EVENTS) {
    const host = teamHost(spec.key, year);
    if (!host.online) {
      assert(getCountry(host.country));
      assert(regionAllows(spec, host.country), `${spec.key} ${year}`);
    }
    const find = (region: typeof a) =>
      careerEvents({ year, week: 1 }, region, 52).find(
        (e) => e.id === `career-${spec.key}-${year}`,
      )!;
    assert.deepEqual(find(a).details, find(b).details);
    assert.equal(find(a).details!.country, host.country);
  }
const options = {
  name: "Guide QA",
  gender: "male" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: randomAppearance(),
  startYear: 2026,
  alternateHistory: false,
};
const save = createNewSave(options, createCareerRecord(options));
const event = careerEvents(save.world.date, a, 52).find(
  (e) => e.details!.teamEvent?.key === "african-games",
)!;
assert.equal(getCountry(event.details!.country)!.continent, "Africa");
const old = structuredClone(event.details!);
delete old.host;
old.country = "TH";
old.location = "Bangkok";
const restored = withTeamHost(old, 2026);
assert.equal(restored.country, event.details!.country);
assert.equal(old.country, "TH");
const booked = {
  ...save,
  registrations: [
    {
      eventId: event.id,
      name: event.name,
      year: event.year,
      week: event.week,
      level: event.level,
      fieldSize: event.fieldSize,
      entryFee: 0,
      details: old,
    },
  ],
};
assert.equal(
  upgradeSave(booked).registrations[0].details!.country,
  event.details!.country,
);
assert.equal(upgradeSave(booked).registrations[0].fieldSize, event.fieldSize);
assert.equal(
  withTravel(
    careerEvents(save.world.date, a, 52).find(
      (e) => e.details?.teamEvent?.key === "online-olympiad",
    )!,
    "TH",
  ).details!.travelCost,
  0,
);
const at = (day: number) => {
  const d = dayStamp(day);
  return {
    ...save,
    world: { ...save.world, date: { year: d.year, week: d.week }, day: d.day },
  };
};
const w = registrationWindow(save, event);
assert.equal(registrationWindow(at(w.open - 1), event).status, "upcoming");
assert.match(registrationIssue(at(w.open - 1), event)!, /not opened/);
assert.equal(registrationCount(at(w.open - 1), event), 0);
for (const day of [w.open, w.close])
  assert.equal(registrationWindow(at(day), event).status, "open");
assert.equal(registrationWindow(at(w.close + 1), event).status, "closed");
assert.match(registrationIssue(at(w.close + 1), event)!, /deadline/);
console.log(
  "PASS all 20 hosts across 151 years, region restrictions, player-independent hosting, old booking repair, online travel and inclusive registration boundaries.",
);
