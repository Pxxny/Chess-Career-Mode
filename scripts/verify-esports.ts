import {
  setCompetitionConfig,
  prepareEvent,
  scoutOpponent,
} from "../src/game/competition/preparation.ts";
import assert from "node:assert/strict";
import { reconcileTournamentHistory } from "../src/game/npc/tournamentHistory.ts";
import { randomAppearance } from "../src/data/appearance.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import { upgradeSave } from "../src/game/training/migrate.ts";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs.ts";
import { localCompetitors } from "../src/game/npc/localPool.ts";
import {
  createTournament,
  reportPlayerResult,
  playerPairing,
  playerOpponentId,
  standings,
} from "../src/game/match/tournament.ts";
import {
  registerForEvent,
  startRegisteredTournament,
} from "../src/game/match/registration.ts";
import { getBaseOpeningDatabase } from "../src/game/openings/database.ts";
import { buildMatchSetup } from "../src/game/match/setup.ts";
import { recoverPendingMatch } from "../src/game/match/aftermath.ts";
import { moveToUci, gameFromSans } from "../src/game/chess/rules.ts";
import { getSchedule } from "../src/game/world/schedule.ts";
import {
  gameDay,
  dayStamp,
  bookedStart,
  bookedEnd,
  rotatingEvents,
  roundSlot,
  tournamentSlot,
  tournamentReady,
} from "../src/game/competition/agenda.ts";
import { matchesTournamentSearch } from "../src/game/competition/finder.ts";
import { stampIndex } from "../src/game/competition/catalog.ts";
import { registrationIssue } from "../src/game/competition/eligibility.ts";
import {
  esportsTier,
  esportsEvents,
  ESPORTS_TIERS,
  ORGANIZATIONS,
} from "../src/game/esports/catalog.ts";
import {
  advanceEsports,
  esportsOf,
  esportsCommand,
  esportsEntryIssue,
  nextEsportsGame,
  esportsRoundDay,
  esportsStandings,
  reportEsportsGame,
  recruitmentChance,
  offerChance,
  teamRating,
  bookingConflict,
} from "../src/game/esports/core.ts";
import type {
  EsportsCommand,
  EsportsCompetition,
} from "../src/game/esports/types.ts";
import type { GameSave } from "../src/types/index.ts";
const options = {
  name: "Esports QA",
  gender: "male" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: randomAppearance(),
  startYear: 2026,
  alternateHistory: false,
};
const career = { ...createCareerRecord(options), id: "esports-qa" },
  base = createNewSave(options, career),
  npcs = [...buildWorldNpcs(2026), ...localCompetitors("TH", "Bangkok", 2026)],
  db = getBaseOpeningDatabase();
const region = {
  city: "Bangkok",
  countryCode: "TH",
  demonym: "Thai",
  continent: "Asia",
};
const onDay = (s: GameSave, at: number): GameSave => {
  const d = dayStamp(at);
  return {
    ...s,
    world: { ...s.world, date: { year: d.year, week: d.week }, day: d.day },
  };
};
const command = (s: GameSave, c: EsportsCommand): GameSave => {
  const r = esportsCommand(s, npcs, c);
  assert(r.ok, r.ok ? "" : r.error);
  return r.save;
};

for (const [elo, tier] of [
  [1799, null],
  [1800, "D"],
  [2000, "D"],
  [2001, "C"],
  [2200, "C"],
  [2201, "B"],
  [2500, "B"],
  [2501, "A"],
  [2699, "A"],
  [2700, "S"],
  [3200, "S"],
] as const)
  assert.equal(esportsTier(elo), tier);
const rotations = rotatingEvents(base.world.date, region, 52).filter(
  (e) => e.year === 2026,
);
assert.equal(rotations.length, 36);
for (let month = 1; month <= 12; month++)
  assert.equal(
    rotations.filter((e) => e.id.startsWith(`rotation-2026-${month}-`)).length,
    3,
  );
