import { keresGroupPairs, keresGroupTable, keresStructure } from "@/game/competition/keres";
import { awaitingArmageddon, bulgariaPoints } from "@/game/competition/bulgariaChess";
import { observePredictions } from "@/game/prediction/statistics";
import {
  freezeTournamentRound,
  npcActor,
  conditionsFor,
  ratingActor,
  tournamentObservations,
} from "@/game/prediction/adapters";
import { predictMatch, sampleOutcome, scoreOf } from "@/game/prediction/model";
import type {
  PredictionEnvironment,
  PredictionActor,
} from "@/game/prediction/types";
import { requirementsText } from "@/game/competition/eligibility";
import { swissPairings } from "@/game/competition/swiss";
import { GAME_CONFIG } from "@/data/config";
import { expectedScore } from "@/game/history/elo";
import { createRng, mixSeed, type Rng } from "@/game/rng";
import { span } from "@/diagnostics/spanSink";
import type { ScheduledEvent } from "@/game/world/schedule";
import type {
  ActiveTournament,
  ChessTitle,
  GameOutcome,
  Npc,
  TournamentPairing,
  TournamentPlayer,
} from "@/types";
import { levelTimeControl } from "./timeControls";
import { pairTeamRound, scoreTeamRound, finishTeamTournament } from "@/game/competition/teamTournament";

export const PLAYER_ID = "player";
const LEVEL_OFFSET = {
  local: -150,
  national: 50,
  international: 250,
  elite: 550,
} as const;

/** NPCs for the field: drawn around the level's typical rating, without repeats. */
export function pickField(
  npcs: Npc[],
  playerRating: number,
  level: ActiveTournament["level"],
  count: number,
  rng: Rng,
): Npc[] {
  const target =
    level === "elite"
      ? Math.max(2300, playerRating + LEVEL_OFFSET[level])
      : playerRating + LEVEL_OFFSET[level];
  const pool = npcs.filter(
    (n) => n.careerStatus === "active" || n.careerStatus === "semi-retired",
  );
  const chosen: Npc[] = [];
  const left = [...pool];
  const weight = (n: Npc): number =>
    Math.exp(-0.5 * ((n.currentElo - target) / 260) ** 2) + 1e-6;
  // Same draw as `rng.weighted(left, weight)` (one `rng.next()`, identical left-to-right sums and
  // scan), but each NPC's weight is computed once instead of twice per pick. `weights` stays
  // index-aligned with `left`, so every selection, and the RNG stream, is unchanged.
  const weights = left.map(weight);
  while (chosen.length < count && left.length) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let roll = rng.next() * total,
      at = left.length - 1;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll < 0) {
        at = i;
        break;
      }
    }
    const pick = left[at];
    chosen.push(pick);
    const removed = left.indexOf(pick);
    left.splice(removed, 1);
    weights.splice(removed, 1);
  }
  return chosen;
}

/** An announced field targets local representation without inventing eligibility for national events. */
export function pickEventField(
  npcs: Npc[],
  playerRating: number,
  event: Pick<ScheduledEvent, "level" | "fieldSize" | "details"> & Partial<Pick<ScheduledEvent,"minElo">>,
  rng: Rng,
): Npc[] {
  const count = Math.max(1, event.fieldSize - 1),
    d = event.details;
  const eligible = npcs.filter(
    (n) =>
      (n.careerStatus === "active" || n.careerStatus === "semi-retired") &&
      n.currentElo >= (event.minElo??0) &&
      (!d?.nationality || n.nationality === d.nationality) &&
      (!d?.gender || n.gender === d.gender) &&
      (d?.maxAge === undefined || n.age <= d.maxAge),
  );
  if (d?.nationality)
    return pickField(eligible, playerRating, event.level, count, rng);
  const local = eligible.filter((n) => n.nationality === d?.country);
  if (event.level === "local" && d?.country) {
    const hosts = pickField(local, playerRating, event.level, count, rng);
    // Open events at sparsely populated new venues can admit travelling players.
    // Nationality-restricted events have already returned above.
    if (hosts.length === count) return hosts;
    return [...hosts, ...pickField(eligible.filter((n) => n.nationality !== d.country), playerRating, event.level, count - hosts.length, rng)];
  }
  const share =
    d?.localShare ??
    (event.level === "local" ? 0.65 : event.level === "national" ? 0.8 : 0.25);
  const localCount = Math.min(local.length, Math.ceil(count * share));
  const chosen = pickField(local, playerRating, event.level, localCount, rng);
  const ids = new Set(chosen.map((n) => n.id));
  return [
    ...chosen,
    ...pickField(
      eligible.filter((n) => !ids.has(n.id)),
      playerRating,
      event.level,
      count - chosen.length,
      rng,
    ),
  ];
}

