import { trackYearActivity } from "@/game/career/yearReview";
import type { GameSave, GameOutcome, Npc } from "@/types";
import {
  gameDay,
  bookedStart,
  bookedEnd,
  reservedUntil,
  eventAgenda,
  tournamentSlot,
  roundSlot,
} from "@/game/competition/agenda";
import { ORGANIZATIONS, tierRule, esportsEvents } from "./catalog";
import type {
  EsportsState,
  EsportsMember,
  EsportsTeam,
  EsportsEntry,
  EsportsEvent,
  EsportsCommand,
  EsportsCompetition,
  EsportsFixture,
  EsportsGameTarget,
} from "./types";
import { createRng, mixSeed } from "@/game/rng";
import { hashString } from "@/utils/format";
import {
  npcActor,
  playerActor,
  ratingActor,
  conditionsFor,
  predictionStamp,
  plannedOpeningConditions,
} from "@/game/prediction/adapters";
import {
  predictMatch,
  sampleOutcome,
  scoreOf,
  outcomeOf,
} from "@/game/prediction/model";
import { predictionOf, recordPredictions } from "@/game/prediction/statistics";
export const emptyEsports = (day = 0): EsportsState => ({
  sequence: 0,
  focus: "mixed",
  team: null,
  offers: [],
  lastRecruitWeek: Math.floor(day / 7),
  recruitAttempts: [],
  entries: [],
  active: null,
  history: [],
  form: [],
  qualifications: [],
  notices: [],
});
export const esportsOf = (save: GameSave): EsportsState => ({
  ...emptyEsports(gameDay(save)),
  ...save.esports,
});
const activeNpc = (n: Npc) =>
  n.careerStatus === "active" || n.careerStatus === "semi-retired";
const populationCache = new WeakMap<
  Npc[],
  { byId: Map<string, Npc>; active: Npc[] }
>();
function population(npcs: Npc[]) {
  let cached = populationCache.get(npcs);
  if (!cached) {
    cached = {
      byId: new Map(npcs.map((n) => [n.id, n])),
      active: npcs.filter(activeNpc),
    };
    populationCache.set(npcs, cached);
  }
  return cached;
}
export const memberFor = (n: Npc): EsportsMember => ({
  predictionActor: npcActor(n),
  id: n.id,
  name: n.name,
  elo: n.currentElo,
  country: n.nationality,
});
const playerMember = (save: GameSave): EsportsMember => ({
  predictionActor: playerActor(save),
  id: "player",
  name: save.player.name,
  elo: save.player.rating,
  country: save.player.country,
});
export const teamRating = (team: EsportsTeam) =>
  Math.round(
    team.members.reduce((sum, p) => sum + p.elo, 0) /
      Math.max(1, team.members.length),
  );