for (const e of rotations) {
  assert([3, 7].includes(e.details!.agenda!.days));
  assert(bookedEnd(e) >= bookedStart(e));
  assert(e.details?.format.includes("round-robin"));
}
const search = {
  fromWeek: 0,
  toWeek: 52,
  minElo: 0,
  maxElo: 3500,
  minPlayers: 2,
  maxPlayers: 256,
  continent: "all",
  availableOnly: false,
};
assert(
  rotations.some((e) =>
    matchesTournamentSearch(e, {
      ...search,
      organizer: "Official",
      duration: "7",
      pairing: "rotation",
    }),
  ),
);
assert(
  rotations.some((e) =>
    matchesTournamentSearch(e, {
      ...search,
      organizer: "Unofficial",
      duration: "3",
    }),
  ),
);
assert(
  rotations.every(
    (e) => !matchesTournamentSearch(e, { ...search, duration: "single" }),
  ),
);
const bo3 = rotations.find((e) => e.details?.format === "round-robin-bo3")!;
const field = npcs.filter((n) => n.careerStatus === "active").slice(0, 5);
let t = createTournament({
  event: bo3,
  player: {
    name: base.player.name,
    rating: base.player.rating,
    country: "TH",
    title: "none",
  },
  npcs: field,
  fieldIds: field.map((n) => n.id),
  seed: 17,
});
assert.equal(t.rounds, 15);
for (let series = 0; series < 5; series++) {
  const slots = [1, 2, 3].map((g) =>
    roundSlot(series * 3 + g, 15, 7, 40, 540, 3),
  );
  assert(slots.every((s) => s.day === slots[0].day));
  assert(slots[2].endMinute <= 1440);
}
let games = 0;
while (t.status === "playing") {
  assert(games++ < 20);
  t = reportPlayerResult(t, "win");
}
assert.equal(standings(t).find((r) => r.player.isPlayer)?.player.points, 5);
assert.equal(games, 10, "every 2–0 series skips game three");
const pairs = new Map<string, number>();
for (const p of t.pairings.flat()) {
  if (p.black === "bye") continue;
  assert(p.result !== null);
  const key = [p.white, p.black].sort().join("|");
  pairs.set(key, (pairs.get(key) ?? 0) + 1);
}
assert.equal(pairs.size, 15, "six players each meet all five opponents");
assert([...pairs.values()].every((n) => n === 2 || n === 3));
const two = { ...bo3, fieldSize: 2 };
let tie = createTournament({
  event: two,
  player: { name: "QA", rating: 1800, country: "TH", title: "none" },
  npcs: field.slice(0, 1),
  fieldIds: [field[0].id],
  seed: 4,
});
for (let i = 0; i < 3; i++) tie = reportPlayerResult(tie, "draw");
assert(tie.pairings[2][0].tiebreakWinner);
assert.equal(standings(tie)[0].player.points, 1);
const rr = rotations.find((e) => e.details?.agenda?.days === 3)!;
const early = onDay(base, (stampIndex(rr.registrationDeadline) - 1) * 7),
  reg = registerForEvent(early, rr, npcs);
assert(reg.ok);
assert(
  !startRegisteredTournament(
    onDay(reg.save, bookedStart(rr) - 1),
    rr.id,
    npcs,
    1,
  ).ok,
);
assert(
  !startRegisteredTournament(
    onDay(reg.save, bookedStart(rr) + 1),
    rr.id,
    npcs,
    1,
  ).ok,
);
const started = startRegisteredTournament(
  onDay(reg.save, bookedStart(rr)),
  rr.id,
  npcs,
  1,
);
assert(started.ok && started.save.tournament);
assert.equal(started.save.tournament.startedOnDay, bookedStart(rr));
const future = {
  ...started.save,
  tournament: {
    ...started.save.tournament,
    round: started.save.tournament.rounds,
  },
};
assert(!tournamentReady(future));
console.log(
  "PASS 36 multi-day rotations/year, 3 per calendar month; exact dates, 3/7-day schedules, Official/duration filters, RR/BO3 pairing, early clinches and tied-series deciders",
);