export interface CreateTournamentInput {
  /** Calendar events can run with NPCs only; they never create a human match or award the player a prize. */
  npcOnly?: boolean;
  event: ScheduledEvent;
  player: { name: string; rating: number; country: string; title: ChessTitle };
  npcs: Npc[];
  seed: number;
  fieldIds?: string[];
  predictionEnvironment?: PredictionEnvironment;
  playerActor?: PredictionActor;
}

export function createTournament(
  input: CreateTournamentInput,
): ActiveTournament {
  const { event, player } = input;
  const rng = createRng(mixSeed(input.seed, 0x7001));
  const byNpc = new Map(input.npcs.map((n) => [n.id, n]));
  const field = input.fieldIds
    ? [...new Set(input.fieldIds)]
        .map((id) => byNpc.get(id))
        .filter(
          (n): n is Npc =>
            !!n &&
            (!event.details?.gender || n.gender === event.details.gender) &&
            (!event.details?.qualificationCircuit?.selectTour || event.details.maxAge === undefined || n.age <= event.details.maxAge) &&
            (n.careerStatus === "active" || n.careerStatus === "semi-retired"),
        )
        .slice(0, event.fieldSize - (input.npcOnly ? 0 : 1))
    : pickEventField(
        input.npcs,
        player.rating,
        input.npcOnly ? { ...event, fieldSize: event.fieldSize + 1 } : event,
        rng,
      );
  const players: TournamentPlayer[] = [
    ...(!input.npcOnly
      ? [
          {
            id: PLAYER_ID,
            predictionActor: input.playerActor,
            name: player.name,
            elo: player.rating,
            title: player.title,
            countryCode: player.country,
            isPlayer: true,
            points: 0,
            opponents: [],
            colors: [],
          },
        ]
      : []),
    ...field.map((n) => ({
      id: n.id,
      predictionActor: npcActor(n),
      name: n.name,
      elo: n.currentElo,
      title: n.title,
      countryCode: n.nationality,
      isPlayer: false,
      points: 0,
      opponents: [] as string[],
      colors: [] as number[],
    })),
  ];
  const format = event.details?.format ?? "swiss";
  const rounds = event.details?.keres ? keresStructure(players.length).rounds :
    format === "match"
      ? 14
      : format === "round-robin" ||
          format === "double-round-robin" ||
          format === "round-robin-bo3"
        ? (players.length % 2 ? players.length : players.length - 1) *
          (format === "double-round-robin"
            ? 2
            : format === "round-robin-bo3"
              ? 3
              : 1)
        : format === "knockout"
          ? Math.ceil(Math.log2(players.length))
          : Math.max(
              1,
              Math.min(
                event.details?.rounds ?? GAME_CONFIG.match.rounds[event.level],
                players.length - 1,
              ),
            );
  const [minutes, inc] = GAME_CONFIG.match.levelTime[event.level];
  const t: ActiveTournament = {
    entryRequirements: requirementsText(event),
    details: event.details,
    eventId: event.id,
    name: event.name,
    level: event.level,
    year: event.year,
    week: event.week,
    rounds,
    round: 1,
    status: "playing",
    entryFee: event.entryFee,
    prizeFund:
      event.details?.prize ?? Math.round(event.entryFee * players.length * 0.7),
    timeControl: event.details?.timeControl ?? levelTimeControl(minutes, inc),
    seed: input.seed,
    players,
    pairings: [],
    finalRank: null,
    prize: 0,
  };
  return startRound(t, input.predictionEnvironment);
}

