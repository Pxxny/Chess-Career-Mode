import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomAppearance } from "../src/data/appearance.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import {
  buildCareerWorld,
  buildCareerWorldAsync,
} from "../src/game/npc/buildCareerWorld.ts";
import { localCompetitors } from "../src/game/npc/localPool.ts";
import {
  fictionalCountFor,
  PLAYER_DATABASES,
} from "../src/game/npc/playerDatabase.ts";
import { pickEventField } from "../src/game/match/tournament.ts";
import { createRng } from "../src/game/rng.ts";
import { fideNpcs, type FideDataset } from "../src/game/npc/fidePlayers.ts";
import { upgradeNpcIdentities } from "../src/game/npc/identity.ts";
import { applyWorldState } from "../src/game/npc/worldState.ts";
import { applyNpcResult } from "../src/game/npc/results.ts";
import { metaFor, isMetaCurrent } from "../src/store/npcRepository.ts";
import { useNpcStore } from "../src/store/npcStore.ts";
import { createBackup, parseBackup } from "../src/store/backup.ts";
import {
  creationEstimate,
  initialPlayerCount,
  rememberCreationTime,
} from "../src/features/creation/databaseEstimate.ts";
const options = {
  name: "Database QA",
  gender: "undisclosed" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: randomAppearance(),
  startYear: 2026,
  alternateHistory: false,
};
const timings: Record<string, number> = {};
const worldByMode = new Map();
for (const choice of PLAYER_DATABASES.filter((c) => c.id !== "real")) {
  const career = createCareerRecord({ ...options, playerDatabase: choice.id });
  const progress: number[] = [];
  const started = performance.now();
  const world = buildCareerWorld(career, (p) => progress.push(p.done));
  timings[choice.id] = Math.round(performance.now() - started);
  assert.equal(world.length, initialPlayerCount(choice.id, 2026));
  assert.equal(
    world.filter((n) => n.kind === "fictional").length,
    choice.fictionalCount + 80,
  );
  assert.equal(new Set(world.map((n) => n.id)).size, world.length);
  assert(progress.every((p, i) => !i || p >= progress[i - 1]));
  assert.equal(progress.at(-1), world.length);
  assert.equal(metaFor(career).fictionalCount, choice.fictionalCount);
  assert(isMetaCurrent(metaFor(career), career));
  worldByMode.set(choice.id, world);
}
assert.equal(fictionalCountFor(createCareerRecord(options)), 4000);
const domestic = localCompetitors("TH", "Bangkok", 2026);
assert.equal(domestic.length, 80);
assert(domestic.every((n) => n.nationality === "TH"));
assert(new Set(domestic.map((n) => n.city)).size > 10);
assert.deepEqual(
  localCompetitors("TH", "Chiang Mai", 2026),
  domestic,
  "Domestic identities independent of player city",
);
const small = worldByMode.get("small");
for (let seed = 0; seed < 10; seed++) {
  const field = pickEventField(
    small,
    1200,
    {
      level: "local",
      fieldSize: 64,
      details: { country: "TH", city: "Bangkok" } as any,
    },
    createRng(seed),
  );
  assert.equal(field.length, 63);
  assert(field.every((n) => n.nationality === "TH"));
  assert(new Set(field.map((n) => n.city)).size > 10);
}
const domesticCareer = createCareerRecord({
  ...options,
  playerDatabase: "small",
});
useNpcStore.setState({
  npcs: small,
  careerId: domesticCareer.id,
  startYear: 2026,
  playerDatabase: "small",
  status: "ready",
});
await useNpcStore
  .getState()
  .ensureLocalPool(domesticCareer.id, "TH", "Chiang Mai", 2027);
assert.equal(
  useNpcStore.getState().npcs.length,
  912,
  "Moving within a country never duplicates its domestic cohort",
);
await useNpcStore
  .getState()
  .syncWorld({ year: 2027, week: 1, alternateHistory: false });
