import { GAME_CONFIG } from '@/data/config';
import { expectedScore } from '@/game/history/elo';
import { createRng, mixSeed, type Rng } from '@/game/rng';
import type { ScheduledEvent } from '@/game/world/schedule';
import type { ActiveTournament, ChessTitle, GameOutcome, Npc, TournamentPairing, TournamentPlayer } from '@/types';
import { levelTimeControl } from './timeControls';

export const PLAYER_ID = 'player';
const LEVEL_OFFSET = { local: -150, national: 50, international: 250, elite: 550 } as const;

/** NPCs for the field: drawn around the level's typical rating, without repeats. */
export function pickField(npcs: Npc[], playerRating: number, level: ActiveTournament['level'], count: number, rng: Rng): Npc[] {
  const target = level === 'elite' ? Math.max(2300, playerRating + LEVEL_OFFSET[level]) : playerRating + LEVEL_OFFSET[level];
  const pool = npcs.filter((n) => n.careerStatus === 'active' || n.careerStatus === 'semi-retired');
  const chosen: Npc[] = [];
  const left = [...pool];
  const weight = (n: Npc): number => Math.exp(-0.5 * ((n.currentElo - target) / 260) ** 2) + 1e-6;
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
}

export function createTournament(input: CreateTournamentInput): ActiveTournament {
  const { event, player } = input;
  const rng = createRng(mixSeed(input.seed, 0x7001));
  const field = pickField(input.npcs, player.rating, event.level, Math.max(1, event.fieldSize - 1), rng);
  const players: TournamentPlayer[] = [
    { id: PLAYER_ID, name: player.name, elo: player.rating, title: player.title, countryCode: player.country, isPlayer: true, points: 0, opponents: [], colors: [] },
    ...field.map((n) => ({ id: n.id, name: n.name, elo: n.currentElo, title: n.title, countryCode: n.nationality, isPlayer: false, points: 0, opponents: [] as string[], colors: [] as number[] })),
  ];
  const rounds = Math.max(1, Math.min(GAME_CONFIG.match.rounds[event.level], players.length - 1));
  const [minutes, inc] = GAME_CONFIG.match.levelTime[event.level];
  const t: ActiveTournament = {
    eventId: event.id,
    name: event.name,
    level: event.level,
    year: event.year,
    week: event.week,
    rounds,
    round: 1,
    status: 'playing',
    entryFee: event.entryFee,
    prizeFund: Math.round(event.entryFee * players.length * 0.7),
    timeControl: levelTimeControl(minutes, inc),
    seed: input.seed,
    players,
    pairings: [],
    finalRank: null,
    prize: 0,
  };
  return startRound(t);
}

const byId = (t: ActiveTournament, id: string): TournamentPlayer => t.players.find((p) => p.id === id)!;

/** Swiss pairing for the current round: by score, then rating; no rematches where avoidable; colours balanced. */
export function pairRound(t: ActiveTournament): TournamentPairing[] {
  const order = [...t.players].sort((a, b) => b.points - a.points || b.elo - a.elo || a.id.localeCompare(b.id));
  const pool = [...order];
  const pairings: TournamentPairing[] = [];
  if (pool.length % 2 === 1) {
    // The bye goes to the lowest-placed player who has not had one.
    const candidates = [...pool].reverse();
    const bye = candidates.find((p) => !p.opponents.includes('bye')) ?? candidates[0];
    pool.splice(pool.indexOf(bye), 1);
    pairings.push({ white: bye.id, black: 'bye', result: 1 });
  }
  while (pool.length) {
    const a = pool.shift()!;
    let idx = pool.findIndex((b) => !a.opponents.includes(b.id));
    if (idx < 0) idx = 0;
    const b = pool.splice(idx, 1)[0];
    const balance = (p: TournamentPlayer): number => p.colors.reduce((s, c) => s + c, 0);
    const aWhite = balance(a) < balance(b) || (balance(a) === balance(b) && (t.round % 2 === 1 ? a.elo >= b.elo : a.elo < b.elo));
    pairings.push(aWhite ? { white: a.id, black: b.id, result: null } : { white: b.id, black: a.id, result: null });
  }
  return pairings;
}

/** Begins the current round. A bye for the player is played automatically. */
export function startRound(t: ActiveTournament): ActiveTournament {
  const next: ActiveTournament = { ...t, pairings: [...t.pairings, pairRound(t)] };
  const mine = playerPairing(next);
  if (mine && mine.black === 'bye') return completeRound(next, null);
  return next;
}

