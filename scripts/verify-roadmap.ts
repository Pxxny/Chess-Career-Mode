import assert from "node:assert/strict";
import { randomAppearance } from "../src/data/appearance.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import {
  performSession,
  xpNeeded,
  endDay,
} from "../src/game/training/engine.ts";
import { trainingImpact } from "../src/game/training/impact.ts";
import { buildPlayerProfile } from "../src/game/match/npcProfile.ts";
import {
  annualGoals,
  chooseAnnualFocus,
  planningOf,
  recommendedEvents,
} from "../src/game/career/planning.ts";
import {
  recordGame,
  recordTournament,
} from "../src/game/history/recordGame.ts";
import {
  canEarnTitle,
  addTournamentNorms,
  normCount,
} from "../src/game/career/titleRules.ts";
import { getTitleStatus } from "../src/game/career/titles.ts";
import {
  createTournament,
  reportPlayerResult,
} from "../src/game/match/tournament.ts";
import { rotatingEvents } from "../src/game/competition/agenda.ts";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs.ts";
import {
  personalWorldNews,
  rivalryLabel,
  sharedMemories,
} from "../src/game/social/memories.ts";
import {
  signSponsor,
  settleSponsors,
  sponsorsOf,
  cancelSponsor,
  changeLegacyRole,
  legacyService,
} from "../src/game/career/business.ts";
import { archiveCompetition } from "../src/game/competition/preparation.ts";
import { createBackup, parseBackup } from "../src/store/backup.ts";
import { upgradeSave } from "../src/game/training/migrate.ts";
const options = {
  name: "Roadmap QA",
  gender: "male" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: randomAppearance(),
  startYear: 2026,
  alternateHistory: false,
};
const base = createNewSave(options, {
  ...createCareerRecord(options),
  id: "roadmap-qa",
});
const before = {
  ...base,
  training: {
    ...base.training,
    xp: { tactics: xpNeeded(base.player.skills.tactics) - 1 },
  },
};
const trained = performSession(before, "tactics-puzzle");
assert(trained.ok);
assert(trained.save.player.skills.tactics > before.player.skills.tactics);
assert.equal(trained.save.player.rating, before.player.rating);
const a = buildPlayerProfile(before.player, 0, { white: [], black: [] }),
  b = buildPlayerProfile(
    { ...trained.save.player, morale: before.player.morale },
    0,
    { white: [], black: [] },
  );
assert(b.effectiveElo >= a.effectiveElo);
assert(
  trainingImpact(trained.save.player).skillBonus >=
    trainingImpact(before.player).skillBonus,
);
const master = structuredClone(base.player);
for (const key in master.skills) master.skills[key] = 90;
for (const key in master.attributes) master.attributes[key] = 90;
const stronger = buildPlayerProfile(master, 0, { white: [], black: [] });
assert(stronger.effectiveElo > a.effectiveElo + 100);
assert(stronger.clockSkill > a.clockSkill);
assert(stronger.bookDepth > a.bookDepth);
assert(
  buildPlayerProfile(master, 80, { white: [], black: [] }).effectiveElo <
    stronger.effectiveElo,
);
console.log(
  "PASS stage 2: real session levels a skill without awarding Elo; shared simulator strength/book/clock/fatigue effects.",
);
let plan = chooseAnnualFocus(base, "competition");
assert(plan.ok);
assert.equal(annualGoals(plan.save).find((g) => g.id === "games")!.target, 60);
assert(
  !chooseAnnualFocus(
    { ...plan.save, world: { ...base.world, date: { year: 2026, week: 5 } } },
    "learning",
  ).ok,
);
let season = plan.save;
for (let i = 0; i < 3; i++)
  season = recordGame(season, {
    opponentId: "rival",
    opponentName: "QA Rival",
    opponentElo: 1000,
    outcome: (["win", "draw", "loss"] as const)[i],
    color: "white",
    accuracy: 80,
  });