const byId = (t: ActiveTournament, id: string): TournamentPlayer =>
  t.players.find((p) => p.id === id)!;

/** Swiss pairing for the current round: by score, then rating; no rematches where avoidable; colours balanced. */
export function pairRound(t: ActiveTournament): TournamentPairing[] {
  if(t.team)return pairTeamRound(t);
  const format = t.details?.format ?? "swiss";
  const order = [...t.players].sort(
    (a, b) => b.elo - a.elo || a.id.localeCompare(b.id),
  );
  if (format === "match")
    return [
      {
        white: t.round % 2 ? order[0].id : order[1].id,
        black: t.round % 2 ? order[1].id : order[0].id,
        result: null,
      },
    ];
  if (
    format === "round-robin" ||
    format === "double-round-robin" ||
    format === "round-robin-bo3"
  ) {
    const circle: (TournamentPlayer | null)[] = [...order];
    if (circle.length % 2) circle.push(null);
    const cycle = circle.length - 1,
      rotation =
        (format === "round-robin-bo3"
          ? Math.floor((t.round - 1) / 3)
          : t.round - 1) % cycle;
    for (let r = 0; r < rotation; r++) circle.splice(1, 0, circle.pop()!);
    const pairs: TournamentPairing[] = [];
    for (let i = 0; i < circle.length / 2; i++) {
      let a = circle[i],
        b = circle[circle.length - 1 - i];
      if (!a || !b) {
        pairs.push({ white: (a ?? b)!.id, black: "bye", result: 0 });
        continue;
      }
      if ((i === 0 && rotation % 2 === 1) || i % 2 === 1) [a, b] = [b, a];
      if (
        (format === "double-round-robin" && t.round > cycle) ||
        (format === "round-robin-bo3" && t.round % 3 === 2)
      )
        [a, b] = [b, a];
      if (format === "round-robin-bo3" && t.round % 3 === 0) {
        const previous = t.pairings
          .slice(-2)
          .flat()
          .filter(
            (p) =>
              (p.white === a!.id && p.black === b!.id) ||
              (p.white === b!.id && p.black === a!.id),
          );
        const score = previous.reduce(
          (sum, p) =>
            sum + (p.white === a!.id ? (p.result ?? 0) : 1 - (p.result ?? 0)),
          0,
        );
        if (previous.length === 2 && (t.details?.twoGameRematch ? score !== 1 : score === 2 || score === 0)) continue;
      }
      pairs.push({ white: a.id, black: b.id, result: null });
    }
    return pairs;
  }
  if (t.details?.keres) {
    const { prelim, groupEnd, rounds } = keresStructure(order.length);
    if (t.round > prelim && t.round <= groupEnd)
      return keresGroupPairs(t.keresGroups!, t.round - prelim - 1);
    if (t.round > rounds - 7) {
      const finalists = order.filter(p => t.round === 1 || t.knockoutWinners?.includes(p.id));
      if (finalists.length < 2) return [];
      const [a, b] = t.round % 2 ? finalists : finalists.slice().reverse();
      return [{ white: a.id, black: b.id, result: null }];
    }
    if (groupEnd > 0 && t.round === groupEnd + 1) {
      const tables = keresGroupTable(t);
      return tables.map((group, index) => ({
        white: group[0].id, black: tables[index ^ 1][1].id, result: null,
      }));
    }
  }
  if (format === "knockout") {
    const eligible =
      t.round === 1
        ? order
        : order.filter((p) => t.knockoutWinners?.includes(p.id));
    const result: TournamentPairing[] = [];
    // Pad to a power of two with first-round byes for the highest seeds.
    const size = 2 ** Math.ceil(Math.log2(eligible.length)),
      byes = size - eligible.length;
    for (let i = 0; i < byes; i++)
      result.push({ white: eligible[i].id, black: "bye", result: 1 });
    const left = eligible.slice(byes);
    for (let i = 0; i < left.length / 2; i++) {
      const a = left[i],
        b = left[left.length - 1 - i];
      result.push({
        white: t.round % 2 ? a.id : b.id,
        black: t.round % 2 ? b.id : a.id,
        result: null,
      });
    }
    return result;
  }
  return swissPairings(t.players, t.round);
}

