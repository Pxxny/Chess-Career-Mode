import { queueArchives } from "@/game/competition/archive";
import { personalWorldNews } from "@/game/social/memories";
import { simulateWorldCircuitSteps } from "@/game/npc/activity";
import { drainSteps, type Steps } from "@/game/steps";
import { recordPredictions } from "@/game/prediction/statistics";
import type { PredictionSnapshot } from "@/game/prediction/types";
import { GAME_CONFIG } from "@/data/config";
import { LEGACY_TEAM_INFO } from "@/data/chess/nationalTeamEvents";
import type { GameSave, Npc, NewsItem, SkillKey } from "@/types";

export type CoachTerm = "game" | "week" | "month";
export interface Coach {
  id: string;
  name: string;
  specialty: SkillKey;
  tier: number;
  fee: number;
}
export interface CoachContract {
  coachId: string;
  term: CoachTerm;
  expires: number | null;
  hired: number;
  fee: number;
}
export interface NationalBoard {
  prediction?: PredictionSnapshot;
  round: number;
  white: string;
  black: string;
  whiteElo: number;
  blackElo: number;
  score: number;
  whiteId?: string;
  blackId?: string;
  forfeit?: boolean;
}
export interface NationalTeam {
  country: string;
  players: { id: string; name: string; elo: number }[];
  /** Substitutes who may replace the last board */
  reserves?: { id: string; name: string; elo: number }[];
  points: number;
  boardPoints: number;
}
export interface TeamCup {
  playable?: boolean;
  playedOnDay?: number;
  year: number;
  teams: NationalTeam[];
  boards: NationalBoard[];
  represented: boolean;
  prize: number;
  /** Catalog key; absent on cups from before the national team event catalog (the Olympiad) */
  key?: string;
  name?: string;
  boardsPerTeam?: number;
  reserves?: number;
  rounds?: number;
  format?: "round-robin" | "swiss";
  teamCount?: number;
}
export interface ExpansionState {
  membershipYear: number | null;
  coach: CoachContract | null;
  coachedGames: number;
  lessonDay: number;
  lessonsToday: number;
  lastBulletin: number;
  cups: TeamCup[];
}
export const emptyExpansion = (): ExpansionState => ({
  membershipYear: null,
  coach: null,
  coachedGames: 0,
  lessonDay: -1,
  lessonsToday: 0,
  lastBulletin: -1,
  cups: [],
});
export const stateOf = (save: GameSave): ExpansionState => ({
  ...emptyExpansion(),
  ...save.expansion,
});
export const dayIndex = (save: GameSave): number =>
  (save.world.date.year * 52 + save.world.date.week - 1) * 7 +
  save.world.day -
  1;
const skills: SkillKey[] = [
  "opening",
  "middlegame",
  "endgame",
  "tactics",
  "calculation",
  "strategy",
  "timeManagement",
  "psychology",
];
export const COACHES: Coach[] = [
  "Mira Chen",
  "Daniel Reyes",
  "Anika Shah",
  "Leo Novak",
  "Sofia Costa",
  "Arun Patel",
  "Nadia Ivanova",
  "Kenji Mori",
  "Amara Okafor",
  "Eva Lind",
  "Omar Hassan",
  "Clara Silva",
].map((name, i) => ({
  id: `coach-${i}`,
  name,
  specialty: skills[i % 8],
  tier: 1 + Math.floor(i / 4),
  fee: 15 + Math.floor(i / 4) * 20,
}));
export function activeCoach(save: GameSave): Coach | null {
  const c = stateOf(save).coach;
  return c && (c.expires === null || dayIndex(save) < c.expires)
    ? (COACHES.find((x) => x.id === c.coachId) ?? null)
    : null;
}
export const trainingCoachMultiplier = (save: GameSave): number =>
  stateOf(save).coach?.term !== "game" && activeCoach(save)
    ? 1 + activeCoach(save)!.tier * 0.1
    : 1;
