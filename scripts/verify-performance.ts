import assert from "node:assert/strict";
import {
  createPerformanceRecorder,
  performanceRecorder,
} from "../src/diagnostics/performance.ts";
import { EngineManager } from "../src/game/engine/manager.ts";
import type { StockfishBackend } from "../src/game/engine/stockfish.ts";
import { MatchSession } from "../src/game/match/session.ts";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs.ts";
import { sideForNpc } from "../src/game/match/setup.ts";
import { buildNpcProfile } from "../src/game/match/npcProfile.ts";
import { getBaseOpeningDatabase } from "../src/game/openings/database.ts";
import { createRng } from "../src/game/rng.ts";
import { START_FEN } from "../src/game/chess/rules.ts";
import "../src/game/match/chessjs.ts";
let time = 0;
const r = createPerformanceRecorder(() => time);
r.record("city.load", 12);
assert.equal(r.snapshot().metrics.length, 0);
const disabled = r.begin("city.load");
r.setEnabled(true);
time = 10;
disabled();
assert.equal(r.snapshot().metrics.length, 0);
const finish = r.begin("city.load");
time = 25;
finish({ country: "RU" });
finish();
assert.equal(r.snapshot().metrics[0].last.ms, 15);
assert.equal(r.snapshot().metrics[0].count, 1);
const pending = r.begin("city.load");
r.clear();
time = 100;
pending();
assert.equal(r.snapshot().metrics.length, 0);
const paused = r.begin("engine.search");
r.setEnabled(false);
r.setEnabled(true);
time = 110;
paused();
assert.equal(r.snapshot().metrics.length, 0);
for (let i = 1; i <= 250; i++) r.record("engine.search", i);
const s = r.snapshot();
assert.equal(s.recent.length, 200);
assert.equal(s.metrics[0].count, 250);
assert.equal(s.metrics[0].meanMs, 125.5);
assert.equal(s.metrics[0].p95Ms, 245);
assert.equal(s.metrics[0].sampleCount, 100);
r.record("engine.search", NaN);
r.record("engine.search", -1);
assert.equal(r.snapshot().metrics[0].count, 250);
r.record("city.filter", 1, {
  country: "x".repeat(100),
  query: "private query",
  save: { player: "private" },
} as any);
assert.deepEqual(r.snapshot().metrics[1].last.tags, {
  country: "x".repeat(80),
});
s.recent[0].tags.country = "mutated";
assert(!r.snapshot().recent.some((e) => e.tags.country === "mutated"));
assert.equal(
  performanceRecorder.isEnabled(),
  false,
  "ordinary Node/game code does not enable diagnostics",
);
performanceRecorder.setEnabled(true);
performanceRecorder.clear();
const request = { fen: START_FEN, moves: [], movetime: 60 };
let received: any;
const result = {
  best: "e2e4",
  depth: 3,
  lines: [{ uci: "e2e4", cp: 20, mate: null, pv: ["e2e4"], depth: 3 }],
};
const engine = new EngineManager(
  async () =>
    ({
      kind: "stockfish",
      name: "test fixture",
      search: async (q: any) => {
        received = q;
        return result;
      },
      stop() {},
      dispose() {},
    }) as unknown as StockfishBackend,
);
assert.equal((await engine.search(request)).best, result.best);
assert.equal(received, request);
assert.equal(
  performanceRecorder.snapshot().metrics.find((m) => m.id === "engine.search")!
    .last.tags.budgetMs,
  60,
);
assert.equal(
  performanceRecorder.snapshot().metrics.find((m) => m.id === "engine.load")!
    .last.tags.engine,
  "stockfish",
);
performanceRecorder.clear();
const [white, black] = buildWorldNpcs(2026).filter(
  (n) => n.careerStatus === "active",
);
const profile = (n: typeof white) => ({
  ...buildNpcProfile(n, { white: [], black: [] }, { rng: createRng(1) }),
  bookDepth: 0,
  stubborn: true,
});
async function run(enabled: boolean) {
  performanceRecorder.setEnabled(enabled);
  let finished: any;
  const session = new MatchSession({
    setup: {
      white: sideForNpc(white),
      black: sideForNpc(black),
      playerColor: "white",
      rated: false,
      tournament: null,
      accuracyBonus: 0,
      mode: "simulate",
      speed: "max",
      seed: 1,
      timeControl: {
        id: "qa",
        label: "60+0",
        base: 60,
        increment: 0,
        category: "blitz",
      },
      profiles: { white: profile(white), black: profile(black) },
    },
    initialState: {
      ucis: ["f2f3", "e7e5", "g2g4"],
      clocks: { white: 45000, black: 47000 },
      rngState: 12345,
    },
    db: getBaseOpeningDatabase(),
    engine: {
      search: async () => ({
        best: "d8h4",
        engine: "stockfish",
        engineName: "test fixture",
        depth: 5,
        lines: [{ uci: "d8h4", pv: ["d8h4"], depth: 5, mate: 1, cp: null }],
      }),
    },
    autoAnalyze: false,
    liveEval: false,
    onFinish: (f) => (finished = f),
  });
  session.start();
  for (let i = 0; i < 100 && !finished; i++)
    await new Promise((r) => setTimeout(r, 10));
  assert(finished);
  session.dispose();
  return {
    moves: finished.ucis,
    result: finished.result,
    termination: finished.termination,
  };
}
const measured = await run(true),
  entry = performanceRecorder
    .snapshot()
    .metrics.find((m) => m.id === "match.auto-move")!;
assert.equal(entry.last.tags.speed, "max");
assert.equal(entry.last.tags.book, false);
const unmeasured = await run(false);
assert.deepEqual(measured, unmeasured);
assert.equal(
  performanceRecorder
    .snapshot()
    .metrics.find((m) => m.id === "match.auto-move")!.count,
  1,
);
performanceRecorder.clear();
console.log(
  "PASS opt-in only, monotonic/idempotent spans, clear/pause invalidate in-flight samples, bounded 100/200 retention, correct percentile/mean, metadata allowlist, immutable reports, original engine request/budget and identical legal match/result with diagnostics on/off.",
);