/** Begins the current round. A bye for the player is played automatically. */
export function startRound(
  t: ActiveTournament,
  env?: PredictionEnvironment,
): ActiveTournament {
  if (t.details?.keres && !t.keresGroups) {
    const { prelim, groups } = keresStructure(t.players.length);
    if (groups && t.round === prelim + 1) {
      const qualified = new Set(t.knockoutWinners);
      const seeds = t.players.filter(p => prelim === 0 || qualified.has(p.id))
        .sort((a, b) => b.elo - a.elo || a.id.localeCompare(b.id));
      const brackets = Array.from({ length: groups }, (): string[] => []);
      seeds.forEach((p, index) => {
        const row = Math.floor(index / groups), column = index % groups;
        brackets[row % 2 ? groups - 1 - column : column].push(p.id);
      });
      t = { ...t, keresGroups: brackets };
    }
  }
  const next: ActiveTournament = freezeTournamentRound(
    {
      ...t,
      pairings: [...t.pairings, span("calendar.pair", () => pairRound(t))],
    },
    env,
  );
  const mine = playerPairing(next);
  if (
    t.players.some((p) => p.id === PLAYER_ID) &&
    ((t.team && (!mine || mine.result !== null)) || (mine && mine.black === "bye") ||
      (!mine &&
        (t.details?.format === "knockout" ||
          t.details?.format === "round-robin-bo3")))
  )
    return completeRound(next, null, env);
  return next;
}

export function playerPairing(t: ActiveTournament): TournamentPairing | null {
  const round = t.pairings[t.round - 1];
  return (
    round?.find((p) => p.white === PLAYER_ID || p.black === PLAYER_ID) ?? null
  );
}

/** The opponent the player has in the current round, or null (bye or finished). */
export function playerOpponentId(
  t: ActiveTournament,
): { id: string; color: "white" | "black" } | null {
  if (t.status !== "playing") return null;
  const p = playerPairing(t);
  if (!p || p.black === "bye" || (p.result !== null && !awaitingArmageddon(t))) return null;
  return p.white === PLAYER_ID
    ? { id: p.black, color: "white" }
    : { id: p.white, color: "black" };
}

/** Result of a game between two NPCs from their ratings: White's score 1, 0.5 or 0. */
export function simulateResult(
  whiteElo: number,
  blackElo: number,
  elite: boolean,
  rng: Rng,
): number {
  const prediction = span("calendar.predict", () =>
    predictMatch({
    id: "ratings-only-npc",
    player: ratingActor(whiteElo, "White"),
    opponent: ratingActor(blackElo, "Black"),
    conditions: conditionsFor(
      elite ? "classical" : "rapid",
      "white",
      "tournament",
    ),
    }),
  );
  return scoreOf(sampleOutcome(prediction.adjusted, rng.next()));
}

/**
 * Plays the other boards of the round and moves to the next one. `playerScore` is the player's score
 * (1, 0.5, 0), or null when the round had no game for the player (a bye).
 */
