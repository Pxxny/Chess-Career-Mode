import {
  TEAM_EVENTS,
  teamSpec,
  type BoardSlot,
  type TeamEventInfo,
  type TeamEventSpec,
} from "@/data/chess/nationalTeamEvents";
import { getCountry } from "@/data/world/countries";
import { regionAllows } from "./teamEligibility";
import {
  conditionsFor,
  npcActor,
  plannedOpeningConditions,
  playerActor,
  playerView,
  predictionStamp,
  ratingActor,
} from "@/game/prediction/adapters";
import {
  invertOutcome,
  outcomeOf,
  predictMatch,
  sampleOutcome,
  scoreOf,
} from "@/game/prediction/model";
import { predictionOf } from "@/game/prediction/statistics";
import type { PredictionObservation } from "@/game/prediction/types";
import type { NationalBoard, NationalTeam } from "@/game/career/expansion";
import type { GameSave, Npc } from "@/types";

interface Candidate {
  id: string;
  name: string;
  elo: number;
  gender: string;
  age: number;
}
type TeamPlayer = NationalTeam["players"][number];

/** Abstract rosters (events whose eligibility is not modelled) are weaker than the open field. */
const ABSTRACT_ELO_PENALTY = 250;
/** Chance per match that a reserve replaces the last board. */
const RESERVE_ROTATION = 0.2;
/** Detailed rosters kept only for the strongest finishers and the player's team. */
const KEEP_ROSTERS = 16;

const ageAllows = (spec: TeamEventSpec, age: number): boolean =>
  (spec.minAge === undefined || age >= spec.minAge) &&
  (spec.maxAge === undefined || age <= spec.maxAge);

const eventAllows = (spec: TeamEventSpec, c: Candidate): boolean =>
  (!spec.gender || c.gender === "female") && ageAllows(spec, c.age);

const slotFits = (slot: BoardSlot, c: Candidate): boolean =>
  slot === "open" ||
  (slot === "woman" && c.gender === "female") ||
  (slot === "man" && c.gender === "male") ||
  (slot === "boy-u20" && c.gender === "male" && c.age < 20) ||
  (slot === "girl-u20" && c.gender === "female" && c.age < 20);

const SLOT_ORDER: BoardSlot[] = ["girl-u20", "boy-u20", "woman", "man", "open"];

const byStrength = (a: Candidate, b: Candidate) =>
  b.elo - a.elo || a.id.localeCompare(b.id);

/** Fills the required slots (strictest first), then the reserves, from the best remaining players. */
export function pickRoster(
  candidates: Candidate[],
  spec: TeamEventSpec,
  boards: number,
  reserves: number,
): { starters: Candidate[]; reserves: Candidate[] } {
  const sorted = [...candidates].sort(byStrength);
  const slots: BoardSlot[] = Array.from(
    { length: boards },
    (_, i) => spec.slots?.[i] ?? "open",
  );
  const used = new Set<string>();
  const starters: Candidate[] = [];
  for (const wanted of SLOT_ORDER)
    for (const slot of slots) {
      if (slot !== wanted) continue;
      const found = sorted.find((c) => !used.has(c.id) && slotFits(slot, c));
      if (!found) continue;
      used.add(found.id);
      starters.push(found);
    }
  starters.sort(byStrength);
  return {
    starters,
    reserves: sorted.filter((c) => !used.has(c.id)).slice(0, reserves),
  };
}

const toPlayer = (c: Candidate): TeamPlayer => ({
  id: c.id,
  name: c.name,
  elo: c.elo,
});
const strength = (t: NationalTeam): number =>
  t.players.reduce((sum, p) => sum + p.elo, 0);