const notice = (state: EsportsState, text: string): EsportsState => ({
  ...state,
  notices: [...state.notices, text].slice(-12),
});
const money = (
  save: GameSave,
  amount: number,
  label: string,
  key: string,
): GameSave => ({
  ...save,
  player: { ...save.player, money: Math.max(0, save.player.money + amount) },
  history: {
    ...save.history,
    ledger: [
      ...save.history.ledger,
      {
        ...save.world.date,
        id: `esports-${key}-${esportsOf(save).sequence}`,
        kind: key.startsWith("salary")
          ? "sponsorship"
          : key.startsWith("refund")
            ? "other"
            : key === "create"
              ? "expense"
              : amount > 0
                ? "prize"
                : "entry-fee",
        label,
        amount,
      },
    ],
  },
});
const liveTeam = (
  save: GameSave,
  team: EsportsTeam,
  npcs: Npc[],
): EsportsTeam => {
  const byId = population(npcs).byId;
  return {
    ...team,
    members: team.members.flatMap((m) =>
      m.id === "player"
        ? [playerMember(save)]
        : byId.has(m.id) && activeNpc(byId.get(m.id)!)
          ? [memberFor(byId.get(m.id)!)]
          : [],
    ),
  };
};
export function organizationRoster(id: string, npcs: Npc[], count = 3): Npc[] {
  const org = ORGANIZATIONS.find((o) => o.id === id);
  if (!org) return [];
  return [...population(npcs).active]
    .sort(
      (a, b) =>
        Math.abs(a.currentElo - org.min) - Math.abs(b.currentElo - org.min) ||
        hashString(`${id}:${a.id}`) - hashString(`${id}:${b.id}`),
    )
    .slice(0, count);
}
export function offerChance(save: GameSave, organizationId: string): number {
  const org = ORGANIZATIONS.find((o) => o.id === organizationId),
    state = esportsOf(save);
  if (
    !org ||
    state.team ||
    save.player.rating < org.min ||
    state.form.length < (org.prestige >= 90 ? 10 : 3)
  )
    return 0;
  const form =
    state.form
      .slice(-10)
      .reduce((s, r) => s + (r === "win" ? 1 : r === "draw" ? 0.5 : 0), 0) /
    Math.min(10, state.form.length);
  if (form < 0.4 || (org.prestige >= 90 && form < 0.7)) return 0;
  const skill =
    (save.player.skills.tactics +
      save.player.skills.calculation +
      save.player.skills.timeManagement) /
    300;
  return org.prestige >= 90
    ? Math.min(0.008, 0.002 + 0.004 * form + 0.002 * skill)
    : Math.min(
        0.35,
        0.035 +
          form * 0.13 +
          Math.max(0, save.player.rating - org.min) / 5000 +
          skill * 0.04,
      );
}
export function recruitmentChance(save: GameSave, npc: Npc): number {
  const team = esportsOf(save).team;
  if (
    !team?.owner ||
    !activeNpc(npc) ||
    team.members.some((m) => m.id === npc.id) ||
    npc.currentElo > save.player.rating + 600
  )
    return 0;
  return Math.min(
    0.9,
    Math.max(
      0.05,
      0.5 +
        (save.player.rating - npc.currentElo) / 1200 +
        team.prestige / 500 +
        (save.player.reputation - 20) / 1000 -
        Math.max(0, npc.form - 70) / 300,
    ),
  );
}
export const esportsRoundDay = (c: EsportsCompetition) =>
  c.event.day + roundSlot(c.round, 3, c.event.days, 30).day;