export function completeRound(
  t: ActiveTournament,
  playerScore: number | null,
  env?: PredictionEnvironment,
): ActiveTournament {
  if (t.status !== "playing") return t;
  t = freezeTournamentRound(t, env);
  const keres = t.details?.keres ? keresStructure(t.players.length) : undefined;
  const groupStage = keres && t.round > keres.prelim && t.round <= keres.groupEnd;
  const keresFinal = keres && t.round > keres.rounds - 7;
  const knockout = t.details?.format === "knockout" && !groupStage && !keresFinal;
  const winners: string[] = [],
    eliminated = [...(t.eliminated ?? [])];
  const players = t.players.map((p) => ({
    ...p,
    opponents: [...p.opponents],
    colors: [...p.colors],
  }));
  const byPlayer = new Map(players.map((p) => [p.id, p]));
  const get = (id: string): TournamentPlayer => byPlayer.get(id)!;
  const rng = createRng(mixSeed(t.seed, 0x1000 + t.round));
  const roundPairings = t.pairings[t.round - 1].map((p) => ({ ...p }));
  for (const p of roundPairings) {
    if (p.black === "bye") {
      const w = get(p.white);
      w.points += p.result ?? 1;
      w.opponents.push("bye");
      w.colors.push(0);
      if (knockout) winners.push(w.id);
      continue;
    }
    if (p.result === null) {
      if (p.white === PLAYER_ID || p.black === PLAYER_ID) {
        const score = playerScore ?? 0;
        p.result = p.white === PLAYER_ID ? score : 1 - score;
      } else
        p.result = p.prediction
          ? scoreOf(sampleOutcome(p.prediction.adjusted, rng.next()))
          : simulateResult(
              byId(t, p.white).elo,
              byId(t, p.black).elo,
              t.level === "elite",
              rng,
            );
    }
    const w = get(p.white);
    const b = get(p.black);
    if (knockout) {
      const winner =
        p.result === 1
          ? w.id
          : p.result === 0
            ? b.id
            : rng.chance(expectedScore(w.elo, b.elo))
              ? w.id
              : b.id;
      if (p.result === 0.5) p.tiebreakWinner = winner;
      winners.push(winner);
      eliminated.push(winner === w.id ? b.id : w.id);
    }
    if (t.details?.bulgariaChess) {
      if (p.result === .5 && p.armageddonResult === undefined) {
        const draw = rng.chance(.25);
        p.armageddonResult = w.isPlayer && t.withdrawn ? 0 : b.isPlayer && t.withdrawn ? 1
          : draw ? .5 : rng.chance(expectedScore(w.elo + 70, b.elo)) ? 1 : 0;
      }
      if (p.result === .5) p.tiebreakWinner = p.armageddonResult === 1 ? w.id : b.id;
      const points = bulgariaPoints(p);
      w.points += points[0];
      b.points += points[1];
    } else {
      w.points += p.result;
      b.points += 1 - p.result;
    }
    w.opponents.push(b.id);
    b.opponents.push(w.id);
    w.colors.push(1);
    b.colors.push(-1);
  }
  const pairings = t.pairings.map((r, i) =>
    i === t.round - 1 ? roundPairings : r,
  );
  if (t.details?.format === "round-robin-bo3" && t.round % 3 === 0) {
    for (const p of roundPairings) {
      if (p.black === "bye") continue;
      const games = [
        ...t.pairings.slice(t.round - 3, t.round - 1).flat(),
        p,
      ].filter(
        (g) =>
          (g.white === p.white && g.black === p.black) ||
          (g.white === p.black && g.black === p.white),
      );
      const score = games.reduce(
        (sum, g) =>
          sum + (g.white === p.white ? (g.result ?? 0) : 1 - (g.result ?? 0)),
        0,
      );
      if (score === 1.5)
        p.tiebreakWinner = rng.chance(
          expectedScore(get(p.white).elo, get(p.black).elo),
        )
          ? p.white
          : p.black;
    }
  }
  let done: ActiveTournament = {
    ...t,
    players,
    pairings,
    ...(knockout ? { knockoutWinners: winners, eliminated } : {}),
  };
  if (groupStage && t.round === keres.groupEnd) {
    const tables = keresGroupTable(done);
    done.knockoutWinners = tables.flatMap(group => group.slice(0, 2).map(p => p.id));
    done.eliminated = [...eliminated, ...[3, 2].flatMap(rank =>
      tables.map(group => group[rank]).sort((a, b) => a.points - b.points || a.elo - b.elo).map(p => p.id))];
  }
  let keresClinched = false;
  if (keresFinal) {
    const games = pairings.slice(keres.rounds - 7).flat();
    const first = games[0];
    if (first) {
      const score = games.reduce((sum, game) =>
        sum + (game.white === first.white ? game.result! : 1 - game.result!), 0);
      const lead = 2 * score - games.length;
      keresClinched = Math.abs(lead) > 7 - games.length;
      if (keresClinched || games.length === 7) {
        const winner = lead === 0
          ? (rng.chance(expectedScore(get(first.white).elo, get(first.black).elo)) ? first.white : first.black)
          : lead > 0 ? first.white : first.black;
        if (lead === 0) roundPairings[0].tiebreakWinner = winner;
        done.knockoutWinners = [winner];
        done.eliminated = [...eliminated, winner === first.white ? first.black : first.white];
      }
    }
  }
  if(t.team)done=scoreTeamRound(done);
  if (
    t.round >= t.rounds &&
    t.details?.format === "match" &&
    players[0].points === players[1].points
  ) {
    const winner = rng.chance(expectedScore(players[0].elo, players[1].elo))
      ? players[0].id
      : players[1].id;
    done.knockoutWinners = [winner];
    roundPairings[0].tiebreakWinner = winner;
  }
  const nextEnv = env
    ? {
        ...env,
        state: observePredictions(
          env.state,
          tournamentObservations({ ...done, pairings: [roundPairings] }),
        ),
      }
    : undefined;
  const matchClinched =
    t.details?.format === "match" &&
    Math.abs(players[0].points - players[1].points) > t.rounds - t.round;
  if (t.round >= t.rounds || matchClinched || keresClinched) return finishTournament(done);
  return startRound({ ...done, round: t.round + 1 }, nextEnv);
}