const all = esportsEvents(gameDay(base), career.id, 364),
  monthly = all.filter(
    (e) => e.cadence === "Monthly" && Math.floor(e.day / 364) === 2026,
  );
assert.equal(monthly.length, 12 * 5);
assert(
  ESPORTS_TIERS.every((tier) =>
    all.some((e) => e.tier === tier.id && e.cadence === "Qualifier"),
  ),
);
assert(all.some((e) => e.size === 2) && all.some((e) => e.size === 3));
const event = all.find(
  (e) =>
    e.tier === "D" && e.cadence === "Qualifier" && e.deadline >= gameDay(base),
)!;
let s = command(base, { type: "register", eventId: event.id });
assert.equal(esportsOf(s).entries.length, 1);
assert(!esportsCommand(s, npcs, { type: "register", eventId: event.id }).ok);
assert.equal(esportsOf(s).entries[0].team.members.length, event.size);
assert.equal(
  new Set(esportsOf(s).entries[0].team.members.map((m) => m.id)).size,
  event.size,
);
assert(!esportsCommand(s, npcs, { type: "start", eventId: event.id }).ok);
s = command(onDay(s, event.day), { type: "start", eventId: event.id });
assert.equal(
  new Set(esportsOf(s).active!.teams.flatMap((t) => t.members.map((m) => m.id)))
    .size,
  event.size * 4,
);
for (let i = 1; i <= 3; i++) {
  s = onDay(s, esportsRoundDay(esportsOf(s).active!));
  const target = nextEsportsGame(s)!;
  assert(target);
  const prior = s;
  s = reportEsportsGame(s, target.context, "win");
  assert.equal(
    reportEsportsGame(s, target.context, "win"),
    s,
    "duplicate result must not pay or advance twice",
  );
  assert(s !== prior);
}
const promotionBooking = command(base, { type: "register", eventId: event.id });
const paidEvent = all.find(
  (e) =>
    e.tier === "D" && e.cadence === "Weekly" && e.deadline >= gameDay(base),
)!;
const partners = npcs
  .filter(
    (n) =>
      n.careerStatus === "active" &&
      n.currentElo >= 1800 &&
      n.currentElo <= 1950,
  )
  .slice(0, paidEvent.size - 1);
const paidCaptain: GameSave = {
  ...base,
  player: { ...base.player, rating: 1900, money: 1000 },
  esports: {
    ...esportsOf(base),
    team: {
      id: "paid-tier-test",
      name: "Paid Tier QA",
      owner: true,
      size: paidEvent.size,
      prestige: 20,
      members: [
        { id: "player", name: base.player.name, elo: 1900, country: "TH" },
        ...partners.map((n) => ({
          id: n.id,
          name: n.name,
          elo: n.currentElo,
          country: n.nationality,
        })),
      ],
    },
  },
};
const paidEntry = command(paidCaptain, {
  type: "register",
  eventId: paidEvent.id,
});
assert.equal(paidEntry.player.money, 1000 - paidEvent.fee);
const lockedRoster = {
  ...paidEntry,
  esports: {
    ...esportsOf(paidEntry),
    team: {
      ...esportsOf(paidEntry).team!,
      members: esportsOf(paidEntry).team!.members.slice(0, 1),
    },
  },
};
const lockedInvite = esportsCommand(lockedRoster, npcs, {
  type: "recruit",
  npcId: partners[0].id,
});
assert(!lockedInvite.ok && /Cancel esports bookings/.test(lockedInvite.error));
const paidPromotion = command(
  {
    ...onDay(paidEntry, paidEvent.day),
    player: { ...paidEntry.player, rating: 2201 },
  },
  { type: "start", eventId: paidEvent.id },
);
assert.equal(paidPromotion.player.money, 1000);
assert.equal(paidPromotion.history.ledger.at(-1)?.amount, paidEvent.fee);
assert.equal(esportsOf(paidPromotion).active, null);
const promoted = {
  ...onDay(promotionBooking, event.day),
  player: { ...promotionBooking.player, rating: 2201 },
};
const tierCancelled = command(promoted, { type: "start", eventId: event.id });
assert.equal(esportsOf(tierCancelled).active, null);
assert.equal(esportsOf(tierCancelled).entries.length, 0);
assert.equal(tierCancelled.player.money, base.player.money);
assert(
  !esportsCommand(tierCancelled, npcs, { type: "start", eventId: event.id }).ok,
  "tier cancellation cannot refund twice",
);
const complete = esportsOf(s).active!;
assert.equal(complete.status, "finished");
assert.equal(s.yearReview?.current.esportsTournaments, 1);
assert.equal(s.yearReview?.current.esportsWins, Number(complete.rank === 1));
const historyUpdates = reconcileTournamentHistory(s, npcs);
const npcParticipants = complete.teams
  .flatMap((t) => t.members)
  .filter((m) => m.id !== "player");