export const coachFee = (
  save: GameSave,
  coach: Coach,
  term: CoachTerm,
): number =>
  Math.ceil(
    coach.fee *
      { game: 1, week: 4, month: 14 }[term] *
      (stateOf(save).membershipYear === save.world.date.year ? 0.9 : 1),
  );
export function news(
  save: GameSave,
  id: string,
  headline: string,
  detail: string,
  kind: NewsItem["kind"] = "history",
): GameSave {
  if (save.history.news.some((n) => n.id === id)) return save;
  return {
    ...save,
    history: {
      ...save.history,
      news: [
        ...save.history.news,
        { id, kind, headline, detail, ...save.world.date },
      ].slice(-GAME_CONFIG.history.maxNews),
    },
  };
}
function charge(save: GameSave, amount: number, label: string): GameSave {
  return {
    ...save,
    player: { ...save.player, money: save.player.money - amount },
    history: {
      ...save.history,
      ledger: [
        ...save.history.ledger,
        {
          ...save.world.date,
          id: `service-${dayIndex(save)}-${save.history.ledger.length}-${label}`,
          kind: "expense" as const,
          label,
          amount: -amount,
        },
      ].slice(-GAME_CONFIG.history.maxLedger),
    },
  };
}
export function hireCoach(
  save: GameSave,
  id: string,
  term: CoachTerm,
): { ok: true; save: GameSave } | { ok: false; error: string } {
  const coach = COACHES.find((c) => c.id === id);
  if (!coach || !["game", "week", "month"].includes(term))
    return { ok: false, error: "Unknown coach or contract." };
  if (activeCoach(save))
    return {
      ok: false,
      error: "Cancel or finish the current coaching contract first.",
    };
  const fee = coachFee(save, coach, term);
  if (save.player.money < fee)
    return { ok: false, error: "Not enough money for this contract." };
  const next = charge(save, fee, `Coach: ${coach.name} (${term})`);
  return {
    ok: true,
    save: {
      ...next,
      expansion: {
        ...stateOf(next),
        coach: {
          coachId: id,
          term,
          fee,
          hired: dayIndex(save),
          expires:
            term === "game"
              ? null
              : dayIndex(save) + (term === "week" ? 7 : 30),
        },
      },
    },
  };
}
export function joinFederation(
  save: GameSave,
): { ok: true; save: GameSave } | { ok: false; error: string } {
  if (stateOf(save).membershipYear === save.world.date.year)
    return { ok: false, error: "Membership is already paid for this year." };
  if (save.player.money < 35)
    return { ok: false, error: "Annual membership costs $35." };
  const next = charge(save, 35, "Federation annual membership");
  return {
    ok: true,
    save: news(
      {
        ...next,
        expansion: { ...stateOf(next), membershipYear: save.world.date.year },
      },
      `federation-${save.world.date.year}`,
      "Federation membership activated",
      "National team entry and 10% off coaching fees for this game year.",
      "milestone",
    ),
  };
}
export function coachedGame(save: GameSave): GameSave {
  const coach = activeCoach(save);
  if (!coach) return save;
  const prior = stateOf(save),
    today = dayIndex(save),
    lessons = prior.lessonDay === today ? prior.lessonsToday : 0;
  if (lessons >= 4) return save;
  const stat = coach.specialty,
    xp = { ...save.training.xp };
  let level = save.player.skills[stat],
    pool = (xp[stat] ?? 0) + coach.tier * 24;
  const needed = (n: number) =>
    Math.round(
      GAME_CONFIG.sessions.xpBase + GAME_CONFIG.sessions.xpPerLevel * n,
    );
  while (level < 100 && pool >= needed(level)) {
    pool -= needed(level);
    level++;
  }
  xp[stat] = level >= 100 ? 0 : Math.round(pool * 10) / 10;
  const state = stateOf(save);
  let next: GameSave = {
    ...save,
    player: {
      ...save.player,
      skills: { ...save.player.skills, [stat]: level },
    },
    training: { ...save.training, xp },
    expansion: {
      ...state,
      coachedGames: state.coachedGames + 1,
      lessonDay: today,
      lessonsToday: lessons + 1,
      coach: state.coach?.term === "game" ? null : state.coach,
    },
  };
  next = news(
    next,
    `coached-${state.coachedGames + 1}`,
    `${coach.name}: post-game lesson completed`,
    `${coach.tier * 24} XP in ${stat}. Your game result and rating are unchanged.`,
  );
  return next;
}
export function federationTeams(save: GameSave, npcs: Npc[]): NationalTeam[] {
  const groups = new Map<string, NationalTeam["players"]>();
  for (const n of npcs)
    if (n.careerStatus === "active" || n.careerStatus === "semi-retired") {
      const rows = groups.get(n.nationality) ?? [];
      rows.push({ id: n.id, name: n.name, elo: n.currentElo });
      groups.set(n.nationality, rows);
    }
  const home = groups.get(save.player.country) ?? [];
  home.push({ id: "player", name: save.player.name, elo: save.player.rating });
  groups.set(save.player.country, home);
  return [...groups]
    .map(([country, p]) => ({
      country,
      players: p
        .sort((a, b) => b.elo - a.elo || a.id.localeCompare(b.id))
        .slice(0, 4),
      points: 0,
      boardPoints: 0,
    }))
    .sort(
      (a, b) =>
        b.players.reduce((s, p) => s + p.elo, 0) -
          a.players.reduce((s, p) => s + p.elo, 0) ||
        a.country.localeCompare(b.country),
    );
}
/** Key of a stored cup; cups from before the event catalog were the annual Olympiad. */
export const cupKey = (cup: TeamCup): string => cup.key ?? LEGACY_TEAM_INFO.key;
/** The existing weekly circuit now records every entrant and updates ratings from board results. */
export function weeklyCircuit(
  save: GameSave,
  npcs: Npc[],
): { save: GameSave; changed: Npc[] } {
  return drainSteps(weeklyCircuitSteps(save, npcs));
}