/** The player's game of the round ended. */
export function reportPlayerResult(
  t: ActiveTournament,
  outcome: GameOutcome,
  env?: PredictionEnvironment,
): ActiveTournament {
  if (t.status !== "playing") return t;
  if (t.details?.bulgariaChess) {
    const pending = awaitingArmageddon(t);
    if (pending || outcome === "draw") {
      const pairings = t.pairings.map((round, index) => index !== t.round - 1 ? round : round.map(pair => {
        if (pair.white !== PLAYER_ID && pair.black !== PLAYER_ID) return pair;
        if (!pending) return { ...pair, result: .5 };
        const score = outcome === "draw" ? .5 : Number((outcome === "win") === (pair.white === PLAYER_ID));
        return { ...pair, armageddonResult: score };
      }));
      const updated = { ...t, pairings };
      return pending ? completeRound(updated, null, env) : updated;
    }
  }
  return completeRound(
    t,
    outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0,
    env,
  );
}

export interface StandingRow {
  rank: number;
  player: TournamentPlayer;
  /** Sum of the opponents' scores */
  buchholz: number;
  buchholzCut1: number;
  sonnebornBerger: number;
  wins: number;
}

export function standings(t: ActiveTournament): StandingRow[] {
  if (t.details?.format === "round-robin-bo3") {
    const scores = new Map(t.players.map((p) => [p.id, 0]));
    const wins = new Map(t.players.map((p) => [p.id, 0]));
    for (let start = 0; start < t.pairings.length; start += 3) {
      const series = new Map<string, TournamentPairing[]>();
      for (const p of t.pairings.slice(start, start + 3).flat()) {
        if (p.black === "bye" || p.result === null) continue;
        const key = [p.white, p.black].sort().join("|");
        series.set(key, [...(series.get(key) ?? []), p]);
      }
      for (const games of series.values()) {
        const a = games[0].white,
          b = games[0].black;
        const score = games.reduce(
          (sum, g) => sum + (g.white === a ? g.result! : 1 - g.result!),
          0,
        );
        if (t.details?.twoGameRematch) {
          if (games.length < 2 || (games.length === 2 && score === 1)) continue;
        } else if (games.length < 3 && score !== 2 && games.length - score !== 2) {
          continue;
        }
        const winner =
          games.at(-1)?.tiebreakWinner ?? (score > games.length / 2 ? a : b);
        scores.set(winner, scores.get(winner)! + 1);
        wins.set(winner, wins.get(winner)! + 1);
      }
    }
    return t.players
      .map((player) => ({
        player: { ...player, points: scores.get(player.id)! },
        wins: wins.get(player.id)!,
        buchholz: 0,
        buchholzCut1: 0,
        sonnebornBerger: 0,
      }))
      .sort(
        (a, b) =>
          b.player.points - a.player.points ||
          b.player.elo - a.player.elo ||
          a.player.id.localeCompare(b.player.id),
      )
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }
  const score = new Map(t.players.map((p) => [p.id, p.points]));
  const rows = t.players.map((p) => {
    let before = 0;
    const opponents = p.opponents.map((id, i) => {
      const pair = t.pairings[i]?.find(
        (x) => x.white === p.id || x.black === p.id,
      );
      const value =
        id === "bye"
          ? before + Math.max(0, t.rounds - i - 1) * 0.5
          : (score.get(id) ?? 0);
      if (pair?.result !== null && pair?.result !== undefined)
        before += pair.white === p.id ? pair.result : 1 - pair.result;
      return value;
    });
    let sonnebornBerger = 0,
      wins = 0;
    for (const round of t.pairings)
      for (const pair of round) {
        if (pair.result === null || pair.black === "bye") continue;
        const result =
          pair.white === p.id
            ? pair.result
            : pair.black === p.id
              ? 1 - pair.result
              : null;
        if (result === null) continue;
        const opponent = pair.white === p.id ? pair.black : pair.white;
        sonnebornBerger += (score.get(opponent) ?? 0) * result;
        if (result === 1) wins++;
      }
    const buchholz = opponents.reduce((s, v) => s + v, 0);
    return {
      player: p,
      buchholz,
      buchholzCut1: buchholz - (opponents.length ? Math.min(...opponents) : 0),
      sonnebornBerger,
      wins,
    };
  });
  const eliminatedRound = (id: string): number =>
    t.pairings.findIndex((r) =>
      r.some(
        (p) =>
          p.black !== "bye" &&
          (p.white === id || p.black === id) &&
          p.result !== null &&
          (p.tiebreakWinner
            ? p.tiebreakWinner !== id
            : p.white === id
              ? p.result === 0
              : p.result === 1),
      ),
    );
  const keresEliminations = new Map(t.details?.keres ? t.eliminated?.map((id, index) => [id, index]) : []);
  rows.sort((a, b) => {
    if (t.details?.keres)
      return (keresEliminations.get(b.player.id) ?? t.players.length) -
        (keresEliminations.get(a.player.id) ?? t.players.length) ||
        b.player.points - a.player.points || b.player.elo - a.player.elo;
    if (t.details?.format === "knockout")
      return (
        Number(t.knockoutWinners?.includes(b.player.id)) -
          Number(t.knockoutWinners?.includes(a.player.id)) ||
        eliminatedRound(b.player.id) - eliminatedRound(a.player.id) ||
        b.player.points - a.player.points ||
        b.player.elo - a.player.elo
      );
    if (t.details?.format === "match" && t.knockoutWinners?.length)
      return (
        Number(t.knockoutWinners.includes(b.player.id)) -
        Number(t.knockoutWinners.includes(a.player.id))
      );
    return (
      b.player.points - a.player.points ||
      (t.details?.format?.includes("round-robin")
        ? b.sonnebornBerger - a.sonnebornBerger
        : b.buchholzCut1 - a.buchholzCut1 || b.buchholz - a.buchholz) ||
      b.sonnebornBerger - a.sonnebornBerger ||
      b.wins - a.wins ||
      b.player.elo - a.player.elo ||
      a.player.id.localeCompare(b.player.id)
    );
  });
  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

function finishTournament(t: ActiveTournament): ActiveTournament {
  if(t.team)return finishTeamTournament(t);
  const rows = standings(t);
  const rank = rows.find((r) => r.player.isPlayer)?.rank ?? null;
  const share =
    rank === null ? 0 : (GAME_CONFIG.match.prizeShares[rank - 1] ?? 0);
  return {
    ...t,
    status: "finished",
    finalRank: rank,
    prize: Math.round(t.prizeFund * share),
  };
}

/** Leaving the event: every remaining game is lost by forfeit. */
export function withdraw(
  t: ActiveTournament,
  env?: PredictionEnvironment,
): ActiveTournament {
  let cur: ActiveTournament = { ...t, withdrawn: true };
  let guard = 0;
  while (cur.status === "playing" && guard++ <= t.rounds + 1) {
    const mine = playerPairing(cur);
    cur = completeRound(
      cur,
      mine && mine.black !== "bye" && mine.result === null ? 0 : null,
      env,
    );
  }
  return { ...cur, prize: 0 };
}