/** Builds the national teams of one edition: strongest federations first, always including the player's. */
export function buildEventTeams(
  save: GameSave,
  npcs: Npc[],
  info: TeamEventInfo,
  includePlayer = true,
): NationalTeam[] {
  const spec = teamSpec(info.key) ?? TEAM_EVENTS[0];
  const groups = new Map<string, Candidate[]>();
  const add = (code: string, c: Candidate) => {
    if (!regionAllows(spec, code)) return;
    if (!spec.abstract && !eventAllows(spec, c)) return;
    const rows = groups.get(code);
    if (rows) rows.push(c);
    else groups.set(code, [c]);
  };
  for (const n of npcs)
    if (n.careerStatus === "active" || n.careerStatus === "semi-retired")
      add(n.nationality, {
        id: n.id,
        name: n.name,
        elo: n.currentElo,
        gender: n.gender,
        age: n.age,
      });
  if (!spec.abstract && includePlayer)
    add(save.player.country, {
      id: "player",
      name: save.player.name,
      elo: save.player.rating,
      gender: save.player.gender,
      age: save.player.age,
    });
  const teams: NationalTeam[] = [];
  for (const [country, rows] of groups) {
    const { starters, reserves } = pickRoster(
      rows,
      spec,
      info.boards,
      info.reserves,
    );
    if (!starters.length) continue;
    const label = getCountry(country)?.name ?? country;
    const shape = (list: Candidate[], offset: number): TeamPlayer[] =>
      spec.abstract
        ? list.map((c, i) => ({
            id: `abstract:${country}:${i + offset}`,
            name: `${label} #${i + offset + 1}`,
            elo: Math.max(800, c.elo - ABSTRACT_ELO_PENALTY),
          }))
        : list.map(toPlayer);
    teams.push({
      country,
      players: shape(starters, 0),
      reserves: shape(reserves, starters.length),
      points: 0,
      boardPoints: 0,
    });
  }
  teams.sort(
    (a, b) => strength(b) - strength(a) || a.country.localeCompare(b.country),
  );
  const home = teams.find((t) => t.country === save.player.country);
  const chosen = home
    ? [home, ...teams.filter((t) => t !== home).slice(0, info.teams - 1)]
    : teams.slice(0, info.teams);
  return chosen.sort(
    (a, b) => strength(b) - strength(a) || a.country.localeCompare(b.country),
  );
}

export interface TeamEventResult {
  teams: NationalTeam[];
  boards: NationalBoard[];
  samples: PredictionObservation[];
  rounds: number;
  format: "round-robin" | "swiss";
}

interface Rng {
  next(): number;
}

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function swissPairs(
  order: number[],
  played: Set<string>,
  byes: Set<number>,
  round: number,
): { pairs: [number, number][]; bye: number | null } {
  const list = [...order];
  let bye: number | null = null;
  if (list.length % 2 === 1) {
    for (let i = list.length - 1; i >= 0; i--)
      if (!byes.has(list[i])) {
        bye = list.splice(i, 1)[0];
        break;
      }
    if (bye === null) bye = list.pop()!;
  }
  const pairs: [number, number][] = [];
  if (round === 1) {
    const half = list.length / 2;
    for (let i = 0; i < half; i++) pairs.push([list[i], list[i + half]]);
  } else {
    while (list.length) {
      const a = list.shift()!;
      let j = list.findIndex((b) => !played.has(pairKey(a, b)));
      if (j < 0) j = 0;
      pairs.push([a, list.splice(j, 1)[0]]);
    }
  }
  return { pairs, bye };
}

/**
 * Simulates the whole edition. Up to 12 teams play a single round robin; larger fields play
 * a Swiss system. Only the player's federation matches keep board-level detail.
 */
