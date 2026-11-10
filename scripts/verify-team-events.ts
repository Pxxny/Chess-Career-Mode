import assert from "node:assert/strict";
import {
  TEAM_EVENTS,
  resolveTeamEvent,
  teamSpec,
} from "../src/data/chess/nationalTeamEvents";
import { DEFAULT_APPEARANCE } from "../src/data/appearance";
import { createCareerRecord } from "../src/game/career/createCareer";
import { createNewSave } from "../src/game/createNewSave";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs";
import {
  cupKey,
  joinFederation,
  playTeamCup,
  stateOf,
} from "../src/game/career/expansion";
import {
  buildEventTeams,
  pickRoster,
  simulateTeamEvent,
  teamPrize,
} from "../src/game/competition/teamEvents";
import { regionAllows } from "../src/game/competition/teamEligibility";
import { registrationIssue } from "../src/game/competition/eligibility";
import {
  registerForEvent,
  startRegisteredTournament,
} from "../src/game/match/registration";
import { getSchedule } from "../src/game/world/schedule";
import { createRng } from "../src/game/rng";

// 1. The catalog matches the 20 requested events.
assert.equal(TEAM_EVENTS.length, 20);
assert.equal(new Set(TEAM_EVENTS.map((e) => e.key)).size, 20);
assert.equal(new Set(TEAM_EVENTS.map((e) => e.category)).size, 20);
assert.equal(new Set(TEAM_EVENTS.map((e) => e.week)).size, 20);
const ranges: Record<string, [number, number, number, number, number, number]> =
  {
    // teams min/max, boards min/max, reserves min/max
    olympiad: [180, 195, 4, 4, 1, 1],
    "women-olympiad": [150, 180, 4, 4, 1, 1],
    "world-team": [12, 12, 4, 4, 1, 2],
    "women-world-team": [12, 12, 4, 4, 1, 2],
    "online-olympiad": [150, 160, 6, 6, 6, 6],
    "disability-olympiad": [30, 35, 4, 4, 1, 1],
    "youth-u16-olympiad": [50, 80, 4, 4, 1, 1],
    "senior-team": [30, 60, 4, 4, 1, 1],
    "european-team": [38, 40, 4, 4, 1, 1],
    "european-women-team": [30, 36, 4, 4, 1, 1],
    "asian-nations-cup": [15, 25, 4, 4, 1, 1],
    "pan-american-team": [8, 12, 4, 4, 1, 1],
    "asian-games": [12, 18, 4, 4, 1, 1],
    aimag: [15, 20, 4, 4, 2, 2],
    "sea-games": [6, 8, 2, 4, 0, 0],
    "african-games": [15, 20, 4, 4, 0, 0],
    "mitropa-cup": [10, 10, 4, 4, 1, 1],
    "european-youth-team": [20, 35, 4, 4, 1, 1],
    "arab-team": [10, 16, 4, 4, 1, 1],
    "ibero-american-team": [15, 22, 4, 4, 1, 1],
  };
for (const spec of TEAM_EVENTS) {
  const r = ranges[spec.key];
  assert(r, `${spec.key} is listed`);
  assert.deepEqual(
    [...spec.teams, ...spec.boards, ...spec.reserves],
    r,
    spec.key,
  );
  const seen = new Set<string>();
  for (let year = 1950; year <= 2100; year++) {
    const info = resolveTeamEvent(spec, year);
    assert.deepEqual(info, resolveTeamEvent(spec, year));
    assert(info.teams >= spec.teams[0] && info.teams <= spec.teams[1]);
    assert(info.boards >= spec.boards[0] && info.boards <= spec.boards[1]);
    assert(
      info.reserves >= spec.reserves[0] && info.reserves <= spec.reserves[1],
    );
    seen.add(`${info.teams}/${info.boards}/${info.reserves}`);
  }
  if (spec.teams[0] !== spec.teams[1]) assert(seen.size > 1, spec.key);
}
assert.deepEqual(teamSpec("online-olympiad")?.slots, [
  "open",
  "open",
  "woman",
  "woman",
  "boy-u20",
  "girl-u20",
]);

