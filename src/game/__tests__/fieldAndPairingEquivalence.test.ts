/**
 * The sim-jank fix caches NPC weights in `pickField` and Swiss edge costs in `swissPairings`.
 * Both must produce exactly the old picks/pairings and consume the RNG identically.
 */
import { describe, expect, it } from "vitest";
import { pickField } from "@/game/match/tournament";
import { swissPairings } from "@/game/competition/swiss";
import { swissPairings as swissBaseline } from "./reference/swissBaseline";
import { createRng, type Rng } from "@/game/rng";
import type { Npc, TournamentPlayer } from "@/types";

/** Phase 4A Final Stable `pickField`, verbatim. */
function pickFieldBaseline(npcs: Npc[], playerRating: number, level: "local" | "national" | "international" | "elite", count: number, rng: Rng): Npc[] {
  const OFFSET = { local: -150, national: 50, international: 250, elite: 550 } as const;
  const target = level === "elite" ? Math.max(2300, playerRating + OFFSET[level]) : playerRating + OFFSET[level];
  const pool = npcs.filter((n) => n.careerStatus === "active" || n.careerStatus === "semi-retired");
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

const statuses = ["active", "active", "active", "semi-retired", "retired"] as const;
function population(seed: number, size: number): Npc[] {
  const r = createRng(seed);
  const out = Array.from({ length: size }, (_, i) => ({
    id: `npc-${seed}-${i}`,
    currentElo: Math.round(r.normal(1700, 450)),
    careerStatus: statuses[r.int(0, statuses.length - 1)],
  })) as unknown as Npc[];
  // Duplicate object references exercise the indexOf-based removal.
  if (size > 10) out.push(out[3], out[7]);
  return out;
}

describe("pickField weight cache", () => {
  it("matches the original selection and RNG stream", () => {
    const levels = ["local", "national", "international", "elite"] as const;
    for (let seed = 1; seed <= 60; seed++) {
      const npcs = population(seed, seed % 3 === 0 ? 4000 : 25 + seed * 7);
      const level = levels[seed % 4], count = (seed * 13) % 90 + 1, rating = 900 + seed * 31;
      const a = createRng(seed * 977), b = createRng(seed * 977);
      const old = pickFieldBaseline(npcs, rating, level, count, a);
      const now = pickField(npcs, rating, level, count, b);
      expect(now.map((n) => n.id)).toEqual(old.map((n) => n.id));
      expect(b.getState!()).toBe(a.getState!());
      expect(b.next()).toBe(a.next());
    }
  });
});

describe("swissPairings cost cache", () => {
  it("matches the original pairings over many simulated tournaments", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = createRng(seed * 7919);
      const size = 4 + ((seed * 5) % 60);
      let players: TournamentPlayer[] = Array.from({ length: size }, (_, i) => ({
        id: `p${i}`, name: `P${i}`, elo: 1200 + r.int(0, 1400), points: 0, opponents: [], colors: [],
      }) as unknown as TournamentPlayer);
      for (let round = 1; round <= 9; round++) {
        const old = swissBaseline(players, round);
        const now = swissPairings(players, round);
        expect(now).toEqual(old);
        // Play the round with seeded results so later rounds have scores, rematch and colour history.
        const byId = new Map(players.map((p) => [p.id, { ...p, opponents: [...p.opponents], colors: [...p.colors] }]));
        for (const g of now) {
          const w = byId.get(g.white)!;
          if (g.black === "bye") { w.points += 1; w.opponents.push("bye"); w.colors.push(0); continue; }
          const b = byId.get(g.black)!;
          const s = [1, 0.5, 0][r.int(0, 2)];
          w.points += s; b.points += 1 - s;
          w.opponents.push(b.id); b.opponents.push(w.id);
          w.colors.push(1); b.colors.push(-1);
        }
        players = [...byId.values()];
      }
    }
  });
});
