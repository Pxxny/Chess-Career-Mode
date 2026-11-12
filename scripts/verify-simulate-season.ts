import { highlightsOf, acknowledgeArticle } from "../src/game/career/highlights.ts";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { Chess } from "chess.js";
import { randomAppearance } from "../src/data/appearance.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import { buildCareerWorld } from "../src/game/npc/buildCareerWorld.ts";
import {
  newSeason,
  runSeason,
  seasonOf,
  type SeasonPort,
} from "../src/game/career/seasonSimulation.ts";
import {
  playSeasonGame,
  type SeasonGameInput,
  type SeasonGameFinish,
} from "../src/game/career/seasonGame.ts";
import { getBaseOpeningDatabase } from "../src/game/openings/database.ts";
import {
  applyFinishedMatch,
  applyNpcResult,
} from "../src/game/match/aftermath.ts";
import { endDay } from "../src/game/training/engine.ts";
import { expireCompetition } from "../src/game/competition/calendar.ts";
import { gameDay } from "../src/game/competition/agenda.ts";
import { createBackup, parseBackup } from "../src/store/backup.ts";
import { reconcileTournamentHistory } from "../src/game/npc/tournamentHistory.ts";
import { mergeMatches } from "../src/store/matchArchive.ts";
import { matchPgn } from "../src/game/match/pgn.ts";
import { openingGames, tournamentGames } from "../src/game/qol/history.ts";
import { GAME_CONFIG } from "../src/data/config.ts";
import type { GameSave } from "../src/types/index.ts";
const opts = {
  name: "Replay QA",
  gender: "undisclosed" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: randomAppearance(),
  startYear: 2026,
  alternateHistory: false,
  playerDatabase: "small" as const,
};
const base = createNewSave(opts, {
    ...createCareerRecord(opts),
    id: "season-replay-qa",
    databaseKey: "season-replay-qa:2026",
  }),
  world = buildCareerWorld(base.career),
  db = getBaseOpeningDatabase();
const cache = new Map<string, SeasonGameFinish>();
const measured: SeasonGameFinish[] = [];
function validate(f: SeasonGameFinish) {
  const chess = new Chess();
  assert.equal(f.recording.ucis.length, f.moves.length);
  assert.equal(f.recording.clocks.length, f.moves.length + 1);
  assert(f.moves.length > 0);
  f.moves.forEach((san, i) => {
    const move = chess.move(san);
    assert(move);
    assert.equal(move.from + move.to + (move.promotion ?? ""), f.ucis[i]);
  });
  assert.equal(chess.fen(), f.recording.finalFen);
  assert.equal(f.recording.rulesWarnings, 0);
  if (f.termination === "checkmate") {
    assert(chess.isCheckmate());
    assert.equal(f.result, chess.turn() === "w" ? "black" : "white");
  }
  if (f.termination === "repetition") assert(chess.isThreefoldRepetition());
  if (f.termination === "stalemate") assert(chess.isStalemate());
  if (f.termination === "insufficient") assert(chess.isInsufficientMaterial());
  assert(f.recording.wallMs >= f.recording.searchMs - 1);
  assert(f.recording.wallMs > 0);
  assert(f.recording.searchMs >= 0);
  const initial = f.recording.clocks[0],
    baseMs = f.setup.timeControl.base * 1000;
  assert.equal(initial.white, baseMs);
  assert.equal(initial.black, baseMs);
  for (let i = 1; i < f.recording.clocks.length; i++) {
    const prev = f.recording.clocks[i - 1],
      c = f.recording.clocks[i],
      side = i % 2 ? "white" : "black",
      other = i % 2 ? "black" : "white";
    assert.equal(c[other], prev[other]);
    assert(c[side]! > 0);
    assert(c[side]! <= prev[side]! + f.setup.timeControl.increment * 1000);
    assert(Number.isFinite(c[side]));
  }
  const final = f.recording.finalClocks;
  assert(final.white! >= 0 && final.black! >= 0);
  if (f.termination === "timeout")
    assert(final.white === 0 || final.black === 0);
  const expected =
    baseMs * 2 +
    f.setup.timeControl.increment * 1000 * f.moves.length -
    final.white! -
    final.black!;
  assert(Math.abs(f.recording.gameTimeMs! - expected) < 1);
}
function harness(initial: GameSave, npcInitial = world, useCache = false) {
  let save = structuredClone(initial),
    npcs = structuredClone(npcInitial),
    stopped = false;
  const commit = (next: GameSave) => {
    save = next;
    const changed = new Map(
      reconcileTournamentHistory(save, npcs).map((n) => [n.id, n]),
    );
    npcs = npcs.map((n) => changed.get(n.id) ?? n);
  };
  const port: SeasonPort = {
    read: () => save,
    npcs: () => npcs,
    commit,
    cancelled: () => stopped,
    advanceDay: async () => commit(expireCompetition(endDay(save).save)),
    yield: () => Promise.resolve(),
    play: async (input: SeasonGameInput) => {
      const key = JSON.stringify([
        input.tournament.id,
        input.tournament.round,
        input.npc.id,
        input.save.player.rating,
        input.save.player.skills,
        input.save.training.fatigue,
      ]);
      const old = cache.get(key);
      if (useCache && old) return structuredClone(old);
      const finish = await playSeasonGame(input);
      validate(finish);
      if (!useCache) measured.push(finish);
      cache.set(key, structuredClone(finish));
      return finish;
    },
    finish: (finish) => {
      const before = save,
        result = applyFinishedMatch(save, finish, db);
      if (!result.record) return false;
      const opp =
        finish.setup[finish.setup.playerColor === "white" ? "black" : "white"];
      npcs = npcs.map((n) =>
        n.id === opp.id
          ? applyNpcResult(
              n,
              result.record!.outcome === "win"
                ? "loss"
                : result.record!.outcome === "loss"
                  ? "win"
                  : "draw",
              before.player.rating,
            )
          : n,
      );
      commit(result.save);
      return true;
    },
  };
  return {
    port,
    get save() {
      return save;
    },
    get npcs() {
      return npcs;
    },
    cancel: () => {
      stopped = true;
    },
  };
}
async function finishWithNews(port: SeasonPort) {
  for (let i = 0; i < 500; i++) {
    await runSeason(port);
    let save = port.read()!;
    if (seasonOf(save)?.status === "completed") return;
    const unread = highlightsOf(save).unread;
    assert(unread.length, "Simulation must finish or pause for a real news event");
    for (const id of unread) save = acknowledgeArticle(save, id);
    port.commit(save);
  }
  throw new Error("Too many important news pauses");
}
const seed = { ...base, seasonSimulation: newSeason(base, "competition") },
  h = harness(seed),
  started = performance.now();