// 2. Region rules.
assert(regionAllows(teamSpec("european-team")!, "FR"));
assert(!regionAllows(teamSpec("european-team")!, "TH"));
assert(regionAllows(teamSpec("sea-games")!, "TH"));
assert(!regionAllows(teamSpec("sea-games")!, "JP"));
assert(regionAllows(teamSpec("asian-games")!, "JP"));
assert(regionAllows(teamSpec("pan-american-team")!, "BR"));
assert(regionAllows(teamSpec("arab-team")!, "EG"));
assert(regionAllows(teamSpec("ibero-american-team")!, "ES"));
assert(regionAllows(teamSpec("mitropa-cup")!, "AT"));
assert(!regionAllows(teamSpec("mitropa-cup")!, "FR"));
assert(regionAllows(teamSpec("olympiad")!, "TH"));

// 3. Board composition.
const mk = (id: string, elo: number, gender: string, age: number) => ({
  id,
  name: id,
  elo,
  gender,
  age,
});
const pool = [
  mk("m1", 2600, "male", 30),
  mk("m2", 2500, "male", 28),
  mk("m3", 2400, "male", 35),
  mk("w1", 2300, "female", 30),
  mk("w2", 2200, "female", 26),
  mk("w3", 2100, "female", 40),
  mk("b1", 2000, "male", 17),
  mk("g1", 1900, "female", 16),
  mk("m4", 1800, "male", 50),
  mk("w4", 1700, "female", 45),
  mk("m5", 1600, "male", 22),
  mk("w5", 1500, "female", 22),
  mk("m6", 1400, "male", 22),
  mk("w6", 1300, "female", 22),
];
const online = pickRoster(pool, teamSpec("online-olympiad")!, 6, 6);
assert.equal(online.starters.length, 6);
assert(online.starters.filter((c) => c.gender === "female").length >= 3);
assert(online.starters.some((c) => c.id === "b1"));
assert(online.starters.some((c) => c.id === "g1"));
assert.equal(online.reserves.length, 6);
assert.equal(
  new Set([...online.starters, ...online.reserves].map((c) => c.id)).size,
  12,
);
const african = pickRoster(pool, teamSpec("african-games")!, 4, 0);
assert.equal(african.starters.filter((c) => c.gender === "male").length, 2);
assert.equal(african.starters.filter((c) => c.gender === "female").length, 2);
assert.equal(african.reserves.length, 0);
const youth = pickRoster(pool, teamSpec("youth-u16-olympiad")!, 4, 1);
assert(youth.starters.some((c) => c.gender === "female"));
const open = pickRoster(pool, teamSpec("olympiad")!, 4, 1);
assert.deepEqual(
  open.starters.map((c) => c.id),
  ["m1", "m2", "m3", "w1"],
);
assert.deepEqual(
  open.reserves.map((c) => c.id),
  ["w2"],
);
const tiny = pickRoster([mk("only", 1500, "male", 30)], teamSpec("olympiad")!, 4, 1);
assert.equal(tiny.starters.length, 1);
assert.equal(pickRoster(pool, teamSpec("sea-games")!, 2, 0).starters.length, 2);

// 4. Teams are built from the NPC world with each event's restrictions.
const opts = {
  name: "Team Event Test",
  gender: "male" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: DEFAULT_APPEARANCE,
  startYear: 2026,
  alternateHistory: false,
};
const base = createNewSave(opts, createCareerRecord(opts));
const world = buildWorldNpcs(2026);
const byId = new Map(world.map((n) => [n.id, n]));
const infoOf = (key: string) => resolveTeamEvent(teamSpec(key)!, 2026);
const playersOf = (key: string) =>
  buildEventTeams(base, world, infoOf(key)).flatMap((t) =>
    [...t.players, ...(t.reserves ?? [])].map((p) => ({ team: t, p })),
  );
for (const { p } of playersOf("women-olympiad"))
  if (p.id !== "player") assert.equal(byId.get(p.id)?.gender, "female");
