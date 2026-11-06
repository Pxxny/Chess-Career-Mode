import { COUNTRY_WEIGHTS, DEFAULT_COUNTRY_WEIGHT } from '@/data/world/countryWeights';
import { PLAY_STYLES } from '@/data/chess/traits';
import type { OpeningDatabase } from '@/game/openings/database';
import { createRng, mixSeed, type Rng } from '@/game/rng';
import type { PlayStyle } from '@/types';
import { linesFromEntries, temperamentOf, type Opponent, type Temperament } from './opponent';

/** A simulated player on the practice server. Their ratings and habits are stable for a career. */
export interface OnlinePlayer {
  id: string;
  username: string;
  countryCode: string;
  /** Starting blitz rating (their current rating also includes the shift from meeting you) */
  rating: number;
  /** Games they have "played" on the server */
  games: number;
  memberSince: number;
  style: PlayStyle;
  temperament: Temperament;
  /** Database ids of the openings they like */
  favouriteIds: string[];
  /** Time controls they seek */
  timeControls: string[];
  bio: string;
  /** Share of the time they are online at any moment, 0 to 1 */
  activity: number;
}

const ADJECTIVES = ['Swift', 'Silent', 'Crimson', 'Lazy', 'Frozen', 'Mighty', 'Hidden', 'Clever', 'Quiet', 'Rapid', 'Golden', 'Iron', 'Lucky', 'Brave', 'Sneaky', 'Cosmic', 'Wild', 'Calm', 'Sharp', 'Dusty'];
const NOUNS = ['Knight', 'Bishop', 'Rook', 'Pawn', 'Gambit', 'Fianchetto', 'Zugzwang', 'Castle', 'Tempo', 'Fork', 'Pin', 'Skewer', 'Endgame', 'Opposition', 'Outpost', 'Dragon', 'Falcon', 'Wolf', 'Fox', 'Tiger'];
const BIOS: Record<Temperament, string[]> = {
  aggressive: ['Attack first, calculate later.', 'If it is not a sacrifice, it is not chess.', 'Always going for the king.'],
  defensive: ['Solid structure, long game.', 'Patience wins endgames.', 'I never resign early and rarely blunder.'],
  neutral: ['Just here to play some blitz.', 'Learning every day.', 'Any opening, any time.'],
};
const TIME_CONTROLS = ['3+0', '3+2', '4+2', '5+0', '5+3'];

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Builds the pool deterministically from a seed. */
export function buildOnlinePool(seed: number, db: OpeningDatabase, year: number, size: number): OnlinePlayer[] {
  const rng = createRng(mixSeed(seed, 0x0b17c));
  const codes = Object.keys(COUNTRY_WEIGHTS);
  const pool: OnlinePlayer[] = [];
  const used = new Set<string>();
  const popular = db.entries.filter((e) => e.popularity >= 3 && e.depth <= 10);
  for (let i = 0; i < size; i++) {
    let username = '';
    for (let a = 0; a < 20; a++) {
      username = `${rng.pick(ADJECTIVES)}${rng.pick(NOUNS)}${rng.chance(0.6) ? rng.int(1, 99) : ''}`;
      if (!used.has(username)) break;
      username += rng.int(100, 999);
    }
    used.add(username);
    const style = rng.pick(PLAY_STYLES);
    const temperament = temperamentOf(style);
    const rating = Math.round(clamp(rng.normal(1450, 380), 600, 2850) / 5) * 5;
    const whiteLike = popular.filter((e) => e.side === 'white');
    const blackLike = popular.filter((e) => e.side === 'black');
    const favourites = [rng.pick(whiteLike), rng.pick(blackLike), rng.pick(blackLike)].map((e) => e.id);
    const tcs = rng.shuffle(TIME_CONTROLS).slice(0, rng.int(2, 4));
    pool.push({
      id: `ol${i + 1}`,
      username,
      countryCode: rng.weighted(codes, (c) => (COUNTRY_WEIGHTS[c] ?? DEFAULT_COUNTRY_WEIGHT) + 0.2),
      rating,
      games: Math.round(clamp(rng.normal(900, 700), 30, 12000)),
      memberSince: Math.max(1995, year - rng.int(0, 12)),
      style,
      temperament,
      favouriteIds: favourites,
      timeControls: tcs,
      bio: rng.pick(BIOS[temperament]),
      activity: rng.float(0.2, 0.7),
    });
  }
  return pool;
}

export const currentRating = (p: OnlinePlayer, delta: Record<string, number>): number => Math.round(p.rating + (delta[p.id] ?? 0));

export interface MatchRequest {
  rating: number;
  timeControl: string;
  /** Widest rating gap the player accepts, in either direction */
  maxRange: number;
  /** Players to skip, such as the last opponent */
  exclude?: string[];
}

export interface Match {
  player: OnlinePlayer;
  /** Simulated seconds spent waiting */
  waitSeconds: number;
  /** The rating window when the match was found */
  range: number;
  /** Rating windows tried, for the search animation */
  steps: Array<{ second: number; range: number; candidates: number }>;
}

/**
 * Simulated matchmaking. Each simulated second the rating window widens by 25 points, from 50, and the
 * seeker is paired with someone currently online inside it. Who is online changes every minute and favours
 * players who like the chosen time control.
 */
export function findMatch(pool: OnlinePlayer[], delta: Record<string, number>, request: MatchRequest, seed: number): Match | null {
  const rng = createRng(mixSeed(seed, 0x5eed));
  const online = pool.filter((p) => !request.exclude?.includes(p.id) && rng.chance(p.activity * (p.timeControls.includes(request.timeControl) ? 1.4 : 0.6)));
  const steps: Match['steps'] = [];
  for (let second = 1; second <= 60; second++) {
    const range = Math.min(request.maxRange, 50 + 25 * (second - 1));
    const inside = online.filter((p) => Math.abs(currentRating(p, delta) - request.rating) <= range);
    if (steps.length < 12) steps.push({ second, range, candidates: inside.length });
    if (inside.length > 0) {
      // Closest ratings are the most likely.
      const picked = rng.weighted(inside, (p) => 1 / (1 + Math.abs(currentRating(p, delta) - request.rating) / 40));
      return { player: picked, waitSeconds: second, range, steps };
    }
    if (range >= request.maxRange && second > 6) break;
  }
  return null;
}

export function opponentFromOnline(p: OnlinePlayer, delta: Record<string, number>, db: OpeningDatabase): Opponent {
  return { id: p.id, name: p.username, elo: currentRating(p, delta), style: p.style, temperament: p.temperament, lines: linesFromEntries(db, p.favouriteIds) };
}