assert.equal(historyUpdates.length, npcParticipants.length);
for (const n of historyUpdates) {
  const history = n.tournamentHistory.at(-1)!;
  assert.equal(history.eventId, `esports:${complete.event.id}`);
  assert.equal(history.source, "esports");
  assert.equal(history.games, 3);
}
const historyById = new Map(historyUpdates.map((n) => [n.id, n]));
assert.deepEqual(
  reconcileTournamentHistory(
    s,
    npcs.map((n) => historyById.get(n.id) ?? n),
  ),
  [],
);
assert.equal(esportsOf(s).history.length, 1);
assert(complete.rank && complete.rank >= 1 && complete.rank <= 4);
assert.equal(complete.playerPrize, Math.floor(complete.teamPrize / event.size));
for (const f of complete.rounds.flat())
  assert(f.boards.every((b) => b.result !== null));
for (const r of esportsStandings(complete))
  assert.equal(r.wins + r.draws + r.losses, 3);
assert.equal(
  s.player.money,
  base.player.money - event.fee + complete.playerPrize,
);
assert.equal(
  s.registrations.length,
  0,
  "esports does not populate traditional bookings",
);
assert.equal(s.tournament, null);
const cancelled = command(
  command(base, { type: "register", eventId: event.id }),
  { type: "cancel", eventId: event.id },
);
assert.equal(cancelled.player.money, base.player.money);
assert(
  !esportsCommand(cancelled, npcs, { type: "cancel", eventId: event.id }).ok,
);
const conflict = {
  ...base,
  registrations: [
    {
      eventId: "overlap",
      name: "Traditional",
      year: dayStamp(event.day).year,
      week: dayStamp(event.day).week,
      level: "local" as const,
      fieldSize: 16,
      entryFee: 0,
    },
  ],
};
assert(bookingConflict(conflict, event.day, event.day + event.days - 1));
assert.match(esportsEntryIssue(conflict, event, npcs) ?? "", /conflict/);
const standard = getSchedule(base.world.date, region, career.id, 52).find(
  (e) => e.level === "local" && registrationIssue(base, e, npcs) === null,
)!;
const blocked = {
  ...base,
  esports: {
    ...esportsOf(base),
    entries: [
      {
        event: { ...event, day: bookedStart(standard), days: 7 },
        team: complete.teams[0],
      },
    ],
  },
};
assert.match(registrationIssue(blocked, standard, npcs) ?? "", /conflict/);
console.log(
  "PASS tier boundaries, monthly/weekly/qualifier calendars, unique Duo/Trio squads, booking conflicts in both directions, fixture results, prizes, refunds and duplicate guards",
);

