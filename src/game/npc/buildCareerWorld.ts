import type { CareerRecord, Npc } from "@/types";
import { buildWorldNpcs } from "./buildWorldNpcs";
import { buildLegendNpcs } from "./legends";
import { localCompetitors } from "./localPool";
import { upgradeNpcIdentities } from "./identity";
import {
  fictionalCountFor,
  realOnly,
  type CreationProgress,
} from "./playerDatabase";
import { fideNpcs, FIDE_SNAPSHOT_YEAR, type FideDataset } from "./fidePlayers";
import { applyWorldState } from "./worldState";
export async function buildCareerWorldAsync(
  career: CareerRecord,
  progress?: (value: CreationProgress) => void,
): Promise<Npc[]> {
  if (realOnly(career) && career.startYear === FIDE_SNAPSHOT_YEAR) {
    progress?.({ phase: "building", done: 0, total: 20000 });
    const base =
      (import.meta as unknown as { env?: { BASE_URL?: string } }).env
        ?.BASE_URL ?? "/";
    const response = await fetch(`${base}data/fide/players-2026-11.json`);
    if (!response.ok)
      throw new Error("Could not load the FIDE player snapshot.");
    const data = (await response.json()) as FideDataset;
    return applyWorldState(
      fideNpcs(data, (done, total) =>
        progress?.({ phase: "building", done, total }),
      ),
      { year: career.startYear, week: 1, alternateHistory: false },
    );
  }
  return buildCareerWorld(career, progress);
}
export function buildCareerWorld(
  career: CareerRecord,
  progress?: (value: CreationProgress) => void,
): Npc[] {
  if (realOnly(career)) {
    const npcs = buildWorldNpcs(career.startYear, 0);
    progress?.({ phase: "building", done: npcs.length, total: npcs.length });
    return npcs;
  }
  const legends = buildLegendNpcs().length,
    count = fictionalCountFor(career),
    total = count + legends + 80;
  progress?.({ phase: "building", done: 0, total });
  const world = buildWorldNpcs(career.startYear, count, (done) =>
    progress?.({ phase: "building", done: done + legends, total }),
  );
  const npcs = upgradeNpcIdentities([
    ...world,
    ...localCompetitors(career.countryCode, career.city.name, career.startYear),
  ]);
  progress?.({ phase: "building", done: npcs.length, total: npcs.length });
  return npcs;
}