await finishWithNews(h.port);
const wall = performance.now() - started;
const all = mergeMatches(h.save.matchArchivePending ?? [], h.save.matches),
  s = seasonOf(h.save)!;
assert.equal(s.status, "completed");
assert.equal(s.days, 364);
assert.equal(gameDay(h.save), 2027 * 364);
assert.equal(all.length, s.games);
assert(s.games > GAME_CONFIG.match.maxRecords);
assert.equal(h.save.matches.length, GAME_CONFIG.match.maxRecords);
assert(
  all.every(
    (m) => m.moves.length && m.recording && m.termination !== "simulation",
  ),
);
assert(all.some((m) => !h.save.matches.some((n) => n.id === m.id)));
assert.equal(new Set(all.map((m) => m.id)).size, all.length);
assert(all.every((m) => m.analysis === null));
assert(h.save.history.games.every((g) => g.analyzed === false));
assert(all.some((m) => m.openingName && m.openingEco));
const first = all[0],
  opening = db.classify(first.moves);
assert.equal(first.openingName, opening?.entry.name ?? null);
assert.equal(first.openingEco, opening?.entry.eco ?? null);
const pgn = matchPgn(first),
  reloaded = new Chess();
reloaded.loadPgn(pgn);
assert.equal(reloaded.history().length, first.moves.length);
assert.equal(reloaded.fen(), first.recording!.finalFen);
assert(pgn.includes("[%clk"));
assert.equal(reloaded.getHeaders().Opening, first.openingName);
const archiveSave = { ...h.save, matches: all };
if (first.openingName) {
  const rows = openingGames(archiveSave, first.openingName);
  assert(rows.some((r) => r.match?.id === first.id));
}
const firstEvent = h.save.competition?.archive.find(
  (t) => t.eventId === first.setup.tournament?.id,
);
if (firstEvent)
  assert(
    tournamentGames(firstEvent, "player", all)
      .filter((r) => !r.bye && r.outcome !== null)
      .every((r) => r.match?.moves.length),
  );
const backup = await createBackup(h.save, h.npcs),
  parsed = await parseBackup(JSON.stringify(backup));
assert.equal(parsed.payload.matchArchive!.length, s.games);
assert.deepEqual(parsed.payload.matchArchive![0].recording, first.recording);
const old = { ...first, analysis: null, recording: undefined, moves: [] };
assert.equal(mergeMatches([first], [old])[0].moves.length, first.moves.length);
assert(mergeMatches([first], [old])[0].recording);
// Pause mid-event, serialize the saved state and resume with the same recorded-game input cache.
const paused = harness(seed, world, true);
paused.port.yield = async () => {
  if (paused.save.player.ratedGames >= 3) paused.cancel();
};
await runSeason(paused.port);
const resumed = harness(
  JSON.parse(JSON.stringify(paused.save)),
  paused.npcs,
  true,
);
await finishWithNews(resumed.port);
assert.deepEqual(
  resumed.save.history.games.map((g) => g.outcome),
  h.save.history.games.map((g) => g.outcome),
);
assert.equal(resumed.save.player.rating, h.save.player.rating);
const savedIds = all.map((m) => m.id);
await runSeason(h.port);
assert.deepEqual(
  mergeMatches(h.save.matchArchivePending ?? [], h.save.matches).map(
    (m) => m.id,
  ),
  savedIds,
);
const samples = measured.map((m) => m.recording.wallMs).sort((a, b) => a - b),
  percentile = (q: number) =>
    samples[Math.max(0, Math.ceil(q * samples.length) - 1)],
  report = {
    environment: "Node cloud; not a phone speed estimate",
    database: "Small",
    days: s.days,
    games: s.games,
    seasonWallMs: wall,
    totalGameMs: samples.reduce((a, b) => a + b, 0),
    meanGameMs: samples.reduce((a, b) => a + b, 0) / samples.length,
    p50GameMs: percentile(0.5),
    p95GameMs: percentile(0.95),
    maxGameMs: samples.at(-1),
    totalPlies: measured.reduce((n, m) => n + m.moves.length, 0),
    openings: new Set(all.map((m) => m.openingName)).size,
    wins: s.wins,
    draws: s.draws,
    losses: s.losses,
    backupMatches: parsed.payload.matchArchive!.length,
  };
writeFileSync(
  "verification/season-replays/node-timings.json",
  JSON.stringify(report, null, 2) + "\n",
);
writeFileSync("verification/season-replays/example-game.pgn", pgn);
console.log(
  "PASS: legal real games, board-derived results, clocks/increments/timeouts, actual openings/ECO, PGN re-import, all-match retention beyond cache, opening/tournament lookup, full backup, rich-data merge, deterministic pause/reload and no duplicate results.",
);
console.log(JSON.stringify(report, null, 2));