assert(useNpcStore.getState().npcs.length > 912);
assert(
  useNpcStore.getState().npcs.length <= 960,
  "New cohorts scale with the chosen size",
);
const data = JSON.parse(
  readFileSync("public/data/fide/players-2026-11.json", "utf8"),
) as FideDataset;
const realCareer = createCareerRecord({ ...options, playerDatabase: "real" });
const previousFetch = globalThis.fetch;
globalThis.fetch = async () =>
  new Response(JSON.stringify(data), { status: 200 });
const real = await buildCareerWorldAsync(realCareer);
globalThis.fetch = previousFetch;
assert.equal(real.length, 20000);
assert.equal(new Set(real.map((n) => n.id)).size, 20000);
assert(
  real.every(
    (n) =>
      n.kind === "real" && n.realProfile && n.tournamentHistory.length === 0,
  ),
);
assert.equal(new Set(real.map((n) => n.nationality)).size, 208);
const magnus = real.find((n) => n.name === "Magnus Carlsen")!;
assert.equal(magnus.currentElo, 2823);
assert.equal(magnus.realProfile!.fideId, 1503014);
assert(magnus.realProfile!.portraitId?.includes("carlsen"));
assert.equal(magnus.realProfile!.birthYear, 1990);
assert.equal(magnus.city, "Not recorded");
assert.equal(magnus.birthPlace, undefined);
assert.equal(
  upgradeNpcIdentities(real).find((n) => n.id === magnus.id)!.name,
  magnus.name,
);
const changed = applyNpcResult(magnus, "loss", 2800);
assert(changed.currentElo < magnus.currentElo);
assert.equal(
  applyWorldState([changed], {
    year: 2026,
    week: 10,
    alternateHistory: false,
  })[0].currentElo,
  changed.currentElo,
);
useNpcStore.setState({
  npcs: real,
  careerId: realCareer.id,
  startYear: 2026,
  playerDatabase: "real",
  status: "ready",
});
await useNpcStore
  .getState()
  .ensureLocalPool(realCareer.id, "TH", "Bangkok", 2026);
assert.equal(useNpcStore.getState().npcs.length, 20000);
await useNpcStore
  .getState()
  .syncWorld({ year: 2027, week: 1, alternateHistory: false });
assert.equal(
  useNpcStore.getState().npcs.length,
  20000,
  "Real mode never adds invented recruits",
);
const historical = buildCareerWorld(
  createCareerRecord({ ...options, startYear: 2025, playerDatabase: "real" }),
);
assert.equal(historical.length, 82);
assert(historical.every((n) => n.kind === "legend"));
for (const mode of ["small", "real"] as const) {
  const opts = { ...options, playerDatabase: mode },
    career = createCareerRecord(opts),
    world = mode === "real" ? real : small;
  const backup = await createBackup(createNewSave(opts, career), world);
  const restored = await parseBackup(JSON.stringify(backup));
  assert.equal(restored.payload.save.career.playerDatabase, mode);
  assert.equal(restored.payload.npcs.length, world.length);
}
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
  },
  configurable: true,
});
assert.equal(creationEstimate("small", 2026).learned, false);
rememberCreationTime("small", 2026, 2000);
rememberCreationTime("small", 2026, 4000);
assert.deepEqual(creationEstimate("small", 2026), {
  lower: 1,
  upper: 6,
  learned: true,
});
assert.equal(creationEstimate("real", 2025).learned, false);
rememberCreationTime("real", 2026, 10000);
assert.equal(creationEstimate("real", 2025).learned, false);
assert.equal(creationEstimate("real", 2026).learned, true);
storage.set("chess-career-creation-times-v1", "broken");
assert.equal(creationEstimate("small", 2026).learned, false);
console.log(
  "PASS: all sizes/counts/progress, domestic diversity/fields, FIDE facts/identities, persistent ratings, real-only population, backup modes and device timing.",
);
console.log(
  "Cloud generation-only timings (ms), not a phone speed guarantee:",
  JSON.stringify(timings),
);