let owned = command(base, { type: "create-team", name: "QA Knights", size: 3 });
assert.equal(owned.player.money, base.player.money - 100);
assert(
  !esportsCommand(owned, npcs, {
    type: "create-team",
    name: "Exploit",
    size: 2,
  }).ok,
);
let yes = 0,
  no = 0;
for (const n of npcs
  .filter(
    (n) =>
      n.currentElo >= 800 &&
      n.currentElo <= 1200 &&
      n.careerStatus === "active",
  )
  .slice(0, 80)) {
  const candidate = esportsCommand(owned, npcs, {
    type: "recruit",
    npcId: n.id,
  });
  assert(candidate.ok);
  if (
    esportsOf(candidate.save).team!.members.length >
    esportsOf(owned).team!.members.length
  ) {
    yes++;
    owned = candidate.save;
  } else {
    no++;
    assert(
      !esportsCommand(candidate.save, npcs, { type: "recruit", npcId: n.id })
        .ok,
    );
  }
  if (esportsOf(owned).team!.members.length === 3) break;
}
assert(yes === 2);
assert(no > 0, "at least one deterministic invitation is refused");
assert(
  !esportsCommand(owned, npcs, { type: "recruit", npcId: npcs[0].id }).ok,
  "full roster guard",
);
const veteran = {
  ...base,
  player: { ...base.player, rating: 2800, money: 10000 },
  esports: {
    ...esportsOf(base),
    form: Array(10).fill(
      "win",
    ) as GameSave["history"]["games"][number]["outcome"][],
  },
};
assert(
  offerChance(veteran, "crown") > 0 && offerChance(veteran, "crown") <= 0.008,
);
assert.equal(offerChance(base, "crown"), 0);
const advanced = advanceEsports(onDay(veteran, gameDay(veteran) + 7), npcs),
  again = advanceEsports(advanced, npcs);
assert.deepEqual(esportsOf(again).offers, esportsOf(advanced).offers);
assert.equal(again.player.money, advanced.player.money);
const offer = {
  id: "test-offer",
  organizationId: "crown",
  day: gameDay(veteran),
  expires: gameDay(veteran) + 14,
  size: 2 as const,
};
const signed = command(
  { ...veteran, esports: { ...esportsOf(veteran), offers: [offer] } },
  { type: "accept-offer", offerId: offer.id },
);
assert(
  !esportsCommand(signed, npcs, { type: "accept-offer", offerId: offer.id }).ok,
);
const paid = advanceEsports(onDay(signed, gameDay(signed) + 7), npcs),
  org = ORGANIZATIONS.find((o) => o.id === "crown")!;
assert.equal(paid.player.money, signed.player.money + org.salary);
assert.equal(advanceEsports(paid, npcs).player.money, paid.player.money);
const expired = advanceEsports(onDay(paid, gameDay(signed) + 84), npcs);
assert.equal(esportsOf(expired).team, null);
assert.equal(expired.player.money, signed.player.money + org.salary * 12);
const migrated = upgradeSave({ ...base, esports: undefined });
assert(migrated.esports);
assert.deepEqual(upgradeSave(migrated), migrated);
assert.deepEqual(JSON.parse(JSON.stringify(owned)).esports, owned.esports);
for (const focus of ["traditional", "esports", "mixed"] as const) {
  const changed = command(base, { type: "focus", focus });
  assert.equal(changed.player.rating, base.player.rating);
  assert(esportsEntryIssue(changed, event, npcs) === null);
}
console.log(
  "PASS team creation costs, accept/decline and 14-day cooldown, complete rosters, rare elite offers, no reload rerolls, contract salary/expiry, focus freedom and migration",
);

assert.equal(
  teamRating({
    ...esportsOf(owned).team!,
    members: [
      { id: "player", name: "A", elo: 2000, country: "TH" },
      { id: "npc", name: "B", elo: 2001, country: "TH" },
    ],
  }),
  2001,
  "team averages use the same integer Elo shown in the UI",
);

