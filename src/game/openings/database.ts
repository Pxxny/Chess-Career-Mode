import { ECO_DATA } from '@/data/chess/eco/ecoData';
import { FAMILY_META, VARIATION_META } from '@/data/chess/eco/meta';
import { normalizeText } from '@/utils/text';
import type { Classification, CustomOpening, EraProfile, FamilyInfo, OpeningEntry, Side, UsageStats } from './types';

/** Removes check marks and annotations so "Qa5+!" and "Qa5" compare equal. */
export const normalizeSan = (san: string): string => san.replace(/[+#!?]/g, '').replace(/^0-0-0$/, 'O-O-O').replace(/^0-0$/, 'O-O');
export const normalizeMoves = (moves: readonly string[]): string[] => moves.map(normalizeSan);

export const slugify = (text: string): string =>
  normalizeText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

interface TrieNode {
  children: Map<string, TrieNode>;
  entry?: OpeningEntry;
}

export interface OpeningDatabase {
  entries: OpeningEntry[];
  byId: Map<string, OpeningEntry>;
  families: FamilyInfo[];
  familyByName: Map<string, FamilyInfo>;
  /** Number of distinct ECO codes (A00 to E99) that have at least one opening */
  ecoCodes: number;
  customCount: number;
  /** The deepest opening that matches the start of a game. Null when even 1.xx is unknown. */
  classify: (moves: readonly string[]) => Classification | null;
  /** Exact match of a whole line */
  exact: (moves: readonly string[]) => OpeningEntry | undefined;
  children: (id: string) => OpeningEntry[];
  /** Entries on the path from the family root to the given opening */
  path: (id: string) => OpeningEntry[];
  /** Skipped lines: custom lines that were already in the database */
  duplicates: number;
}

interface Raw {
  eco: string;
  name: string;
  moves: string[];
  custom?: CustomOpening;
}

/** First part of the name before ":" or ",". */
export function familyOf(name: string): string {
  return name.split(':')[0].split(',')[0].trim();
}

export function variationOf(name: string): string | null {
  const colon = name.indexOf(':');
  if (colon >= 0) return name.slice(colon + 1).trim() || null;
  const comma = name.indexOf(',');
  return comma >= 0 ? name.slice(comma + 1).trim() || null : null;
}

const BLACK_FAMILY = /(Defen[cs]e|Declined|Accepted|Counter-?gambit|Indian|Benoni|Benko|Dutch|Slav|Gambit Accepted|Rat|Hippopotamus|Pterodactyl|Fried|Budapest|Albin|Englund)/i;

/** Which player normally chooses the line (an editorial classification). */
export function deriveSide(family: string, variation: string | null): Side {
  const base: Side = FAMILY_META[family]?.side ?? (BLACK_FAMILY.test(family) ? 'black' : 'white');
  if (!variation) return base;
  const last = variation.split(',').pop()!.trim();
  if (base === 'white' && /(Defen[cs]e|Counter-?gambit)/i.test(last)) return 'black';
  if (base === 'black' && /\b(Attack|Gambit)\b(?!\s+(Accepted|Declined))/i.test(last) && !/Defen[cs]e/i.test(last)) return 'white';
  return base;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const DEFAULT_ERAS: EraProfile = [0, 1, 1, 1, 1];

/** Moves as a short numbered string, "1.e4 c5 2.Nf3". */
export function numbered(moves: readonly string[], maxPlies = 14): string {
  const shown = moves.slice(0, maxPlies);
  const text = shown.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${m}` : m)).join(' ');
  return moves.length > maxPlies ? `${text} …` : text;
}

/** A usage estimate on the 1-5 scale from a game count in an imported collection. */
export function popularityFromGames(games: number): number {
  return games >= 5000 ? 5 : games >= 1000 ? 4 : games >= 200 ? 3 : games >= 40 ? 2 : 1;
}

function parseRaw(): Raw[] {
  const rows: Raw[] = [];
  for (const line of ECO_DATA.split('\n')) {
    const [eco, name, moves] = line.split('|');
    if (eco && name && moves) rows.push({ eco, name, moves: moves.split(' ') });
  }
  return rows;
}

/**
 * Builds the opening database: the ECO lines, plus any custom openings imported from PGN,
 * plus usage statistics counted from imported game collections.
 * Pure and deterministic.
 */
export function buildOpeningDatabase(custom: readonly CustomOpening[] = [], usage: Record<string, UsageStats> = {}): OpeningDatabase {
  const raws: Raw[] = parseRaw();
  for (const c of custom) raws.push({ eco: c.eco, name: c.name, moves: normalizeMoves(c.moves), custom: c });

  // Insert into the trie, skipping lines that already exist (the first one, an ECO line, wins).
  const root: TrieNode = { children: new Map() };
  const entries: OpeningEntry[] = [];
  const idCounts = new Map<string, number>();
  let duplicates = 0;
  for (const raw of raws) {
    let node = root;
    for (const move of raw.moves) {
      let next = node.children.get(move);
      if (!next) {
        next = { children: new Map() };
        node.children.set(move, next);
      }
      node = next;
    }
    if (node.entry) {
      duplicates++;
      continue;
    }
    const family = familyOf(raw.name);
    const variation = variationOf(raw.name);
    const baseId = raw.custom?.id ?? `${raw.eco}-${slugify(raw.name)}`;
    const seen = idCounts.get(baseId) ?? 0;
    idCounts.set(baseId, seen + 1);
    const entry: OpeningEntry = {
      id: seen === 0 ? baseId : `${baseId}-${seen + 1}`,
      eco: raw.eco,
      name: raw.name,
      family,
      variation,
      moves: raw.moves,
      line: raw.moves.join(' '),
      depth: raw.moves.length,
      parentId: null,
      childIds: [],
      descendants: 0,
      side: raw.custom?.side ?? deriveSide(family, variation),
      firstMove: raw.moves[0],
      difficulty: 2,
      popularity: 1,
      eras: DEFAULT_ERAS,
      description: raw.custom?.description ?? '',
      isMainLine: false,
      source: raw.custom ? 'custom' : 'eco',
      estimated: true,
    };
    node.entry = entry;
    entries.push(entry);
  }
  const byId = new Map(entries.map((e) => [e.id, e]));

  // Parent and children: the longest shorter entry on the same path.
  const countBelow = (node: TrieNode, nearest: OpeningEntry | null): number => {
    let total = 0;
    for (const child of node.children.values()) {
      const here = child.entry ?? null;
      if (here) {
        here.parentId = nearest?.id ?? null;
        if (nearest) nearest.childIds.push(here.id);
      }
      const below = countBelow(child, here ?? nearest);
      if (here) here.descendants = below;
      total += below + (here ? 1 : 0);
    }
    return total;
  };
  countBelow(root, null);

  // Families.
  const grouped = new Map<string, OpeningEntry[]>();
  for (const e of entries) grouped.set(e.family, [...(grouped.get(e.family) ?? []), e]);
  const families: FamilyInfo[] = [];
  for (const [name, list] of grouped) {
    const rootEntry = list.find((e) => e.variation === null) ?? [...list].sort((a, b) => a.depth - b.depth)[0];
    // Main line: follow the branch with the most openings below it, until the theory thins out.
    let tip = rootEntry;
    tip.isMainLine = true;
    for (;;) {
      const kids = tip.childIds.map((id) => byId.get(id)!).filter((k) => k.family === name);
      if (kids.length === 0 || tip.depth >= 18) break;
      const top = [...kids].sort((a, b) => b.descendants - a.descendants || a.depth - b.depth || a.eco.localeCompare(b.eco))[0];
      if (kids.length > 1 && top.descendants < 2) break;
      top.isMainLine = true;
      tip = top;
    }
    const ecos = list.map((e) => e.eco).sort();
    const meta = FAMILY_META[name];
    families.push({
      name,
      rootId: rootEntry.id,
      entryIds: list.map((e) => e.id),
      ecoFrom: ecos[0],
      ecoTo: ecos[ecos.length - 1],
      side: rootEntry.side,
      firstMove: rootEntry.firstMove,
      mainLineId: tip.id,
      popularity: meta?.popularity ?? 1,
      difficulty: meta?.difficulty ?? 2,
    });
  }
  families.sort((a, b) => a.ecoFrom.localeCompare(b.ecoFrom) || a.name.localeCompare(b.name));
  const familyByName = new Map(families.map((f) => [f.name, f]));

  // Popularity, difficulty, eras and descriptions.
  for (const e of entries) {
    const meta = FAMILY_META[e.family];
    const info = familyByName.get(e.family)!;
    const rootDepth = byId.get(info.rootId)!.depth;
    const over = Math.max(0, e.depth - rootDepth);
    const variationKey = e.variation ? `${e.family}|${e.variation.split(',')[0].trim()}` : null;
    const notable = variationKey ? VARIATION_META[variationKey] : undefined;
    const famPop = meta?.popularity ?? 1;
    const famDiff = meta?.difficulty ?? 2;
    e.eras = meta?.eras ?? DEFAULT_ERAS;
    if (e.variation === null) {
      e.popularity = famPop;
      e.difficulty = famDiff;
    } else {
      e.popularity = notable?.popularity ?? clamp(famPop - Math.floor(over / 6), 1, 5);
      e.difficulty = notable?.difficulty ?? clamp(famDiff + (e.depth >= 16 ? 1 : 0) + (e.descendants >= 25 ? 1 : 0), 1, 5);
    }
    if (!e.description) {
      const seq = numbered(e.moves);
      if (notable) e.description = `${notable.description} (${e.eco}, ${seq}).`;
      else if (e.variation === null) e.description = meta ? `${meta.description} (${e.eco}, ${seq}).` : `${e.name} (ECO ${e.eco}) arises after ${seq}. A ${e.side === 'white' ? 'White' : 'Black'} system that is rarely seen at master level.`;
      else e.description = `${e.variation} is a branch of the ${e.family} (ECO ${e.eco}), reached after ${seq}.${meta ? ` ${meta.description.split('. ')[0].replace(/\.$/, '')}.` : ''}`;
    }
    const used = usage[e.id];
    if (used) {
      e.usage = used;
      e.popularity = popularityFromGames(used.games);
      e.estimated = false;
    }
  }

  const exactNodes = (moves: readonly string[]): TrieNode | undefined => {
    let node: TrieNode | undefined = root;
    for (const m of normalizeMoves(moves)) {
      node = node.children.get(m);
      if (!node) return undefined;
    }
    return node;
  };

  const classify = (moves: readonly string[]): Classification | null => {
    let node = root;
    let best: OpeningEntry | null = null;
    let plies = 0;
    for (const m of normalizeMoves(moves)) {
      const next = node.children.get(m);
      if (!next) break;
      node = next;
      plies++;
      if (node.entry) best = node.entry;
    }
    return best ? { entry: best, bookPlies: plies } : null;
  };

  const path = (id: string): OpeningEntry[] => {
    const out: OpeningEntry[] = [];
    let cursor = byId.get(id);
    while (cursor) {
      out.unshift(cursor);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return out;
  };

  return {
    entries,
    byId,
    families,
    familyByName,
    ecoCodes: new Set(entries.map((e) => e.eco)).size,
    customCount: entries.filter((e) => e.source === 'custom').length,
    classify,
    exact: (moves) => exactNodes(moves)?.entry,
    children: (id) => (byId.get(id)?.childIds ?? []).map((c) => byId.get(c)!),
    path,
    duplicates,
  };
}

let cached: OpeningDatabase | null = null;

/** The built-in database without imports. Built on first use. */
export function getBaseOpeningDatabase(): OpeningDatabase {
  cached ??= buildOpeningDatabase();
  return cached;
}