export function simulateTeamEvent(
  save: GameSave,
  npcs: Npc[],
  info: TeamEventInfo,
  teams: NationalTeam[],
  rng: Rng,
  recordAll = false,
): TeamEventResult {
  const spec = teamSpec(info.key) ?? TEAM_EVENTS[0];
  const year = save.world.date.year;
  const byNpc = new Map(npcs.map((n) => [n.id, n]));
  const boardsPerMatch = info.boards;
  const half = boardsPerMatch / 2;
  const boards: NationalBoard[] = [];
  const samples: PredictionObservation[] = [];
  const power = teams.map(strength);
  const actor = (m: TeamPlayer) =>
    m.id === "player"
      ? playerActor(save)
      : byNpc.has(m.id)
        ? npcActor(byNpc.get(m.id)!)
        : ratingActor(m.elo, m.name, m.id);
  const lineup = (team: NationalTeam): TeamPlayer[] => {
    const rows = team.players.slice(0, boardsPerMatch);
    const rest = team.reserves?.[0];
    if (rest && rows.length && rng.next() < RESERVE_ROTATION)
      rows[rows.length - 1] = rest;
    return rows;
  };
  const unfilled = (team: NationalTeam): TeamPlayer => ({
    id: "bye",
    name: `Unfilled board (${team.country})`,
    elo: 0,
  });
  const playMatch = (ai: number, bi: number, round: number): void => {
    const a = teams[ai],
      b = teams[bi],
      la = lineup(a),
      lb = lineup(b);
    const keep =
      recordAll ||
      a.country === save.player.country ||
      b.country === save.player.country;
    let score = 0;
    for (let k = 0; k < boardsPerMatch; k++) {
      const flip = (ai + bi + k) % 2 === 1;
      const wt = flip ? b : a,
        bt = flip ? a : b;
      const w = (flip ? lb : la)[k] ?? unfilled(wt),
        bl = (flip ? la : lb)[k] ?? unfilled(bt);
      const prediction =
        w.id !== "bye" && bl.id !== "bye"
          ? predictMatch({
              id: `national:${save.career.id}:${year}:${info.key}:${round}:${ai}:${bi}:${k}`,
              stamp: predictionStamp(save),
              player: actor(w),
              opponent: actor(bl),
              conditions: {
                ...plannedOpeningConditions(
                  actor(w),
                  actor(bl),
                  conditionsFor(spec.timeControl, "white", "national-team"),
                ),
                tournamentName: spec.name,
                importance: 0.8,
                pressure: 0.6,
              },
              state: predictionOf(save),
            })
          : undefined;
      const scoreW =
        w.id === "bye"
          ? bl.id === "bye"
            ? 0.5
            : 0
          : bl.id === "bye"
            ? 1
            : scoreOf(sampleOutcome(prediction!.adjusted, rng.next()));
      score += flip ? 1 - scoreW : scoreW;
      if (!keep) continue;
      if (prediction)
        samples.push({
          prediction: bl.id === "player" ? playerView(prediction) : prediction,
          result:
            bl.id === "player"
              ? invertOutcome(outcomeOf(scoreW))
              : outcomeOf(scoreW),
          scope: w.id === "player" || bl.id === "player" ? "career" : "npc",
          source: "abstract",
          eligible: true,
        });
      boards.push({
        ...(prediction ? { prediction } : {}),
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
    a.boardPoints += score;
    b.boardPoints += boardsPerMatch - score;
    a.points += score > half ? 2 : score === half ? 1 : 0;
    b.points += score < half ? 2 : score === half ? 1 : 0;
  };
  const roundRobin = teams.length <= 12;
  let rounds = 0;
  if (roundRobin) {
    for (let a = 0; a < teams.length; a++)
      for (let b = a + 1; b < teams.length; b++) playMatch(a, b, ++rounds);
  } else {
    rounds = Math.min(spec.rounds, teams.length - 1);
    const played = new Set<string>(),
      byes = new Set<number>();
    for (let round = 1; round <= rounds; round++) {
      const order = teams
        .map((_, i) => i)
        .sort(
          (x, y) =>
            teams[y].points - teams[x].points ||
            teams[y].boardPoints - teams[x].boardPoints ||
            power[y] - power[x] ||
            teams[x].country.localeCompare(teams[y].country),
        );
      const { pairs, bye } = swissPairs(order, played, byes, round);
      for (const [x, y] of pairs) {
        played.add(pairKey(x, y));
        playMatch(x, y, round);
      }
      if (bye !== null) {
        byes.add(bye);
        teams[bye].points += 2;
        teams[bye].boardPoints += half;
      }
    }
  }
  const strengthOf = new Map(teams.map((t, i) => [t.country, power[i]]));
  teams.sort(
    (a, b) =>
      b.points - a.points ||
      b.boardPoints - a.boardPoints ||
      (strengthOf.get(b.country) ?? 0) - (strengthOf.get(a.country) ?? 0) ||
      a.country.localeCompare(b.country),
  );
  const trimmed = teams.map((t, i) =>
    recordAll || i < KEEP_ROSTERS || t.country === save.player.country
      ? t
      : { ...t, players: [], reserves: [] },
  );
  return {
    teams: trimmed,
    boards,
    samples,
    rounds,
    format: roundRobin ? "round-robin" : "swiss",
  };
}

/** Appearance/prize money: full amount for the winner, 10% for the last team. */
export const teamPrize = (
  spec: TeamEventSpec,
  rank: number,
  teams: number,
): number =>
  Math.max(
    0,
    Math.round(spec.prize * (1 - (0.9 * rank) / Math.max(1, teams - 1))),
  );