export function playerPairing(t: ActiveTournament): TournamentPairing | null {
  const round = t.pairings[t.round - 1];
  return round?.find((p) => p.white === PLAYER_ID || p.black === PLAYER_ID) ?? null;
}

/** The opponent the player has in the current round, or null (bye or finished). */
export function playerOpponentId(t: ActiveTournament): { id: string; color: 'white' | 'black' } | null {
  if (t.status !== 'playing') return null;
  const p = playerPairing(t);
  if (!p || p.black === 'bye' || p.result !== null) return null;
  return p.white === PLAYER_ID ? { id: p.black, color: 'white' } : { id: p.white, color: 'black' };
}

/** Result of a game between two NPCs from their ratings: White's score 1, 0.5 or 0. */
export function simulateResult(whiteElo: number, blackElo: number, elite: boolean, rng: Rng): number {
  const e = expectedScore(whiteElo + 35, blackElo);
  const draw = Math.min(0.5, Math.max(0.06, 0.1 + 0.32 * (1 - Math.abs(e - 0.5) * 2) + (elite ? 0.14 : 0)));
  const win = Math.max(0.02, e - draw / 2);
  const r = rng.next();
  return r < win ? 1 : r < win + draw ? 0.5 : 0;
}

/**
 * Plays the other boards of the round and moves to the next one. `playerScore` is the player's score
 * (1, 0.5, 0), or null when the round had no game for the player (a bye).
 */
export function completeRound(t: ActiveTournament, playerScore: number | null): ActiveTournament {
  const players = t.players.map((p) => ({ ...p, opponents: [...p.opponents], colors: [...p.colors] }));
  const get = (id: string): TournamentPlayer => players.find((p) => p.id === id)!;
  const rng = createRng(mixSeed(t.seed, 0x1000 + t.round));
  const roundPairings = t.pairings[t.round - 1].map((p) => ({ ...p }));
  for (const p of roundPairings) {
    if (p.black === 'bye') {
      const w = get(p.white);
      w.points += 1;
      w.opponents.push('bye');
      w.colors.push(0);
      continue;
    }
    if (p.result === null) {
      if (p.white === PLAYER_ID || p.black === PLAYER_ID) {
        const score = playerScore ?? 0;
        p.result = p.white === PLAYER_ID ? score : 1 - score;
      } else p.result = simulateResult(byId(t, p.white).elo, byId(t, p.black).elo, t.level === 'elite', rng);
    }
    const w = get(p.white);
    const b = get(p.black);
    w.points += p.result;
    b.points += 1 - p.result;
    w.opponents.push(b.id);
    b.opponents.push(w.id);
    w.colors.push(1);
    b.colors.push(-1);
  }
  const pairings = t.pairings.map((r, i) => (i === t.round - 1 ? roundPairings : r));
  const done: ActiveTournament = { ...t, players, pairings };
  if (t.round >= t.rounds) return finishTournament(done);
  return startRound({ ...done, round: t.round + 1 });
}

/** The player's game of the round ended. */
export function reportPlayerResult(t: ActiveTournament, outcome: GameOutcome): ActiveTournament {
  if (t.status !== 'playing') return t;
  return completeRound(t, outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0);
}

export interface StandingRow {
  rank: number;
  player: TournamentPlayer;
  /** Sum of the opponents' scores */
  buchholz: number;
}

export function standings(t: ActiveTournament): StandingRow[] {
  const score = new Map(t.players.map((p) => [p.id, p.points]));
  const rows = t.players.map((p) => ({ player: p, buchholz: p.opponents.reduce((s, o) => s + (o === 'bye' ? 0 : (score.get(o) ?? 0)), 0) }));
  rows.sort((a, b) => b.player.points - a.player.points || b.buchholz - a.buchholz || b.player.elo - a.player.elo || a.player.id.localeCompare(b.player.id));
  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

function finishTournament(t: ActiveTournament): ActiveTournament {
  const rows = standings(t);
  const rank = rows.find((r) => r.player.isPlayer)!.rank;
  const share = GAME_CONFIG.match.prizeShares[rank - 1] ?? 0;
  return { ...t, status: 'finished', finalRank: rank, prize: Math.round(t.prizeFund * share) };
}

/** Leaving the event: every remaining game is lost by forfeit. */
export function withdraw(t: ActiveTournament): ActiveTournament {
  let cur = t;
  let guard = 0;
  while (cur.status === 'playing' && guard++ < 50) {
    const mine = playerPairing(cur);
    cur = completeRound(cur, mine && mine.black !== 'bye' && mine.result === null ? 0 : null);
  }
  return cur;
}
