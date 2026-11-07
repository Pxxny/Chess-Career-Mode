import { bookMoves, getBookOpening } from '@/data/chess/openingBook';
import type { GameMode, GameOutcome, GameSave, PieceColor } from '@/types';
import { familyOf, type OpeningDatabase } from './database';
import type { OpeningEntry } from './types';

export type SourceKind = 'rated' | GameMode;

/** One game, seen from the opening statistics. */
export interface OpeningGameRef {
  id: string;
  source: SourceKind;
  color: PieceColor;
  outcome: GameOutcome;
  accuracy: number | null;
  opponentElo: number;
  year: number;
  week: number;
  /** The deepest opening the game matched. Null when the opening is unknown. */
  entry: OpeningEntry | null;
  /** Used when the opening name could not be found in the database */
  fallbackName: string | null;
  simulated: boolean;
}

export const KNOWLEDGE_LEVELS = [
  { min: 0, label: 'Unfamiliar' },
  { min: 3, label: 'Beginner' },
  { min: 8, label: 'Familiar' },
  { min: 16, label: 'Competent' },
  { min: 28, label: 'Proficient' },
  { min: 42, label: 'Expert' },
  { min: 60, label: 'Master' },
] as const;

export interface Knowledge {
  points: number;
  level: number;
  label: string;
  /** Points needed for the next level, null at the top */
  next: number | null;
}

export function knowledgeFrom(points: number): Knowledge {
  let level = 0;
  KNOWLEDGE_LEVELS.forEach((l, i) => {
    if (points >= l.min) level = i;
  });
  const next = KNOWLEDGE_LEVELS[level + 1]?.min ?? null;
  return { points: Math.round(points * 10) / 10, level, label: KNOWLEDGE_LEVELS[level].label, next };
}

export interface VariationPerf {
  name: string;
  games: number;
}

export interface OpeningPerf {
  /** Family name, or the raw name for unknown openings */
  key: string;
  family: string;
  /** ECO range of the family, "B20-B99" */
  eco: string;
  side: 'white' | 'black' | 'mixed';
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** Win rate as a share of games, 0 to 100 */
  winRate: number;
  /** Score (win = 1, draw = 0.5) as a percentage */
  score: number;
  avgAccuracy: number | null;
  accuracyGames: number;
  avgOpponentElo: number;
  mostCommonVariation: VariationPerf | null;
  variations: VariationPerf[];
  knowledge: Knowledge;
  lastPlayed: { year: number; week: number } | null;
  asWhite: { games: number; score: number };
  asBlack: { games: number; score: number };
}

const outcomeOf = (o: GameOutcome): number => (o === 'win' ? 1 : o === 'draw' ? 0.5 : 0);

/** Resolves an opening name (from a rated game record) to a database entry. */
function resolveName(db: OpeningDatabase, name: string | null | undefined): OpeningEntry | null {
  if (!name) return null;
  const exact = db.entries.find((e) => e.name === name);
  if (exact) return exact;
  const fam = db.familyByName.get(familyOf(name));
  if (fam) return db.byId.get(fam.rootId) ?? null;
  const book = db.entries.find((e) => e.name.toLowerCase().startsWith(name.toLowerCase()));
  return book ?? null;
}

/** Every game the player has played, rated and practice, matched to openings. */
export function collectOpeningGames(save: GameSave, db: OpeningDatabase): OpeningGameRef[] {
  const refs: OpeningGameRef[] = [];
  for (const g of save.history.games) {
    refs.push({
      id: `r-${g.id}`,
      source: 'rated',
      color: g.color,
      outcome: g.outcome,
      accuracy: g.analyzed === false ? null : (g.accuracy ?? null),
      opponentElo: g.opponentElo,
      year: g.year,
      week: g.week,
      entry: resolveName(db, g.opening),
      fallbackName: g.opening ?? null,
      simulated: false,
    });
  }
  for (const g of save.practice.games) {
    const entry = g.startFen ? null : db.classify(g.moves)?.entry ?? null;
    refs.push({
      id: `p-${g.id}`,
      source: g.mode,
      color: g.color,
      outcome: g.outcome,
      accuracy: g.accuracy,
      opponentElo: g.opponentElo,
      year: g.year,
      week: g.week,
      entry,
      fallbackName: entry ? null : g.openingName,
      simulated: g.simulated,
    });
  }
  return refs;
}

/** True when the game's opening is `entry` or one of its variations. */
export function gameInOpening(db: OpeningDatabase, ref: OpeningGameRef, entry: OpeningEntry): boolean {
  if (!ref.entry) return false;
  if (ref.entry.id === entry.id) return true;
  return db.path(ref.entry.id).some((e) => e.id === entry.id);
}

/** Study points from Thematic Games, per family. */
function studyByFamily(save: GameSave, db: OpeningDatabase): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of save.repertoire.study) {
    const book = getBookOpening(s.openingId);
    const hit = book ? db.classify(bookMoves(book)) : null;
    const family = hit?.entry.family ?? familyOf(s.openingName);
    map.set(family, (map.get(family) ?? 0) + Math.min(24, s.score * 4));
  }
  return map;
}

