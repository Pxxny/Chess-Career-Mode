import assert from "node:assert/strict";
import { randomAppearance } from "../src/data/appearance.ts";
import { createCareerRecord } from "../src/game/career/createCareer.ts";
import { createNewSave } from "../src/game/createNewSave.ts";
import {
  recordGame,
  withGameAccuracy,
} from "../src/game/history/recordGame.ts";
import { computeStats } from "../src/game/history/stats.ts";
import { upgradeSave } from "../src/game/training/migrate.ts";
import { createBackup, parseBackup } from "../src/store/backup.ts";
import { buildWorldNpcs } from "../src/game/npc/buildWorldNpcs.ts";
const options = {
  name: "Lifetime QA",
  gender: "male" as const,
  countryCode: "TH",
  city: { name: "Bangkok", custom: false },
  archetype: "balanced" as const,
  appearance: randomAppearance(),
  startYear: 2026,
  alternateHistory: false,
};
let save = createNewSave(options, createCareerRecord(options));
const initial = structuredClone(save);
for (let i = 0; i < 1104; i++)
  save = recordGame(save, {
    opponentId: null,
    opponentName: "QA",
    opponentElo: 1000,
    outcome: (["win", "draw", "loss"] as const)[i % 3],
    color: i % 2 ? "black" : "white",
    accuracy: i === 1103 ? null : 80,
    tournamentId: i % 2 ? "event" : null,
  });
assert.equal(save.history.games.length, 1000);
assert.equal(save.player.ratedGames, 1104);
assert.equal(
  new Set(save.history.games.map((g) => g.id)).size,
  1000,
  "IDs stay unique after pruning",
);
const stats = computeStats(save.history);
assert.equal(stats.total.games, 1104);
assert.equal(stats.total.wins, 368);
assert.equal(stats.total.draws, 368);
assert.equal(stats.total.losses, 368);
assert.equal(stats.total.winRate, 50);
assert.equal(stats.white.games, 552);
assert.equal(stats.black.games, 552);
assert.equal(stats.tournament.games, 552);
assert.equal(stats.averageAccuracy, 80);
const id = save.history.games.at(-1)!.id;
save = withGameAccuracy(save, id, 100);
assert.equal(save.history.lifetime!.analysedGames, 1104);
const totals = structuredClone(save.history.lifetime);
save = withGameAccuracy(save, id, 100);
assert.deepEqual(save.history.lifetime, totals);
save = upgradeSave(JSON.parse(JSON.stringify(save)));
assert.equal(computeStats(save.history).total.games, 1104);
const legacy = structuredClone(save);
delete legacy.history.lifetime;
assert.equal(
  computeStats(upgradeSave(legacy).history).total.games,
  1000,
  "Legacy missing outcomes are not invented",
);
const npcs = buildWorldNpcs(2026).slice(0, 2);
npcs[0].currentElo += 17;
npcs[0].tournamentHistory.push({
  year: 2026,
  event: "Backup QA",
  rank: 1,
  fieldSize: 12,
});
const backup = await createBackup(save, npcs);
const parsed = await parseBackup(JSON.stringify(backup));
assert.deepEqual(parsed.payload, { save, npcs });
const corrupt = structuredClone(backup);
corrupt.payload.save.player.money++;
await assert.rejects(() => parseBackup(JSON.stringify(corrupt)), /damaged/);
await assert.rejects(() => parseBackup("{no"), /damaged/);
await assert.rejects(
  () => parseBackup(JSON.stringify({ ...backup, version: 2 })),
  /damaged/,
);
await assert.rejects(
  () =>
    parseBackup(
      JSON.stringify({ ...backup, payload: { ...backup.payload, npcs: [] } }),
    ),
  /damaged/,
);
assert.equal(initial.history.games.length, 0);
console.log(
  "PASS 1,104 games beyond retention, exact W/D/L and score rate, unique IDs, pending/repeated analysis, reload, honest legacy baseline and full NPC backup/checksum roundtrip.",
);
