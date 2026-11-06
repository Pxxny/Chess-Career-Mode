import { gameFromSans } from '@/game/chess/rules';
import { familyOf, deriveSide, normalizeSan, slugify, type OpeningDatabase } from './database';
import type { CustomOpening, Side, UsageStats } from './types';

export interface PgnGame {
  tags: Record<string, string>;
  /** Every line in the game: the main line and each variation, each from the starting position */
  lines: string[][];
  result: string;
}

const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

/** Splits PGN text into games with tags and movetext. Comments, NAGs and annotations are dropped, variations kept. */
export function parsePgn(text: string): PgnGame[] {
  const games: PgnGame[] = [];
  const src = text.replace(/^﻿/, '').replace(/\r/g, '');
  let i = 0;
  const n = src.length;
  let tags: Record<string, string> = {};
  let tokens: string[] = [];
  let inMoves = false;
  let variationDepth = 0;

  const flush = (): void => {
    if (tokens.length || Object.keys(tags).length) {
      games.push(buildGame(tags, tokens));
    }
    tags = {};
    tokens = [];
    inMoves = false;
    variationDepth = 0;
  };

  while (i < n) {
    const c = src[i];
    if (c === '[' && (!inMoves || src[i - 1] === '\n')) {
      // A tag line starts a new game once movetext has been seen.
      // A closing bracket can occur inside a quoted tag value.
      const m = /^\[\s*(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]/.exec(src.slice(i));
      if (!m) { i++; continue; }
      if (inMoves) flush();
      tags[m[1]] = m[2].replace(/\\(.)/g, '$1');
      i += m[0].length;
    } else if (c === '{') {
      const end = src.indexOf('}', i);
      i = end < 0 ? n : end + 1;
    } else if (c === ';') {
      const end = src.indexOf('\n', i);
      i = end < 0 ? n : end + 1;
    } else if (c === '%' && (i === 0 || src[i - 1] === '\n')) {
      const end = src.indexOf('\n', i);
      i = end < 0 ? n : end + 1;
    } else if (c === '(' || c === ')') {
      tokens.push(c);
      variationDepth = Math.max(0, variationDepth + (c === '(' ? 1 : -1));
      inMoves = true;
      i++;
    } else if (/\s/.test(c)) {
      i++;
    } else {
      let j = i;
      while (j < n && !/[\s(){};]/.test(src[j])) j++;
      const word = src.slice(i, j);
      i = j;
      if (RESULTS.has(word)) {
        tokens.push(word);
        inMoves = true;
        if (variationDepth === 0) flush();
      } else {
        tokens.push(word);
        inMoves = true;
      }
    }
  }
  flush();
  return games.filter((g) => g.lines.some((l) => l.length > 0));
}

function buildGame(tags: Record<string, string>, tokens: string[]): PgnGame {
  const out: string[][] = [];
  let result = tags.Result ?? '*';
  // pos is shared through the recursion.
  let pos = 0;

  const parseLine = (prefix: string[], mainLine = false): string[] => {
    const moves = [...prefix];
    while (pos < tokens.length) {
      const t = tokens[pos++];
      if (t === ')') return moves;
      if (t === '(') {
        // A variation replaces the last move of the current line.
        const sub = parseLine(moves.slice(0, Math.max(0, moves.length - 1)));
        if (sub.length) out.push(sub);
        continue;
      }
      if (RESULTS.has(t)) {
        if (mainLine) result = t;
        continue;
      }
      if (/^\$\d+$/.test(t) || /^\d+\.*$/.test(t) || /^\d+\.\.\.$/.test(t)) continue;
      const san = t.replace(/^\d+\.+/, '').replace(/\$\d+/g, '');
      if (!san || /^[!?]+$/.test(san) || /^e\.?p\.?$/i.test(san)) continue;
      const clean = normalizeSan(san.replace(/[!?]+$/, ''));
      // Keep unreadable tokens: legality checking must stop here, rather than
      // silently joining the moves on either side into a different opening.
      moves.push(clean);
    }
    return moves;
  };

  const main = parseLine([], true);
  out.unshift(main);
  return { tags, lines: out, result };
}

export interface LineImportReport {
  added: CustomOpening[];
  /** Lines already in the database */
  known: number;
  /** Lines with an illegal move: kept up to the last legal move, or skipped when empty */
  truncated: number;
  skipped: number;
  gamesRead: number;
  warnings: string[];
}

const hash = (text: string): string => {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/**
 * Turns PGN games (repertoire files, study chapters, opening books) into opening lines.
 * The name comes from the Opening and Variation tags, else the Event tag. Variations inside a game become
 * their own lines when `includeVariations` is set.
 */
export function importOpeningLines(
  db: OpeningDatabase,
  text: string,
  options: { source: string; includeVariations: boolean; maxPlies: number; limit?: number },
): LineImportReport {
  const games = parsePgn(text);
  const report: LineImportReport = { added: [], known: 0, truncated: 0, skipped: 0, gamesRead: games.length, warnings: [] };
  const seen = new Set<string>();
  let counter = 0;
  for (const game of games) {
    const t = game.tags;
    const baseName = (t.Opening && t.Opening !== '?' ? t.Opening : '') || (t.Event && t.Event !== '?' && !/^casual|^rated|^\?/i.test(t.Event) ? t.Event : '') || (t.White && t.White !== '?' ? t.White : '') || `Imported line ${games.indexOf(game) + 1}`;
    const name = t.Variation && t.Variation !== '?' && !baseName.includes(t.Variation) ? `${baseName}: ${t.Variation}` : baseName;
    const lines = options.includeVariations ? game.lines : game.lines.slice(0, 1);
    lines.forEach((raw, index) => {
      if (options.limit && report.added.length >= options.limit) return;
      let moves = raw.slice(0, options.maxPlies);
      if (moves.length === 0) {
        report.skipped++;
        return;
      }
      if (t.FEN && t.SetUp === '1') {
        report.skipped++;
        if (report.warnings.length < 8) report.warnings.push(`"${name}" starts from a custom position and was skipped.`);
        return;
      }
      const legal = gameFromSans(moves);
      if (legal.sans.length < moves.length) {
        report.truncated++;
        if (report.warnings.length < 8) report.warnings.push(`"${name}": illegal move after ${legal.sans.length} half-moves, line shortened.`);
        moves = moves.slice(0, legal.sans.length);
        if (moves.length === 0) {
          report.skipped++;
          return;
        }
      }
      const key = moves.join(' ');
      if (db.exact(moves) || seen.has(key)) {
        report.known++;
        return;
      }
      seen.add(key);
      const lineName = index === 0 ? name : `${name}: line ${index + 1}`;
      const known = db.classify(moves);
      const eco = /^[A-E]\d\d$/.test(t.ECO ?? '') ? t.ECO : known?.entry.eco ?? 'A00';
      const orientation = (t.Orientation ?? t.Color ?? '').toLowerCase();
      const side: Side | undefined = orientation === 'black' ? 'black' : orientation === 'white' ? 'white' : undefined;
      counter++;
      report.added.push({
        id: `custom:${slugify(lineName).slice(0, 48)}-${hash(key)}`,
        eco,
        name: lineName,
        moves,
        side: side ?? deriveSide(familyOf(lineName), lineName.includes(':') ? lineName.split(':').slice(1).join(':').trim() : null),
        source: options.source,
      });
    });
  }
  if (counter === 0 && games.length === 0) report.warnings.push('No games were found in this file.');
  return report;
}

export interface CollectionReport {
  gamesRead: number;
  classified: number;
  unclassified: number;
  usage: Record<string, UsageStats>;
}

const decadeOf = (date: string | undefined): string | null => {
  const m = /^(\d{4})/.exec(date ?? '');
  return m ? String(Math.floor(Number(m[1]) / 10) * 10) : null;
};

/**
 * Counts how often each opening occurs in a game collection, with results and decades.
 * The count of an opening includes every variation below it. Only the first 40 half-moves are looked at,
 * so moves are not checked for legality (the collection is trusted to be well formed).
 */
export function importGameCollection(db: OpeningDatabase, text: string, source: string): CollectionReport {
  const games = parsePgn(text);
  const usage: Record<string, UsageStats> = {};
  let classified = 0;
  for (const g of games) {
    // Repertoire statistics classify lines from the standard starting board.
    if (g.tags.FEN && g.tags.SetUp === '1') continue;
    const moves = g.lines[0].slice(0, 40);
    const hit = db.classify(moves);
    if (!hit) continue;
    classified++;
    const decade = decadeOf(g.tags.Date ?? g.tags.UTCDate);
    for (const entry of db.path(hit.entry.id)) {
      const u = (usage[entry.id] ??= { source, games: 0, whiteWins: 0, draws: 0, blackWins: 0, byDecade: {} });
      u.games++;
      if (g.result === '1-0') u.whiteWins++;
      else if (g.result === '0-1') u.blackWins++;
      else if (g.result === '1/2-1/2') u.draws++;
      if (decade) u.byDecade[decade] = (u.byDecade[decade] ?? 0) + 1;
    }
  }
  return { gamesRead: games.length, classified, unclassified: games.length - classified, usage };
}

/** Adds up the usage of several imported collections. */
export function mergeUsage(bySource: Record<string, Record<string, UsageStats>>): Record<string, UsageStats> {
  const total: Record<string, UsageStats> = {};
  for (const [source, perOpening] of Object.entries(bySource)) {
    for (const [id, u] of Object.entries(perOpening)) {
      const t = (total[id] ??= { source: '', games: 0, whiteWins: 0, draws: 0, blackWins: 0, byDecade: {} });
      t.games += u.games;
      t.whiteWins += u.whiteWins;
      t.draws += u.draws;
      t.blackWins += u.blackWins;
      for (const [d, c] of Object.entries(u.byDecade)) t.byDecade[d] = (t.byDecade[d] ?? 0) + c;
      t.source = t.source ? `${t.source}, ${source}` : source;
    }
  }
  return total;
}

/** Writes openings as a PGN file that can be imported again. */
export function exportPgn(entries: Array<{ eco: string; name: string; moves: string[]; side?: Side }>): string {
  const tag = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
  return entries
    .map((e) => {
      const body = e.moves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join(' ');
      return [
        `[Event "${tag(e.name)}"]`,
        `[Result "*"]`,
        `[ECO "${tag(e.eco)}"]`,
        `[Opening "${tag(e.name)}"]`,
        ...(e.side ? [`[Orientation "${e.side}"]`] : []),
        '',
        `${body} *`,
        '',
      ].join('\n');
    })
    .join('\n');
}