for (const { p } of playersOf("senior-team"))
  if (p.id !== "player") assert((byId.get(p.id)?.age ?? 0) >= 50);
for (const { p } of playersOf("youth-u16-olympiad"))
  if (p.id !== "player") assert((byId.get(p.id)?.age ?? 99) <= 15);
for (const { team } of playersOf("european-team"))
  assert(regionAllows(teamSpec("european-team")!, team.country));
for (const { team } of playersOf("sea-games"))
  assert(regionAllows(teamSpec("sea-games")!, team.country));
for (const key of TEAM_EVENTS.map((e) => e.key)) {
  const info = infoOf(key),
    teams = buildEventTeams(base, world, info);
  assert(teams.length <= info.teams, key);
  for (const t of teams) {
    assert(t.players.length >= 1 && t.players.length <= info.boards, key);
    assert((t.reserves ?? []).length <= info.reserves, key);
    const ids = [...t.players, ...(t.reserves ?? [])].map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `${key}:${t.country} unique`);
  }
  assert.deepEqual(teams, buildEventTeams(base, world, info), `${key} stable`);
}
assert(!playersOf("disability-olympiad").some(({ p }) => p.id === "player"));
assert(
  playersOf("disability-olympiad").every(({ p }) => p.id.startsWith("abstract:")),
);

// 5. Simulation: round robin up to 12 teams, Swiss above; results are consistent.
const sim = (key: string, seed = 7) => {
  const info = infoOf(key);
  const teams = buildEventTeams(base, world, info).map((t) => ({
    ...t,
    players: t.players.map((p) => ({ ...p })),
    reserves: (t.reserves ?? []).map((p) => ({ ...p })),
  }));
  return {
    info,
    result: simulateTeamEvent(base, world, info, teams, createRng(seed)),
  };
};
const wtc = sim("world-team");
assert.equal(wtc.result.format, "round-robin");
const n = wtc.result.teams.length;
assert.equal(wtc.result.rounds, (n * (n - 1)) / 2);
assert.equal(
  wtc.result.teams.reduce((s, t) => s + t.points, 0),
  2 * wtc.result.rounds,
);
assert.equal(
  wtc.result.teams.reduce((s, t) => s + t.boardPoints, 0),
  4 * wtc.result.rounds,
);
for (let i = 1; i < n; i++)
  assert(wtc.result.teams[i - 1].points >= wtc.result.teams[i].points);
const oly = sim("olympiad");
assert.equal(oly.result.format, "swiss");
assert.equal(oly.result.rounds, 11);
const matches = oly.result.teams.length / 2;
assert(
  oly.result.teams.reduce((s, t) => s + t.points, 0) >=
    2 * Math.floor(matches) * oly.result.rounds,
);
for (const t of oly.result.teams)
  assert(t.points <= 2 * oly.result.rounds && t.points >= 0);
assert(oly.result.boards.length <= oly.result.rounds * 4);
assert(oly.result.samples.length <= oly.result.boards.length);
assert.deepEqual(sim("olympiad").result.teams, oly.result.teams);
assert.deepEqual(sim("sea-games").result.teams, sim("sea-games").result.teams);
const sea = sim("sea-games");
assert.equal(sea.result.format, "round-robin");
assert(sea.result.teams.length <= sea.info.teams);
assert.equal(teamPrize(teamSpec("olympiad")!, 0, 190), 160);
assert.equal(teamPrize(teamSpec("olympiad")!, 189, 190), 16);

// 6. The calendar offers all twenty events with unique ids and concrete editions.
const region = {
  city: "Bangkok",
  countryCode: "TH",
  demonym: "Thai",
  continent: "Asia",
};
const schedule = getSchedule(
  { year: 2026, week: 1 },
  region,
  base.career.id,
  52,
);
const teamEvents = schedule.filter((e) => e.details?.format === "team");
assert.equal(teamEvents.length, 20);
assert.equal(new Set(teamEvents.map((e) => e.id)).size, 20);
for (const e of teamEvents) {
  const spec = teamSpec(e.details!.teamEvent!.key)!;
  assert.equal(e.details!.category, spec.category);
  assert.equal(e.fieldSize, e.details!.teamEvent!.teams);
  assert.equal(e.entryFee, 0);
}

