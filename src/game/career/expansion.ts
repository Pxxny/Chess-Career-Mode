import { GAME_CONFIG } from "@/data/config";
import { COUNTRIES } from "@/data/world/countries";
import { createRng, mixSeed } from "@/game/rng";
import { expectedScore } from "@/game/history/elo";
import { hashString } from "@/utils/format";
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
  points: number;
  boardPoints: number;
}
export interface TeamCup {
  year: number;
  teams: NationalTeam[];
  boards: NationalBoard[];
  represented: boolean;
  prize: number;
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
export function playTeamCup(
  save: GameSave,
  npcs: Npc[],
): { ok: true; save: GameSave } | { ok: false; error: string } {
  const state = stateOf(save),
    year = save.world.date.year;
  if (state.membershipYear !== year)
    return { ok: false, error: "Join your federation for this year first." };
  const teamRegistration = save.registrations.find(
    (r) =>
      r.details?.format === "team" &&
      r.year === year &&
      r.week === save.world.date.week,
  );
  if (
    state.cups.some(
      (c) => c.year === year && (c.represented || !teamRegistration),
    )
  )
    return {
      ok: false,
      error: "This year’s national team cup is already finished.",
    };
  if (save.tournament?.status === "playing")
    return { ok: false, error: "Finish your individual tournament first." };
  const all = federationTeams(save, npcs),
    home = all.find((t) => t.country === save.player.country);
  if (!home)
    return { ok: false, error: "Your federation has no eligible players." };
  const teams = [home, ...all.filter((t) => t !== home).slice(0, 7)].map(
    (t) => ({ ...t, players: t.players.map((p) => ({ ...p })) }),
  );
  if (teams.length < 2)
    return { ok: false, error: "At least two national teams are needed." };
  const represented = home.players.some((p) => p.id === "player");
  if (represented && !teamRegistration)
    return {
      ok: false,
      error:
        "Register for the national teams event in Tournament and start during its event week.",
    };
  if (represented && save.player.ap.current < 2)
    return { ok: false, error: "Representing your country costs 2 AP." };
  const rng = createRng(mixSeed(hashString(save.career.id), year));
  const boards: NationalBoard[] = [];
  let round = 0;
  for (let a = 0; a < teams.length; a++)
    for (let b = a + 1; b < teams.length; b++) {
      round++;
      let score = 0;
      for (let k = 0; k < 4; k++) {
        const flip = (a + b + k) % 2 === 1,
          wt = flip ? teams[b] : teams[a],
          bt = flip ? teams[a] : teams[b];
        const w = wt.players[k] ?? {
            id: "bye",
            name: `Unfilled board (${wt.country})`,
            elo: 0,
          },
          bl = bt.players[k] ?? {
            id: "bye",
            name: `Unfilled board (${bt.country})`,
            elo: 0,
          };
        const expected = expectedScore(w.elo, bl.elo),
          draw = 0.24,
          scoreW =
            w.id === "bye"
              ? bl.id === "bye"
                ? 0.5
                : 0
              : bl.id === "bye"
                ? 1
                : rng.chance(draw)
                  ? 0.5
                  : rng.chance(expected)
                    ? 1
                    : 0;
        score += flip ? 1 - scoreW : scoreW;
        boards.push({
          round,
          white: w.name,
          black: bl.name,
          whiteElo: w.elo,
          blackElo: bl.elo,
          whiteId: w.id,
          blackId: bl.id,
          score: scoreW,
          forfeit: w.id === "bye" || bl.id === "bye",
        });
      }
      teams[a].boardPoints += score;
      teams[b].boardPoints += 4 - score;
      teams[a].points += score > 2 ? 2 : score === 2 ? 1 : 0;
      teams[b].points += score < 2 ? 2 : score === 2 ? 1 : 0;
    }
  teams.sort(
    (a, b) =>
      b.points - a.points ||
      b.boardPoints - a.boardPoints ||
      a.country.localeCompare(b.country),
  );
  // National games are stored in the cup itself, with separate rating from individual rated history.
  const prize = represented
    ? Math.max(0, 160 - teams.findIndex((t) => t.country === home.country) * 20)
    : 0;
  const cup: TeamCup = { year, teams, boards, represented, prize };
  let next: GameSave = {
    ...save,
    player: {
      ...save.player,
      money: save.player.money + prize,
      ap: {
        ...save.player.ap,
        current: save.player.ap.current - (represented ? 2 : 0),
      },
    },
    registrations: teamRegistration
      ? save.registrations.filter((r) => r.eventId !== teamRegistration.eventId)
      : save.registrations,
    expansion: {
      ...state,
      cups: [...state.cups.filter((c) => c.year !== year), cup].slice(-20),
    },
  };
  if (prize)
    next = {
      ...next,
      history: {
        ...next.history,
        ledger: [
          ...next.history.ledger,
          {
            ...save.world.date,
            id: `team-prize-${year}`,
            kind: "prize" as const,
            label: "National team cup appearance/prize",
            amount: prize,
          },
        ].slice(-GAME_CONFIG.history.maxLedger),
      },
    };
  next = news(
    next,
    `national-cup-${year}`,
    `${COUNTRIES.find((c) => c.code === teams[0].country)?.name ?? teams[0].country} wins the National Team Cup`,
    `${teams.length} teams, ${boards.length} board games. Your country finished #${teams.findIndex((t) => t.country === home.country) + 1}. ${represented ? "You played on the four-board team." : "You followed the team as a federation member."}`,
  );
  if (represented) {
    const games = boards.filter(
      (b) => b.whiteId === "player" || b.blackId === "player",
    ).length;
    for (let i = 0; i < games; i++) next = coachedGame(next);
  }
  return { ok: true, save: next };
}
/** A deterministic eight-player circuit runs once per new game week; news references its actual simulated results. */
export function weeklyCircuit(
  save: GameSave,
  npcs: Npc[],
): { save: GameSave; changed: Npc[] } {
  const index = save.world.date.year * 52 + save.world.date.week,
    state = stateOf(save);
  if (index <= state.lastBulletin) return { save, changed: [] };
  const active = npcs.filter(
    (n) => n.careerStatus === "active" || n.careerStatus === "semi-retired",
  );
  let next = { ...save, expansion: { ...state, lastBulletin: index } };
  if (active.length < 8) return { save: next, changed: [] };
  const rng = createRng(mixSeed(save.world.seed, index));
  let field = rng.shuffle(active).slice(0, 8);
  const games: string[] = [];
  const title = `World Circuit Open ${save.world.date.year}/${save.world.date.week}`;
  while (field.length > 1) {
    const winners: Npc[] = [];
    for (let i = 0; i < field.length; i += 2) {
      const a = field[i],
        b = field[i + 1],
        win = rng.chance(expectedScore(a.currentElo, b.currentElo)) ? a : b,
        loss = win === a ? b : a;
      winners.push(win);
      games.push(
        `${win.name} (${win.currentElo}) defeated ${loss.name} (${loss.currentElo}).`,
      );
      if (loss.currentElo - win.currentElo >= 200)
        next = news(
          next,
          `upset-${index}-${i}-${field.length}`,
          `Underdog ${win.name} topples ${loss.name}`,
          `${title}: ${games[games.length - 1]}`,
          "milestone",
        ) as typeof next;
    }
    field = winners;
  }
  const winner = field[0],
    changed = [
      {
        ...winner,
        tournamentHistory: [
          ...winner.tournamentHistory,
          {
            year: save.world.date.year,
            event: title,
            rank: 1,
            fieldSize: 8,
            points: 3,
            games: 3,
          },
        ].slice(-30),
        form: Math.min(100, winner.form + 2),
      },
    ];
  next = news(
    next,
    `circuit-${index}`,
    `${winner.name} wins ${title}`,
    games.join(" "),
  ) as typeof next;
  return { save: next, changed };
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