assert.equal(annualGoals(season).find((g) => g.id === "games")!.value, 3);
const rollover = endDay({
  ...season,
  world: { ...season.world, date: { year: 2026, week: 52 }, day: 7 },
}).save;
assert.equal(planningOf(rollover).archive.length, 1);
assert.equal(planningOf(rollover).current.year, 2027);
assert.equal(annualGoals(rollover).find((g) => g.id === "games")!.value, 0);
for (const { event } of recommendedEvents(base)) {
  assert(event.minElo <= base.player.rating);
  assert(
    event.entryFee + (event.details?.travelCost ?? 0) <= base.player.money,
  );
}
console.log(
  "PASS stage 3: selectable/locked annual focus, real results, calendar recommendations and once-only year rollover.",
);
assert.equal(
  canEarnTitle(
    { ...base.player, peakRating: 2700, ratedGames: 100 },
    base.history,
    "GM",
  ),
  false,
);
assert.equal(
  canEarnTitle(
    { ...base.player, peakRating: 2200, ratedGames: 29 },
    base.history,
    "CM",
  ),
  false,
);
assert.equal(
  canEarnTitle(
    { ...base.player, peakRating: 2200, ratedGames: 30 },
    base.history,
    "CM",
  ),
  true,
);
const npcs = buildWorldNpcs(2026)
  .filter((n) => n.careerStatus === "active")
  .slice(0, 11)
  .map((n, i) => ({
    ...n,
    currentElo: 2500,
    peakElo: 2500,
    title: "GM" as const,
    nationality: ["US", "GB", "DE", "FR"][i % 4],
  }));
const region = {
  city: "Bangkok",
  countryCode: "TH",
  demonym: "Thai",
  continent: "Asia",
};
const template = rotatingEvents(base.world.date, region, 52).find(
  (e) => e.id === "rotation-2026-2-0",
)!;
let titled = {
  ...base,
  player: { ...base.player, rating: 2500, peakRating: 2500, ratedGames: 50 },
};
for (let i = 0; i < 3; i++) {
  const event = {
    ...template,
    id: `norm-${i}`,
    name: `Classical Norm ${i}`,
    details: {
      ...template.details!,
      timeControl: {
        id: "classical",
        label: "90+30",
        base: 5400,
        increment: 30,
        category: "classical" as const,
      },
    },
  };
  let t = createTournament({
    event,
    player: {
      name: base.player.name,
      rating: 2500,
      country: "TH",
      title: "FM",
    },
    npcs,
    fieldIds: npcs.map((n) => n.id),
    seed: i + 1,
  });
  while (t.status === "playing") t = reportPlayerResult(t, "win");
  const candidate = { ...titled, tournament: t };
  const sameFederation = {
    ...candidate,
    tournament: {
      ...t,
      players: t.players.map((p) => ({ ...p, countryCode: "TH" })),
    },
  };
  assert.equal(normCount(addTournamentNorms(sameFederation).history, "GM"), i);
  const untitledField = {
    ...candidate,
    tournament: {
      ...t,
      players: t.players.map((p) => ({ ...p, title: "none" as const })),
    },
  };
  assert.equal(normCount(addTournamentNorms(untitledField).history, "GM"), i);
  const tooShort = {
    ...candidate,
    tournament: { ...t, pairings: t.pairings.slice(0, 8) },
  };
  assert.equal(normCount(addTournamentNorms(tooShort).history, "GM"), i);
  const rapid = {
    ...candidate,
    tournament: {
      ...t,
      timeControl: { ...t.timeControl, category: "rapid" as const },
    },
  };
  assert.equal(normCount(addTournamentNorms(rapid).history, "GM"), i);
  assert.equal(
    normCount(
      addTournamentNorms({
        ...candidate,
        tournament: { ...t, withdrawn: true },
      }).history,
      "GM",
    ),
    i,
  );
  titled = recordTournament(candidate, {
    tournamentId: t.eventId,
    name: t.name,
    level: t.level,
    rank: 1,
    fieldSize: 12,
    points: 11,
  });
  assert.equal(normCount(titled.history, "GM"), i + 1);
  const again = recordTournament(titled, {
    tournamentId: t.eventId,
    name: t.name,
    level: t.level,
    rank: 1,
    fieldSize: 12,
    points: 11,
  });
  assert.equal(normCount(again.history, "GM"), i + 1);
}
assert.equal(getTitleStatus(titled.player, titled.history).current, "GM");
const legacy = {
  ...base,
  history: {
    ...base.history,
    titles: [{ year: 2020, week: 1, title: "GM" as const }],
  },
};
assert.equal(getTitleStatus(legacy.player, legacy.history).current, "GM");
const championship = {
  ...titled.tournament!,
  eventId: "world-champ-qa",
  details: {
    ...titled.tournament!.details!,
    category: "World Chess Championship",
  },
};
const defended = archiveCompetition({ ...titled, tournament: championship });
assert.equal(defended.competition!.champion!.name, base.player.name);
assert(
  defended.competition!.qualifications.some(
    (q) => q.kind === "world-championship",
  ),
);
const lost = archiveCompetition({
  ...defended,
  tournament: { ...championship, eventId: "lost-defence", finalRank: 2 },
});
assert(!lost.competition!.qualifications.some((q) => q.route === "defence"));
console.log(
  "PASS stage 4: Elo alone cannot award GM; three independently finished classical norms award it; rapid/withdrawal/duplicates excluded; old titles kept; champion earns defence.",
);
// Legacy relationships already contain meetings but no exact first-game date. Do not invent one.
const older = structuredClone(season);
delete older.social!.relationships.rival.firstRatedMemory;
const metAgain = recordGame(older, {
  opponentId: "rival",
  opponentName: "QA Rival",
  opponentElo: 1000,
  outcome: "draw",
  color: "white",
  accuracy: 80,
});
assert.equal(metAgain.social!.relationships.rival.firstRatedMemory, undefined);
assert.equal(rivalryLabel(season, "rival"), "Emerging rivalry");
assert.equal(season.social!.relationships.rival.closeness, 0);
assert.equal(sharedMemories(season, "rival").length, 3);
const known = {
  ...npcs[0],
  id: "rival",
  tournamentHistory: [
    {
      year: 2026,
      week: 1,
      eventId: "world-qa",
      event: "World QA",
      rank: 2,
      fieldSize: 12,
      source: "world-circuit" as const,
      ratingBefore: 2500,
      ratingAfter: 2512,
      wins: 3,
      draws: 2,
      losses: 1,
    },
  ],
};
const bulletin = personalWorldNews(season, [known]);
assert(
  bulletin.history.news.some((n) => n.id === "world-person-world-qa-rival"),
);
assert.equal(
  personalWorldNews(bulletin, [known]).history.news.length,
  bulletin.history.news.length,
);
console.log(
  "PASS stage 5: real head-to-head memories and rivalries without friendship inflation; world headlines use actual results and deduplicate.",
);
const eligible = {
  ...base,
  player: { ...base.player, rating: 1500, peakRating: 1500, reputation: 20 },
};
const signed = signSponsor(eligible, "local-club");
assert(signed.ok);
assert(!signSponsor(signed.save, "local-club").ok);
let contract = signed.save;
for (let i = 0; i < 6; i++)
  contract = recordGame(contract, {
    opponentId: null,
    opponentName: "QA",
    opponentElo: 1500,
    outcome: "draw",
    color: "white",
    accuracy: 70,
  });