const { createMemorySlotBackend, idbSlotBackend } = await import(
  "../src/store/saveSlots.ts"
);
const { createMemoryNpcBackend, idbNpcBackend } = await import(
  "../src/store/npcRepository.ts"
);
Object.assign(idbSlotBackend, createMemorySlotBackend());
Object.assign(idbNpcBackend, createMemoryNpcBackend());
const { useGameStore } = await import("../src/store/gameStore.ts"),
  { useNpcStore } = await import("../src/store/npcStore.ts");
await useGameStore.persist.rehydrate();
useNpcStore.setState({
  npcs,
  status: "ready",
  careerId: career.id,
  startYear: 2026,
});
let sessionSave = command(base, { type: "register", eventId: event.id });
useGameStore.setState({ save: sessionSave });
const forwarded = await useGameStore.getState().simulateUntil(event.id, []);
assert(forwarded.ok);
assert.equal(gameDay(useGameStore.getState().save!), event.day);
assert(
  useGameStore.getState().esportsAction({ type: "start", eventId: event.id })
    .ok,
);
sessionSave = useGameStore.getState().save!;
const target = nextEsportsGame(sessionSave)!,
  opponent = npcs.find((n) => n.id === target.opponent.id)!;
const esportsPrep = prepareEvent(
  setCompetitionConfig(sessionSave, { target: event.id }),
  db,
);
assert(esportsPrep.ok, esportsPrep.ok ? "" : esportsPrep.error);
const esportsScouted = scoutOpponent(esportsPrep.save, opponent, event.id);
assert(esportsScouted.ok, esportsScouted.ok ? "" : esportsScouted.error);
assert.equal(esportsScouted.save.competition?.scouts.at(-1)?.eventId, event.id);
assert.equal(
  esportsScouted.save.player.money,
  esportsPrep.save.player.money - 10,
);
const built = buildMatchSetup({
  save: sessionSave,
  npc: opponent,
  playerColor: target.color,
  timeControl: event.timeControl,
  rated: true,
  mode: "play",
  speed: "fast",
  tournament: target.tournament,
  seed: 1,
  db,
});
const setup = { ...built, esports: target.context };
const finish = {
  setup,
  result: target.color,
  termination: "resignation" as const,
  moves: ["e4", "e5", "Nf3", "Nc6"],
  ucis: ["e2e4", "e7e5", "g1f3", "b8c6"],
  controlLog: [],
  playerMoved: true,
};
assert(useGameStore.getState().finishMatch(finish, db));
const saved = useGameStore.getState().save!;
assert.equal(esportsOf(saved).active?.round, 2);
assert.equal(saved.history.games.length, 1);
assert.equal(saved.prediction?.metrics.career.adjusted.games, 1);
assert((saved.prediction?.metrics.npc.adjusted.games ?? 0) > 0);
assert(
  esportsOf(saved).active!.rounds[0].every((f) =>
    f.boards.every((b) => b.prediction && b.result !== null),
  ),
);
assert.equal(saved.matches[0].setup.esports?.eventId, event.id);
assert.equal(useGameStore.getState().finishMatch(finish, db), null);
assert.equal(useGameStore.getState().save!.history.games.length, 1);
if (esportsRoundDay(esportsOf(saved).active!) > gameDay(saved))
  assert(useGameStore.getState().advanceCompetitionDay("esports").ok);
const current = useGameStore.getState().save!,
  nextTarget = nextEsportsGame(current)!;