export function knowledgePoints(games: number, avgAccuracy: number | null, accuracyGames: number, variationCount: number, study: number): number {
  const play = Math.min(games, 25) + Math.max(0, games - 25) * 0.25;
  const accuracy = avgAccuracy !== null && accuracyGames >= 3 ? Math.max(0, Math.min(8, (avgAccuracy - 60) / 4)) : 0;
  return play + accuracy + Math.min(variationCount, 8) * 0.75 + Math.min(study, 24);
}

/** Performance of the player in every opening family they have met, most played first. */
export function buildOpeningPerformance(save: GameSave, db: OpeningDatabase, refs: OpeningGameRef[] = collectOpeningGames(save, db), includeSimulated = true): OpeningPerf[] {
  const groups = new Map<string, OpeningGameRef[]>();
  for (const r of refs) {
    if (!includeSimulated && r.simulated) continue;
    const key = r.entry?.family ?? r.fallbackName;
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const study = studyByFamily(save, db);
  const out: OpeningPerf[] = [];
  for (const [key, list] of groups) {
    const wins = list.filter((r) => r.outcome === 'win').length;
    const draws = list.filter((r) => r.outcome === 'draw').length;
    const losses = list.length - wins - draws;
    const acc = list.filter((r) => r.accuracy !== null);
    const avgAccuracy = acc.length ? Math.round((acc.reduce((s, r) => s + r.accuracy!, 0) / acc.length) * 10) / 10 : null;
    const variationCounts = new Map<string, number>();
    for (const r of list) {
      const name = r.entry ? (r.entry.variation ?? 'Main line (no variation)') : 'Unclassified';
      const top = name.split(',')[0].trim();
      variationCounts.set(top, (variationCounts.get(top) ?? 0) + 1);
    }
    const variations = [...variationCounts.entries()].map(([name, games]) => ({ name, games })).sort((a, b) => b.games - a.games);
    const fam = db.familyByName.get(key);
    const side = new Set(list.map((r) => r.color));
    const split = (c: PieceColor) => {
      const l = list.filter((r) => r.color === c);
      return { games: l.length, score: l.length ? Math.round((l.reduce((s, r) => s + outcomeOf(r.outcome), 0) / l.length) * 100) : 0 };
    };
    const latest = [...list].sort((a, b) => b.year - a.year || b.week - a.week)[0];
    out.push({
      key,
      family: key,
      eco: fam ? (fam.ecoFrom === fam.ecoTo ? fam.ecoFrom : `${fam.ecoFrom}-${fam.ecoTo}`) : '-',
      side: side.size === 2 ? 'mixed' : side.has('white') ? 'white' : 'black',
      games: list.length,
      wins,
      draws,
      losses,
      winRate: Math.round((wins / list.length) * 1000) / 10,
      score: Math.round((list.reduce((s, r) => s + outcomeOf(r.outcome), 0) / list.length) * 1000) / 10,
      avgAccuracy,
      accuracyGames: acc.length,
      avgOpponentElo: Math.round(list.reduce((s, r) => s + r.opponentElo, 0) / list.length),
      mostCommonVariation: variations[0] ?? null,
      variations,
      knowledge: knowledgeFrom(knowledgePoints(list.length, avgAccuracy, acc.length, variations.length, study.get(key) ?? 0)),
      lastPlayed: latest ? { year: latest.year, week: latest.week } : null,
      asWhite: split('white'),
      asBlack: split('black'),
    });
  }
  // Openings that were only studied (Thematic Games) have knowledge but no games.
  for (const [family, points] of study) {
    if (groups.has(family)) continue;
    const fam = db.familyByName.get(family);
    out.push({
      key: family, family, eco: fam ? `${fam.ecoFrom}-${fam.ecoTo}` : '-', side: fam?.side ?? 'mixed', games: 0, wins: 0, draws: 0, losses: 0, winRate: 0, score: 0,
      avgAccuracy: null, accuracyGames: 0, avgOpponentElo: 0, mostCommonVariation: null, variations: [], knowledge: knowledgeFrom(knowledgePoints(0, null, 0, 0, points)),
      lastPlayed: null, asWhite: { games: 0, score: 0 }, asBlack: { games: 0, score: 0 },
    });
  }
  return out.sort((a, b) => b.games - a.games || b.knowledge.points - a.knowledge.points || a.family.localeCompare(b.family));
}

/** Results in a single database entry including everything below it (used for preferred openings). */
export function perfForEntry(db: OpeningDatabase, refs: OpeningGameRef[], entry: OpeningEntry): { games: number; wins: number; draws: number; losses: number; winRate: number } {
  const list = refs.filter((r) => gameInOpening(db, r, entry));
  const wins = list.filter((r) => r.outcome === 'win').length;
  const draws = list.filter((r) => r.outcome === 'draw').length;
  return { games: list.length, wins, draws, losses: list.length - wins - draws, winRate: list.length ? Math.round((wins / list.length) * 1000) / 10 : 0 };
}
