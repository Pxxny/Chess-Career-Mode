import { afterEach, describe, expect, it } from "vitest";
import type { OpeningDatabase } from "@/game/openings/database";
import type { EngineAnswer } from "@/game/engine/manager";
import { MatchSession, type MatchSetup } from "@/game/match/session";
import type { MoveProfile } from "@/game/match/npcProfile";
import type { MatchSide } from "@/types";

const emptyDb: OpeningDatabase = {
  entries: [],
  byId: new Map(),
  families: [],
  familyByName: new Map(),
  ecoCodes: 0,
  customCount: 0,
  classify: () => null,
  exact: () => undefined,
  children: () => [],
  path: () => [],
  duplicates: 0,
};

const profile = (name: string): MoveProfile => ({
  name,
  baseElo: 1500,
  effectiveElo: 1500,
  style: "universal",
  personality: null,
  strengths: [],
  weaknesses: [],
  skills: null,
  morale: 70,
  form: 0,
  fatigue: 0,
  bookDepth: 0,
  lines: { white: [], black: [] },
  clockSkill: 1,
  pace: 1,
  stubborn: true,
  isPlayer: false,
  phaseElo: { opening: 0, middlegame: 0, endgame: 0 },
});

const side = (name: string, isPlayer: boolean): MatchSide => ({
  id: isPlayer ? null : "npc-1",
  name,
  elo: 1500,
  title: "none",
  countryCode: "TH",
  nationality: "Thai",
  flag: "TH",
  isPlayer,
});

const setup: MatchSetup = {
  white: side("White", true),
  black: side("Black", false),
  playerColor: "white",
  timeControl: { id: "none", label: "None", base: 0, increment: 0, category: "none" },
  rated: false,
  tournament: null,
  accuracyBonus: 0,
  profiles: { white: profile("White"), black: profile("Black") },
  mode: "simulate",
  speed: "max",
  seed: 1,
};

const engineMove = (uci: string): EngineAnswer => ({
  best: uci,
  lines: [{ uci, cp: 30, mate: null, pv: [uci], depth: 1 }],
  depth: 1,
  engine: "builtin",
  engineName: "test",
});

type CommitFn = (uci: string, spentMs: number | undefined) => boolean;

async function waitFor(condition: () => boolean, timeoutMs = 800): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for the session to continue");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("MatchSession.runAuto", () => {
  const proto = MatchSession.prototype as unknown as { commit: CommitFn };
  const originalCommit = proto.commit;

  afterEach(() => {
    proto.commit = originalCommit;
  });

  it("plays a legal fallback and continues when the first auto commit is rejected", async () => {
    let rejectedFirst = false;
    proto.commit = function (this: MatchSession, uci, spentMs) {
      if (!rejectedFirst) {
        rejectedFirst = true;
        return false;
      }
      return originalCommit.call(this, uci, spentMs);
    };

    const session = new MatchSession({
      setup,
      engine: { search: async () => engineMove("e2e4") },
      db: emptyDb,
      now: () => 0,
      sleep: async () => undefined,
      autoAnalyze: false,
      liveEval: false,
    });
    session.start();

    await waitFor(() => session.getSnapshot().game.ucis.length >= 1);
    const snap = session.getSnapshot();
    expect(snap.status).not.toBe("ready");
    expect(snap.game.ucis.length).toBeGreaterThanOrEqual(1);
    expect(snap.game.ucis[0]).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
    session.dispose();
  });
});