// A new round must freeze a NEW pre-match forecast, rather than reusing the first round's immutable setup.
const recoverSetup = {
  ...buildMatchSetup({
    save: current,
    npc: npcs.find((n) => n.id === nextTarget.opponent.id)!,
    playerColor: nextTarget.color,
    timeControl: event.timeControl,
    rated: true,
    mode: "play",
    speed: "fast",
    tournament: nextTarget.tournament,
    seed: 2,
    db,
  }),
  esports: nextTarget.context,
};
const pending = {
  setup: recoverSetup,
  ucis: ["e2e4", "e7e5"],
  playerMoved: true,
};
const recovered = recoverPendingMatch(
  { ...current, pendingMatch: pending },
  db,
);
assert(recovered.record);
assert.equal(esportsOf(recovered.save).active?.round, 3);
assert.equal(recovered.save.prediction?.metrics.career.adjusted.games, 2);
assert.notEqual(recoverSetup.prediction?.id, setup.prediction?.id);
assert.equal(recoverPendingMatch(recovered.save, db).record, null);
console.log(
  "PASS real store integration: shared calendar simulation, played-game progression/rating/history, once-only result, next match day and abandoned-game recovery",
);

const seven = rotations.find(
  (e) => e.details?.format === "round-robin" && e.details.agenda?.days === 7,
)!;
const startDay = bookedStart(seven);
const sevenTournament = {
  ...createTournament({
    event: seven,
    player: {
      name: base.player.name,
      rating: base.player.rating,
      country: "TH",
      title: "none",
    },
    npcs: field,
    fieldIds: field.map((n) => n.id),
    seed: 12,
  }),
  startedOnDay: startDay,
};
useGameStore.setState({
  save: { ...onDay(base, startDay), tournament: sevenTournament },
});
let played = 0,
  advancedDays = 0;
while (useGameStore.getState().save!.tournament!.status === "playing") {
  assert(played < 6);
  let current = useGameStore.getState().save!,
    t = current.tournament!;
  if (!tournamentReady(current)) {
    const due = tournamentSlot(t).absoluteDay,
      before = gameDay(current);
    const next = playerOpponentId(t)!;
    const invalid = {
      ...finish,
      setup: {
        ...setup,
        esports: undefined,
        tournament: {
          id: t.eventId,
          name: t.name,
          level: t.level,
          round: t.round,
          rounds: t.rounds,
        },
      },
    };
    assert.equal(
      useGameStore.getState().finishMatch(invalid, db),
      null,
      "future-day game must be rejected",
    );
    assert(useGameStore.getState().advanceCompetitionDay("traditional").ok);
    current = useGameStore.getState().save!;
    t = current.tournament!;
    advancedDays += gameDay(current) - before;
    assert.equal(gameDay(current), due);
    assert.equal(current.player.ap.current, 10);
  }
  const target = playerOpponentId(t)!,
    npc = npcs.find((n) => n.id === target.id)!;
  const regular = buildMatchSetup({
    save: current,
    npc,
    playerColor: target.color,
    timeControl: t.timeControl,
    rated: true,
    mode: "play",
    speed: "fast",
    tournament: {
      id: t.eventId,
      name: t.name,
      level: t.level,
      round: t.round,
      rounds: t.rounds,
    },
    seed: played + 100,
    db,
  });
  assert(
    useGameStore
      .getState()
      .finishMatch({ ...finish, setup: regular, result: target.color }, db),
  );
  const persisted = useGameStore.getState().save!;
  const stale = recoverPendingMatch(
    {
      ...persisted,
      pendingMatch: {
        setup: regular,
        ucis: ["e2e4", "e7e5"],
        playerMoved: true,
      },
    },
    db,
  );
  assert.equal(
    stale.record,
    null,
    "a stale previous-round checkpoint cannot charge rating or advance the new round",
  );
  assert.equal(stale.save.history.games.length, persisted.history.games.length);
  played++;
}
assert.equal(played, 5);
assert.equal(advancedDays, 6);
assert.equal(gameDay(useGameStore.getState().save!), startDay + 6);
assert.equal(useGameStore.getState().save!.history.tournaments.length, 1);
console.log(
  "PASS seven-day tournament actually advances six calendar days, restores daily AP and rejects future-round results",
);