export function bookingConflict(
  save: GameSave,
  from: number,
  to: number,
  ignoreId?: string,
): boolean {
  const overlap = (a: number, b: number) => from <= b && a <= to;
  if (
    save.registrations.some(
      (r) =>
        r.eventId !== ignoreId && overlap(bookedStart(r), reservedUntil(r)),
    )
  )
    return true;
  if (save.tournament?.status === "playing") {
    const t = save.tournament,
      start = t.startedOnDay ?? bookedStart(t);
    if (
      t.eventId !== ignoreId &&
      overlap(
        start,
        start +
          eventAgenda({ details: t.details, fieldSize: t.players.length })
            .days -
          1,
      )
    )
      return true;
  }
  const state = esportsOf(save);
  if (
    state.entries.some(
      (r) =>
        r.event.id !== ignoreId &&
        overlap(r.event.day, r.event.day + r.event.days - 1),
    )
  )
    return true;
  return !!(
    state.active?.status === "playing" &&
    state.active.event.id !== ignoreId &&
    overlap(
      state.active.event.day,
      state.active.event.day + state.active.event.days - 1,
    )
  );
}
export function esportsEntryIssue(
  save: GameSave,
  e: EsportsEvent,
  npcs: Npc[],
): string | null {
  const state = esportsOf(save),
    now = gameDay(save),
    rule = tierRule(e.tier);
  if (now > e.deadline) return "Registration closed.";
  if (
    state.entries.some((r) => r.event.id === e.id) ||
    state.active?.event.id === e.id ||
    state.history.some((c) => c.event.id === e.id)
  )
    return "Already entered or played.";
  if (bookingConflict(save, e.day, e.day + e.days - 1))
    return "Schedule conflict with another competition.";
  const min = e.cadence === "Qualifier" && e.tier === "D" ? 0 : rule.min;
  if (save.player.rating < min || save.player.rating > rule.max)
    return `Player Elo must be ${min}–${Number.isFinite(rule.max) ? rule.max : "3500+"}.`;
  if (
    e.cadence === "Monthly" &&
    !state.qualifications.some((q) => q.tier === e.tier && q.expires >= e.day)
  )
    return "Earn a qualifier top-two finish for this tier first.";
  if (state.team) {
    const roster = liveTeam(save, state.team, npcs);
    if (
      roster.contractEnd !== undefined &&
      e.day + e.days - 1 > roster.contractEnd
    )
      return "Your contract expires before this event ends.";
    if (roster.size !== e.size)
      return `This event needs a ${e.size === 2 ? "Duo" : "Trio"} roster.`;
    if (roster.members.length !== e.size)
      return "Complete your roster with active players.";
    if (teamRating(roster) < min || teamRating(roster) > rule.max)
      return "Team average Elo is outside the tier band.";
  } else if (e.cadence !== "Qualifier")
    return "Join or form a team; Free Agents can enter qualifiers with an event-only pickup squad.";
  if (save.player.money < e.fee)
    return "Insufficient funds for the team entry fee.";
  if (population(npcs).active.length < e.size * 4 - 1)
    return "Wait for enough active NPC participants.";
  return null;
}
function pickupTeam(save: GameSave, e: EsportsEvent, npcs: Npc[]): EsportsTeam {
  const others = [...population(npcs).active]
    .sort(
      (a, b) =>
        Math.abs(a.currentElo - save.player.rating) -
          Math.abs(b.currentElo - save.player.rating) ||
        hashString(`${e.id}:${a.id}`) - hashString(`${e.id}:${b.id}`),
    )
    .slice(0, e.size - 1);
  return {
    id: `pickup-${e.id}`,
    name: `${save.player.name}'s Pickup`,
    size: e.size,
    owner: false,
    prestige: 0,
    members: [playerMember(save), ...others.map(memberFor)],
  };
}
function competitionFor(
  save: GameSave,
  entry: EsportsEntry,
  npcs: Npc[],
): EsportsCompetition {
  const e = entry.event,
    team = liveTeam(save, entry.team, npcs),
    used = new Set(team.members.map((m) => m.id));
  const teams: EsportsTeam[] = [team];
  const rule = tierRule(e.tier),
    target =
      e.cadence === "Qualifier" && e.tier === "D"
        ? save.player.rating
        : (rule.min + Math.min(3000, rule.max)) / 2;
  const pool = [...population(npcs).active].sort(
    (a, b) =>
      Math.abs(a.currentElo - target) - Math.abs(b.currentElo - target) ||
      hashString(`${e.id}:${a.id}`) - hashString(`${e.id}:${b.id}`),
  );
  for (let i = 0; i < 3; i++) {
    const selected = pool.filter((n) => !used.has(n.id)).slice(0, e.size);
    selected.forEach((n) => used.add(n.id));
    teams.push({
      id: `${e.id}-team-${i}`,
      name: [
        `Circuit ${e.tier} Knights`,
        `Circuit ${e.tier} Rooks`,
        `Circuit ${e.tier} Bishops`,
      ][i],
      size: e.size,
      owner: false,
      prestige: rule.min / 30,
      members: selected.map(memberFor),
    });
  }
  const roundPairs = [
    [
      [0, 3],
      [1, 2],
    ],
    [
      [0, 2],
      [3, 1],
    ],
    [
      [0, 1],
      [2, 3],
    ],
  ];
  const rounds = roundPairs.map((pairs, r) =>
    pairs.map(([ai, bi], i) => {
      const a = teams[ai],
        b = teams[bi];
      return {
        id: `${e.id}-r${r + 1}-${i}`,
        home: a.id,
        away: b.id,
        boards: a.members.map((m, j) => ({
          white: (r + j) % 2 ? b.members[j] : m,
          black: (r + j) % 2 ? m : b.members[j],
          result: null,
        })),
      };
    }),
  );
  return freezeEsportsRound(save, {
    event: e,
    teams,
    round: 1,
    rounds,
    status: "playing",
    rank: null,
    teamPrize: 0,
    playerPrize: 0,
  });
}
export function esportsStandings(c: EsportsCompetition) {
  const rows = c.teams.map((team) => ({
    team,
    points: 0,
    boardPoints: 0,
    wins: 0,
    draws: 0,
    losses: 0,
  }));
  const byId = new Map(rows.map((r) => [r.team.id, r]));
  for (const fixture of c.rounds.flat()) {
    if (fixture.boards.some((b) => b.result === null)) continue;
    const home = byId.get(fixture.home)!,
      away = byId.get(fixture.away)!;
    const homeIds = new Set(home.team.members.map((m) => m.id));
    const score = fixture.boards.reduce(
        (sum, b) => sum + (homeIds.has(b.white.id) ? b.result! : 1 - b.result!),
        0,
      ),
      other = fixture.boards.length - score;
    home.boardPoints += score;
    away.boardPoints += other;
    if (score > other) {
      home.points += 3;
      home.wins++;
      away.losses++;
    } else if (score < other) {
      away.points += 3;
      away.wins++;
      home.losses++;
    } else {
      home.points++;
      away.points++;
      home.draws++;
      away.draws++;
    }
  }
  return rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.boardPoints - a.boardPoints ||
      a.team.id.localeCompare(b.team.id),
  );
}
export function nextEsportsGame(save: GameSave): EsportsGameTarget | null {
  const c = esportsOf(save).active;
  if (!c || c.status !== "playing") return null;
  const fixture = c.rounds[c.round - 1]?.find((f) =>
    f.boards.some((b) => b.white.id === "player" || b.black.id === "player"),
  );
  const board = fixture?.boards.find(
    (b) =>
      (b.white.id === "player" || b.black.id === "player") && b.result === null,
  );
  if (!board) return null;
  const color = board.white.id === "player" ? "white" : "black",
    opponent = color === "white" ? board.black : board.white;
  return {
    opponent,
    color,
    context: { eventId: c.event.id, round: c.round, opponentId: opponent.id },
    tournament: {
      id: c.event.id,
      name: c.event.name,
      level: c.event.tier === "S" ? "elite" : "international",
      round: c.round,
      rounds: 3,
    },
  };
}
export function esportsContextValid(
  save: GameSave,
  context: NonNullable<import("@/types").MatchSetupLite["esports"]>,
): boolean {
  const c = esportsOf(save).active,
    target = nextEsportsGame(save);
  return !!(
    c &&
    target &&
    target.context.eventId === context.eventId &&
    target.context.round === context.round &&
    target.context.opponentId === context.opponentId &&
    esportsRoundDay(c) === gameDay(save)
  );
}
export function freezeEsportsRound(
  save: GameSave,
  c: EsportsCompetition,
): EsportsCompetition {
  return {
    ...c,
    rounds: c.rounds.map((round, i) =>
      i !== c.round - 1
        ? round
        : round.map((f) => ({
            ...f,
            boards: f.boards.map((b) => {
              if (b.prediction || b.result !== null) return b;
              const actor = (m: EsportsMember) =>
                m.id === "player"
                  ? playerActor(save)
                  : (m.predictionActor ?? ratingActor(m.elo, m.name, m.id));
              return {
                ...b,
                prediction: predictMatch({
                  id: `esports:${save.career.id}:${f.id}:${b.white.id}:${b.black.id}`,
                  stamp: predictionStamp(save),
                  player: actor(b.white),
                  opponent: actor(b.black),
                  conditions: {
                    ...plannedOpeningConditions(
                      actor(b.white),
                      actor(b.black),
                      conditionsFor(
                        c.event.timeControl.category,
                        "white",
                        `esports-${c.event.tier}`,
                      ),
                    ),
                    tournamentName: c.event.name,
                    importance: c.event.tier === "S" ? 1 : 0.6,
                    pressure: c.round / 3,
                  },
                  state: predictionOf(save),
                }),
              };
            }),
          })),
    ),
  };
}
function finishRound(
  save: GameSave,
  outcome: GameOutcome,
  forfeit = false,
): GameSave {
  const state = esportsOf(save),
    c = state.active ? freezeEsportsRound(save, state.active) : null;
  if (!c || c.status !== "playing") return save;
  const rng = createRng(
    mixSeed(save.world.seed, hashString(`${c.event.id}:${c.round}`)),
  );
  const rounds = c.rounds.map((r, i) =>
    i !== c.round - 1
      ? r
      : r.map((f) => ({
          ...f,
          boards: f.boards.map((b) =>
            b.result !== null
              ? b
              : {
                  ...b,
                  result:
                    b.white.id === "player"
                      ? outcome === "win"
                        ? 1
                        : outcome === "draw"
                          ? 0.5
                          : 0
                      : b.black.id === "player"
                        ? outcome === "win"
                          ? 0
                          : outcome === "draw"
                            ? 0.5
                            : 1
                        : scoreOf(
                            sampleOutcome(b.prediction!.adjusted, rng.next()),
                          ),
                },
          ),
        })),
  );
  let next: EsportsCompetition = {
    ...c,
    rounds,
    ...(forfeit ? { withdrawn: true } : {}),
    status: c.round === 3 ? "finished" : "playing",
    round: c.round === 3 ? 3 : c.round + 1,
  };
  let result: GameSave = {
    ...save,
    esports: {
      ...state,
      sequence: state.sequence + 1,
      active: next,
      form: [...state.form, outcome].slice(-20),
    },
  };
  result = recordPredictions(
    result,
    rounds[c.round - 1].flatMap((f) =>
      f.boards.flatMap((b) =>
        b.prediction &&
        b.result !== null &&
        b.white.id !== "player" &&
        b.black.id !== "player"
          ? [
              {
                prediction: b.prediction,
                result: outcomeOf(b.result),
                scope: "npc" as const,
                source: "abstract" as const,
                eligible: true,
              },
            ]
          : [],
      ),
    ),
  );
  if (next.status !== "finished") {
    next = freezeEsportsRound(result, next);
    result = { ...result, esports: { ...esportsOf(result), active: next } };
  }
  if (next.status === "finished") {
    const own = next.teams.find((t) =>
      t.members.some((m) => m.id === "player"),
    )!;
    const rank =
      esportsStandings(next).findIndex((r) => r.team.id === own.id) + 1;
    const gross = next.withdrawn
        ? 0
        : Math.round(
            next.event.prize * ([0.5, 0.3, 0.15, 0.05][rank - 1] ?? 0),
          ),
      share = Math.floor(gross / next.event.size);
    next = { ...next, rank, teamPrize: gross, playerPrize: share };
    let qualifications = state.qualifications;
    if (!next.withdrawn && next.event.cadence === "Qualifier" && rank <= 2)
      qualifications = [
        ...qualifications.filter((q) => q.tier !== next.event.tier),
        {
          tier: next.event.tier,
          expires: gameDay(save) + 42,
          source: next.event.id,
        },
      ];
    result = {
      ...result,
      esports: notice(
        {
          ...esportsOf(result),
          active: next,
          history: [...state.history, next].slice(-60),
          entries: state.entries.filter((r) => r.event.id !== next.event.id),
          qualifications,
        },
        `${next.event.name}: #${rank}; your prize $${share}.`,
      ),
    };
    result = trackYearActivity(
      save,
      result,
      "esports",
      undefined,
      next.withdrawn ? Infinity : rank,
    );
    if (share)
      result = money(
        result,
        share,
        `Esports prize: ${next.event.name}`,
        next.event.id,
      );
  }
  return result;
}
export function reportEsportsGame(
  save: GameSave,
  context: NonNullable<import("@/types").MatchSetupLite["esports"]>,
  outcome: GameOutcome,
): GameSave {
  return esportsContextValid(save, context) ? finishRound(save, outcome) : save;
}
function withdrawEsports(save: GameSave): GameSave {
  let next = save;
  for (let i = 0; i < 3 && esportsOf(next).active?.status === "playing"; i++)
    next = finishRound(next, "loss", true);
  return next;
}
export type EsportsResult =
  | { ok: true; save: GameSave; message: string }
  | { ok: false; error: string };