/** `weeklyCircuit` as resumable steps (see `simulateWorldCircuitSteps`). */
export function* weeklyCircuitSteps(
  save: GameSave,
  npcs: Npc[],
): Steps<{ save: GameSave; changed: Npc[] }> {
  const index = save.world.date.year * 52 + save.world.date.week;
  const state = stateOf(save);
  if (index <= state.lastBulletin) return { save, changed: [] };
  const result = yield* simulateWorldCircuitSteps(save, npcs);
  let next: GameSave = {
    ...save,
    expansion: { ...state, lastBulletin: index },
  };
  next = recordPredictions(next, result.observations);
  if (result.events)
    next = news(
      next,
      `circuit-${index}`,
      `World Circuit: ${result.events} events, ${result.observations.length} games`,
      result.headlines.join(" "),
    );
  return {
    save: queueArchives(
      personalWorldNews(next, result.changed),
      result.archives,
    ),
    changed: result.changed,
  };
}

export function tournamentBulletin(
  save: GameSave,
  t: import("@/types").ActiveTournament,
): GameSave {
  let next = save;
  const players = new Map(t.players.map((p) => [p.id, p]));
  t.pairings.forEach((round, ri) =>
    round.forEach((p) => {
      if (p.result !== 0 && p.result !== 1) return;
      const winner = players.get(p.result === 1 ? p.white : p.black),
        loser = players.get(p.result === 1 ? p.black : p.white);
      if (winner && loser && loser.elo - winner.elo >= 200)
        next = news(
          next,
          `t-upset-${t.eventId}-${ri}-${p.white}-${p.black}`,
          `${winner.name} upsets ${loser.name}`,
          `${t.name}, round ${ri + 1}: ${winner.elo} beat ${loser.elo}.`,
          "milestone",
        );
    }),
  );
  return next;
}
