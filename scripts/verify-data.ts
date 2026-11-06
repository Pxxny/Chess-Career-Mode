// Data regressions: run with Node 22.6+ and scripts/register-alias.mjs (see README).
import assert from 'node:assert/strict';
import { randomAppearance } from '../src/data/appearance.ts';
import { GAME_CONFIG } from '../src/data/config.ts';
import { createCareerRecord } from '../src/game/career/createCareer.ts';
import { createNewSave } from '../src/game/createNewSave.ts';
import { getBaseOpeningDatabase, buildOpeningDatabase } from '../src/game/openings/database.ts';
import { exportPgn, importGameCollection, importOpeningLines, mergeUsage, parsePgn } from '../src/game/openings/pgn.ts';
import { upgradeSave } from '../src/game/training/migrate.ts';
import type { GameSave } from '../src/types/index.ts';

const options = { name: 'Data Test', gender: 'undisclosed' as const, countryCode: 'NO', city: { name: 'Oslo', custom: false }, archetype: 'balanced' as const, appearance: randomAppearance(), startYear: 2020, alternateHistory: false };
const base = createNewSave(options, createCareerRecord(options));
for (const version of [3, 4, 5]) {
  const legacy = structuredClone(base) as unknown as Record<string, unknown>;
  legacy.version = version;
  delete legacy.practice;
  delete legacy.repertoire;
  if (version < 5) {
    delete legacy.training;
    delete (legacy.player as Record<string, unknown>).attributes;
    delete (legacy.world as Record<string, unknown>).day;
  }
  if (version < 4) delete legacy.history;
  const original = structuredClone(legacy);
  const migrated = upgradeSave(legacy as unknown as GameSave);
  assert.equal(migrated.version, GAME_CONFIG.saveVersion, `v${version} updates inner version`);
  assert.equal(migrated.player.name, base.player.name);
  assert.equal(migrated.player.rating, base.player.rating);
  assert.deepEqual(migrated.career, base.career);
  assert.equal(migrated.practice.games.length, 0);
  assert.equal(Object.keys(migrated.repertoire.preferences).length, 9);
  assert.ok(migrated.player.attributes && migrated.history.games && migrated.training);
  assert.deepEqual(legacy, original, 'migration does not change original object');
  assert.deepEqual(upgradeSave(migrated), migrated, 'migration is idempotent');
}
const current = structuredClone(base);
current.repertoire.preferences.white = ['my-opening'];
current.practice.blitzRating = 1730;
current.practice.blitzGames = 12;
assert.deepEqual(upgradeSave(current), current, 'current save keeps games, ratings and preferences');

const db = getBaseOpeningDatabase();
const variationResults = parsePgn('[Event "RAV"]\n[Result "1-0"]\n\n1. e4 (1. d4 d5 0-1) c5 2. Nf3 d6 1-0');
assert.equal(variationResults.length, 1, 'a variation result does not split a game');
assert.equal(variationResults[0].result, '1-0', 'variation result does not overwrite main result');
assert.deepEqual(variationResults[0].lines[0], ['e4', 'c5', 'Nf3', 'd6']);
assert.deepEqual(variationResults[0].lines[1], ['d4', 'd5']);

const source = 'Regression';
const customMoves = ['e4', 'c5', 'h4', 'b6', 'h5', 'a6'];
assert.equal(db.exact(customMoves), undefined);
const title = 'Test [book] "quoted" \\ line, variation';
const exported = exportPgn([{ name: title, eco: 'B20', moves: customMoves, side: 'black' }]);
const parsed = parsePgn(exported);
assert.equal(parsed.length, 1);
assert.equal(parsed[0].tags.Opening, title, 'PGN tag quotes, brackets and backslashes round trip');
const imported = importOpeningLines(db, exported, { source, includeVariations: true, maxPlies: 80 });
assert.equal(imported.added.length, 1);
assert.equal(imported.added[0].name, title);
assert.deepEqual(imported.added[0].moves, customMoves);
assert.equal(imported.added[0].side, 'black');
const customDb = buildOpeningDatabase(imported.added);
assert.equal(importOpeningLines(customDb, exported, { source, includeVariations: true, maxPlies: 80 }).known, 1, 'reimport does not duplicate lines');

const bad = importOpeningLines(db, '1. e4 c5 2. h4 TYPO b6 3. h5 a6 *', { source, includeVariations: true, maxPlies: 80 });
assert.equal(bad.truncated, 1, 'unknown movetext is reported instead of deleted');
assert.ok(bad.added.every((line) => line.moves.length <= 3));
assert.equal(importOpeningLines(db, 'not a chess game', { source, includeVariations: true, maxPlies: 80 }).added.length, 0);
const setup = '[SetUp "1"]\n[FEN "invalid position"]\n\n1. e4 c5 *';
assert.equal(importOpeningLines(db, setup, { source, includeVariations: true, maxPlies: 80 }).skipped, 1, 'custom FEN skipped before parsing board');
assert.equal(importGameCollection(db, setup, source).classified, 0, 'custom positions do not alter standard opening statistics');

const collection = importGameCollection(customDb, [
  '[Date "1999.01.01"]\n1. e4 c5 2. h4 b6 3. h5 a6 1-0',
  '[Date "2001.01.01"]\n1. e4 c5 2. h4 b6 3. h5 a6 0-1',
  '[Date "2009.01.01"]\n1. e4 c5 2. h4 b6 3. h5 a6 1/2-1/2',
].join('\n\n'), source);
assert.equal(collection.classified, 3);
const id = imported.added[0].id;
assert.deepEqual(collection.usage[id], { source, games: 3, whiteWins: 1, blackWins: 1, draws: 1, byDecade: { '1990': 1, '2000': 2 } });
const merged = mergeUsage({ first: collection.usage, second: collection.usage });
assert.equal(merged[id].games, 6);
assert.equal(merged[id].byDecade['2000'], 4);
assert.equal(buildOpeningDatabase(imported.added, merged).byId.get(id)?.estimated, false);
assert.equal(parsePgn('1.e4$1 c5 2.Nf3 e.p. d6 *')[0].lines[0].join(' '), 'e4 c5 Nf3 d6', 'NAGs and en passant annotations are ignored');
console.log('Data verification passed: legacy v3/v4/v5, repertoire export/import, malformed PGN, variation results, collection counts.');