export function esportsCommand(
  save: GameSave,
  npcs: Npc[],
  command: EsportsCommand,
): EsportsResult {
  let state = esportsOf(save),
    next = save,
    message = "Saved.";
  const now = gameDay(save);
  const fail = (error: string): EsportsResult => ({ ok: false, error });
  if (
    state.active?.status === "playing" &&
    !["withdraw", "focus", "register", "cancel"].includes(command.type)
  )
    return fail("Finish or withdraw from the current esports event first.");
  if (command.type === "focus") {
    if (!["traditional", "esports", "mixed"].includes(command.focus))
      return fail("Invalid career focus.");
    state = { ...state, focus: command.focus };
  } else if (command.type === "create-team") {
    if (state.team) return fail("Leave your current team before creating one.");
    if (state.entries.length)
      return fail("Cancel pickup bookings before creating a team.");
    if (command.size !== 2 && command.size !== 3)
      return fail("Choose Duo or Trio.");
    const name = command.name.trim();
    if (name.length < 2 || name.length > 40)
      return fail("Team name must be 2–40 characters.");
    if (save.player.money < 100) return fail("Creating a team costs $100.");
    state = {
      ...state,
      team: {
        id: `owned-${save.career.id}-${state.sequence}`,
        name,
        size: command.size,
        owner: true,
        prestige: 10,
        members: [playerMember(save)],
      },
      offers: [],
    };
    next = money(save, -100, `Create esports team: ${name}`, "create");
    message = "Team created. Recruit teammates to complete your roster.";
  } else if (command.type === "recruit") {
    if (state.entries.length)
      return fail("Cancel esports bookings before changing your roster.");
    const team = state.team,
      npc = npcs.find((n) => n.id === command.npcId);
    if (!team?.owner || !npc)
      return fail("Choose an active NPC for your own team.");
    if (team.members.length >= team.size) return fail("Your roster is full.");
    if (team.members.some((m) => m.id === npc.id))
      return fail("This player is already on your roster.");
    if (
      state.recruitAttempts.some((a) => a.npcId === npc.id && now - a.day < 14)
    )
      return fail("Wait 14 days before approaching this player again.");
    const chance = recruitmentChance(save, npc),
      accepted = createRng(
        hashString(`${save.career.id}:${npc.id}:${Math.floor(now / 14)}`),
      ).chance(chance);
    state = {
      ...state,
      recruitAttempts: [
        ...state.recruitAttempts.filter((a) => now - a.day < 28),
        { npcId: npc.id, day: now, accepted },
      ].slice(-300),
      team: accepted
        ? { ...team, members: [...team.members, memberFor(npc)] }
        : team,
    };
    message = accepted
      ? `${npc.name} accepted your invitation.`
      : `${npc.name} declined. You can approach them again in 14 days.`;
  } else if (command.type === "release") {
    if (
      !state.team?.owner ||
      command.npcId === "player" ||
      !state.team.members.some((m) => m.id === command.npcId)
    )
      return fail("Select a teammate from your own roster.");
    if (state.entries.length)
      return fail("Cancel esports bookings before changing your roster.");
    state = {
      ...state,
      team: {
        ...state.team,
        members: state.team.members.filter((m) => m.id !== command.npcId),
      },
    };
  } else if (command.type === "leave-team") {
    if (state.entries.length)
      return fail("Cancel esports bookings before leaving your team.");
    if (!state.team) return fail("You are already a Free Agent.");
    state = { ...state, team: null, offers: [] };
    message = "You are a Free Agent.";
  } else if (command.type === "accept-offer") {
    const offer = state.offers.find((o) => o.id === command.offerId),
      org = ORGANIZATIONS.find((o) => o.id === offer?.organizationId);
    if (state.team || !offer || !org || offer.expires < now)
      return fail("This offer is no longer available.");
    if (state.entries.length)
      return fail(
        "Complete or cancel pickup bookings before signing a contract.",
      );
    if (save.player.rating < org.min)
      return fail("Your rating is now below this organization’s requirement.");
    const roster = organizationRoster(org.id, npcs, offer.size - 1);
    if (roster.length < offer.size - 1)
      return fail("The organization cannot provide a complete active roster.");
    state = {
      ...state,
      offers: [],
      team: {
        id: `org-${org.id}`,
        name: org.name,
        size: offer.size,
        owner: false,
        prestige: org.prestige,
        organizationId: org.id,
        contractStart: now,
        contractEnd: now + 84,
        salary: org.salary,
        paidWeeks: 0,
        members: [playerMember(save), ...roster.map(memberFor)],
      },
    };
    message = `Signed with ${org.name} for 12 weeks.`;
  } else if (command.type === "register") {
    const event = esportsEvents(now, save.career.id).find(
      (e) => e.id === command.eventId,
    );
    if (!event) return fail("This esports event is unavailable.");
    const issue = esportsEntryIssue(save, event, npcs);
    if (issue) return fail(issue);
    const team = state.team
      ? liveTeam(save, state.team, npcs)
      : pickupTeam(save, event, npcs);
    const rule = tierRule(event.tier),
      min = event.cadence === "Qualifier" && event.tier === "D" ? 0 : rule.min;
    if (teamRating(team) < min || teamRating(team) > rule.max)
      return fail("The pickup squad average Elo is outside this tier.");
    state = { ...state, entries: [...state.entries, { event, team }] };
    next = money(save, -event.fee, `Esports entry: ${event.name}`, event.id);
    message = "Team registered. The squad and entry fee are saved.";
  } else if (command.type === "cancel") {
    const entry = state.entries.find((r) => r.event.id === command.eventId);
    if (!entry) return fail("No such esports booking.");
    if (now < entry.event.day)
      next = money(
        save,
        entry.event.fee,
        `Refund: ${entry.event.name}`,
        `refund-${entry.event.id}`,
      );
    state = { ...state, entries: state.entries.filter((r) => r !== entry) };
    message =
      now < entry.event.day
        ? "Booking cancelled and entry fee refunded."
        : "Missed booking removed; the fee is lost.";
  } else if (command.type === "start") {
    const entry = state.entries.find((r) => r.event.id === command.eventId);
    if (!entry) return fail("Register before starting this event.");
    if (now !== entry.event.day)
      return fail(
        now < entry.event.day
          ? "Wait for the starting day."
          : "This event has already started.",
      );
    if (save.pendingMatch || save.tournament?.status === "playing")
      return fail("Finish the running game or traditional tournament first.");
    const team = liveTeam(save, entry.team, npcs);
    if (team.members.length !== entry.event.size)
      return fail(
        "An entrant is inactive. Cancel this booking and rebuild the roster.",
      );
    if (population(npcs).active.length < entry.event.size * 4 - 1)
      return fail("Not enough active opponents.");
    const rule = tierRule(entry.event.tier),
      min =
        entry.event.cadence === "Qualifier" && entry.event.tier === "D"
          ? 0
          : rule.min;
    if (
      save.player.rating < min ||
      save.player.rating > rule.max ||
      teamRating(team) < min ||
      teamRating(team) > rule.max
    ) {
      next = money(
        save,
        entry.event.fee,
        `Tier change refund: ${entry.event.name}`,
        `refund-tier-${entry.event.id}`,
      );
      state = { ...state, entries: state.entries.filter((r) => r !== entry) };
      message =
        "Your player or team Elo moved outside this tier. The booking was cancelled and its entry fee refunded; enter your current tier.";
    } else {
      state = {
        ...state,
        active: competitionFor(save, { ...entry, team }, npcs),
        entries: state.entries.filter((r) => r !== entry),
      };
      message = "Esports event started.";
    }
  } else if (command.type === "withdraw") {
    return {
      ok: true,
      save: withdrawEsports(save),
      message:
        "Remaining esports fixtures forfeited; no prize or qualification.",
    };
  } else if (command.type === "close") {
    if (state.active?.status === "playing")
      return fail("The event is still running.");
    state = { ...state, active: null };
  } else return fail("Unknown esports action.");
  state = { ...state, sequence: state.sequence + 1 };
  return {
    ok: true,
    save: { ...next, esports: notice(state, message) },
    message,
  };
}
/** Daily maintenance is deterministic, bounded and persisted; reloads cannot reroll offers or repeat salary. */
export function advanceEsports(save: GameSave, npcs: Npc[]): GameSave {
  let state = esportsOf(save),
    next = save;
  const now = gameDay(save),
    week = Math.floor(now / 7);
  if (
    state.active?.status === "playing" &&
    esportsRoundDay(state.active) < now
  ) {
    next = withdrawEsports({ ...next, esports: state });
    state = notice(
      esportsOf(next),
      "An esports match day was missed. Remaining fixtures were forfeited.",
    );
  }
  let team = state.team;
  if (team?.contractStart !== undefined && team.contractEnd !== undefined) {
    const due = Math.max(
      0,
      Math.floor((Math.min(now, team.contractEnd) - team.contractStart) / 7),
    );
    if (due > (team.paidWeeks ?? 0)) {
      const earned = (due - (team.paidWeeks ?? 0)) * (team.salary ?? 0);
      next = money(
        { ...next, esports: state },
        earned,
        `${team.name}: weekly salary`,
        `salary-${team.id}-${due}`,
      );
      team = { ...team, paidWeeks: due };
    }
    if (now >= (team.contractEnd ?? Infinity)) {
      team = null;
      state = notice(
        state,
        "Your esports contract ended. You are a Free Agent.",
      );
    }
  }
  if (team) team = liveTeam(save, team, npcs);
  state = {
    ...state,
    team,
    offers: state.offers.filter((o) => o.expires >= now),
    qualifications: state.qualifications.filter((q) => q.expires >= now),
  };
  if (week > state.lastRecruitWeek) {
    if (!team)
      for (const org of ORGANIZATIONS) {
        const chance = offerChance({ ...save, esports: state }, org.id),
          rng = createRng(
            hashString(`${save.career.id}:${week}:${org.id}:offer`),
          );
        if (
          chance > 0 &&
          rng.chance(chance) &&
          !state.offers.some((o) => o.organizationId === org.id)
        )
          state = {
            ...state,
            offers: [
              ...state.offers,
              {
                id: `offer-${org.id}-${week}`,
                organizationId: org.id,
                day: now,
                expires: now + 14,
                size: (rng.chance(0.5) ? 2 : 3) as 2 | 3,
              },
            ].slice(-10),
          };
      }
    state = { ...state, lastRecruitWeek: week };
  }
  return { ...next, esports: state };
}