// 7. Eligibility by event.
const strong = {
  ...base,
  player: { ...base.player, rating: 4000, reputation: 100, money: 5000 },
};
const member = joinFederation(strong);
assert(member.ok);
const find = (key: string) =>
  teamEvents.find((e) => e.details!.teamEvent!.key === key)!;
const issue = (key: string) => registrationIssue(member.save, find(key), world);
assert.equal(issue("olympiad"), null);
assert.equal(issue("asian-nations-cup"), null);
assert.equal(issue("sea-games"), null);
assert.match(issue("women-olympiad") ?? "", /Requires/);
assert.match(issue("european-team") ?? "", /Requires/);
assert.match(issue("senior-team") ?? "", /Requires/);
assert.equal(base.player.age < 16, true);
assert.equal(issue("youth-u16-olympiad"), null);
assert.match(issue("disability-olympiad") ?? "", /Requires/);
assert(!registerForEvent(member.save, find("european-team"), world).ok);

// 8. Several different team events in one year are independent; same event only once.
const enter = (save: typeof member.save, key: string) => {
  const event = find(key);
  const reg = registerForEvent(save, event, world);
  assert(reg.ok, `${key}: ${reg.ok ? "" : reg.error}`);
  const ready = {
    ...reg.save,
    world: { ...reg.save.world, date: { year: event.year, week: event.week } },
  };
  const played = startRegisteredTournament(ready, event.id, world, 42);
  assert(played.ok, `${key}: ${played.ok ? "" : played.error}`);
  return played.save;
};
const afterSea = enter(member.save, "sea-games");
const cupsSea = stateOf(afterSea).cups;
assert.equal(cupsSea.length, 1);
assert.equal(cupKey(cupsSea[0]), "sea-games");
assert(cupsSea[0].represented);
assert.equal(cupsSea[0].boardsPerTeam, find("sea-games").details!.teamEvent!.boards);
assert.equal(afterSea.player.ap.current, member.save.player.ap.current - 2);
assert.equal(afterSea.player.rating, member.save.player.rating);
assert.equal(afterSea.registrations.length, 0);
const afterBoth = enter(
  { ...afterSea, player: { ...afterSea.player, ap: { ...afterSea.player.ap, current: 20 } } },
  "asian-nations-cup",
);
assert.deepEqual(
  stateOf(afterBoth).cups.map(cupKey).sort(),
  ["asian-nations-cup", "sea-games"],
);
assert(!playTeamCup(afterBoth, world, { key: "sea-games" }).ok);
// A selected player must register; a federation member who is not selected may follow the event.
assert(!playTeamCup(afterBoth, world, { key: "olympiad" }).ok);
const follower = joinFederation(base);
assert(follower.ok);
const followed = playTeamCup(follower.save, world, { key: "olympiad" });
assert(followed.ok);
const followedCup = stateOf(followed.save).cups.find(
  (c) => cupKey(c) === "olympiad",
)!;
assert(!followedCup.represented);
assert.equal(followedCup.prize, 0);
assert.equal(followed.save.player.ap.current, follower.save.player.ap.current);
assert.equal(followed.save.player.money, follower.save.player.money);
assert(!playTeamCup(followed.save, world, { key: "olympiad" }).ok);
assert(!playTeamCup(afterBoth, world, { key: "no-such-event" }).ok);

// 9. Cups saved before the catalog count as the Olympiad.
const legacy = {
  ...afterBoth,
  expansion: {
    ...stateOf(afterBoth),
    cups: [
      { year: 2026, teams: [], boards: [], represented: false, prize: 0 },
    ],
  },
};
assert.equal(cupKey(legacy.expansion.cups[0]), "olympiad");
assert(!playTeamCup(legacy, world, { key: "olympiad" }).ok);
console.log("team events ok");