contract = {
  ...contract,
  training: { ...contract.training, sessionCounter: 8 },
  world: { ...contract.world, date: { year: 2026, week: 5 } },
};
let paid = settleSponsors(contract);
assert.equal(paid.player.money, contract.player.money + 40);
assert.equal(
  settleSponsors(JSON.parse(JSON.stringify(paid))).player.money,
  paid.player.money,
);
paid = settleSponsors({
  ...paid,
  world: { ...paid.world, date: { year: 2026, week: 9 } },
});
assert.equal(paid.sponsorship!.active!.missed, 1);
paid = settleSponsors({
  ...paid,
  world: { ...paid.world, date: { year: 2026, week: 13 } },
});
assert.equal(sponsorsOf(paid).active, null);
assert.equal(sponsorsOf(paid).history.length, 1);
assert.equal(sponsorsOf(paid).history[0].paid, 40);
assert(!signSponsor(paid, "local-club").ok);
assert(!signSponsor(cancelSponsor(signed.save), "local-club").ok);
assert(!changeLegacyRole(base, "mentor").ok);
const role = changeLegacyRole(
  { ...eligible, player: { ...eligible.player, age: 40 } },
  "mentor",
);
assert(role.ok);
const service = legacyService(role.save);
assert(service.ok);
assert.equal(service.save.player.money, role.save.player.money + 40);
assert.equal(service.save.player.ap.current, role.save.player.ap.current - 2);
assert(!legacyService(service.save).ok);
assert(!changeLegacyRole(service.save, "commentator").ok);
console.log(
  "PASS stage 6: contract eligibility, non-stacking, paid/missed review, expiry/cancellation cooldown, no duplicate reload payment, legacy unlock/costs/weekly guard.",
);
const complete = {
  ...paid,
  social: season.social,
  planning: rollover.planning,
  legacy: service.save.legacy,
  history: { ...paid.history, titleNorms: titled.history.titleNorms },
};
const backup = await parseBackup(
  JSON.stringify(await createBackup(complete, npcs)),
);
const restored = upgradeSave(backup.payload.save);
assert.deepEqual(restored.planning, complete.planning);
assert.deepEqual(restored.sponsorship, complete.sponsorship);
assert.deepEqual(restored.legacy, complete.legacy);
assert.deepEqual(
  restored.social!.memories,
  JSON.parse(JSON.stringify(complete.social!.memories)),
);
assert.equal(normCount(restored.history, "GM"), 3);
console.log(
  "PASS roadmap state and full NPC backup roundtrip; old saves still upgrade without invented achievements.",
);
