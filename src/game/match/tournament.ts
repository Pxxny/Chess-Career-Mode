import { requirementsText } from "@/game/competition/eligibility";
import { swissPairings } from "@/game/competition/swiss";
import { GAME_CONFIG } from "@/data/config";
import { expectedScore } from "@/game/history/elo";
import { createRng, mixSeed, type Rng } from "@/game/rng";
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
  while (chosen.length < count && left.length) {
    const pick = rng.weighted(left, weight);
    chosen.push(pick);
    left.splice(left.indexOf(pick), 1);
  }
  return chosen;
}

export interface CreateTournamentInput {
  event: ScheduledEvent;
  player: { name: string; rating: number; country: string; title: ChessTitle };
  npcs: Npc[];
  seed: number;
  fieldIds?: string[];
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
            (n.careerStatus === "active" || n.careerStatus === "semi-retired"),
        )
        .slice(0, event.fieldSize - 1)
    : pickField(
        input.npcs,
        player.rating,
        event.level,
        Math.max(1, event.fieldSize - 1),
        rng,
      );
  const players: TournamentPlayer[] = [
    {
      id: PLAYER_ID,
      name: player.name,
      elo: player.rating,
      title: player.title,
      countryCode: player.country,
      isPlayer: true,
      points: 0,
      opponents: [],
      colors: [],
    },
    ...field.map((n) => ({
      id: n.id,
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
  const rounds =
    format === "match"
      ? 14
      : format === "round-robin" || format === "double-round-robin"
        ? (players.length % 2 ? players.length : players.length - 1) *
          (format === "double-round-robin" ? 2 : 1)
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
  return startRound(t);
}

const byId = (t: ActiveTournament, id: string): TournamentPlayer =>
  t.players.find((p) => p.id === id)!;

/** Swiss pairing for the current round: by score, then rating; no rematches where avoidable; colours balanced. */
export function pairRound(t: ActiveTournament): TournamentPairing[] {
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
  if (format === "round-robin" || format === "double-round-robin") {
    const circle: (TournamentPlayer | null)[] = [...order];
    if (circle.length % 2) circle.push(null);
    const cycle = circle.length - 1,
      rotation = (t.round - 1) % cycle;
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
      if (t.round > cycle) [a, b] = [b, a];
      pairs.push({ white: a.id, black: b.id, result: null });
    }
    return pairs;
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
export function startRound(t: ActiveTournament): ActiveTournament {
  const next: ActiveTournament = {
    ...t,
    pairings: [...t.pairings, pairRound(t)],
  };
  const mine = playerPairing(next);
  if (
    (mine && mine.black === "bye") ||
    (!mine && t.details?.format === "knockout")
  )
    return completeRound(next, null);
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
  if (!p || p.black === "bye" || p.result !== null) return null;
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
  const e = expectedScore(whiteElo + 35, blackElo);
  const draw = Math.min(
    0.5,
    Math.max(
      0.06,
      0.1 + 0.32 * (1 - Math.abs(e - 0.5) * 2) + (elite ? 0.14 : 0),
    ),
  );
  const win = Math.max(0.02, e - draw / 2);
  const r = rng.next();
  return r < win ? 1 : r < win + draw ? 0.5 : 0;
}

/**
 * Plays the other boards of the round and moves to the next one. `playerScore` is the player's score
 * (1, 0.5, 0), or null when the round had no game for the player (a bye).
 */
export function completeRound(
  t: ActiveTournament,
  playerScore: number | null,
): ActiveTournament {
  if (t.status !== "playing") return t;
  const knockout = t.details?.format === "knockout";
  const winners: string[] = [],
    eliminated = [...(t.eliminated ?? [])];
  const players = t.players.map((p) => ({
    ...p,
    opponents: [...p.opponents],
    colors: [...p.colors],
  }));
  const get = (id: string): TournamentPlayer =>
    players.find((p) => p.id === id)!;
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
        p.result = simulateResult(
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
    w.points += p.result;
    b.points += 1 - p.result;
    w.opponents.push(b.id);
    b.opponents.push(w.id);
    w.colors.push(1);
    b.colors.push(-1);
  }
  const pairings = t.pairings.map((r, i) =>
    i === t.round - 1 ? roundPairings : r,
  );
  const done: ActiveTournament = {
    ...t,
    players,
    pairings,
    ...(knockout ? { knockoutWinners: winners, eliminated } : {}),
  };
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
  const matchClinched =
    t.details?.format === "match" &&
    Math.abs(players[0].points - players[1].points) > t.rounds - t.round;
  if (t.round >= t.rounds || matchClinched) return finishTournament(done);
  return startRound({ ...done, round: t.round + 1 });
}

/** The player's game of the round ended. */
export function reportPlayerResult(
  t: ActiveTournament,
  outcome: GameOutcome,
): ActiveTournament {
  if (t.status !== "playing") return t;
  return completeRound(t, outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0);
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
  rows.sort((a, b) => {
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
  const rows = standings(t);
  const rank = rows.find((r) => r.player.isPlayer)!.rank;
  const share = GAME_CONFIG.match.prizeShares[rank - 1] ?? 0;
  return {
    ...t,
    status: "finished",
    finalRank: rank,
    prize: Math.round(t.prizeFund * share),
  };
}

/** Leaving the event: every remaining game is lost by forfeit. */
export function withdraw(t: ActiveTournament): ActiveTournament {
  let cur: ActiveTournament = { ...t, withdrawn: true };
  let guard = 0;
  while (cur.status === "playing" && guard++ < 50) {
    const mine = playerPairing(cur);
    cur = completeRound(
      cur,
      mine && mine.black !== "bye" && mine.result === null ? 0 : null,
    );
  }
  return { ...cur, prize: 0 };
}
