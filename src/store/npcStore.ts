import { upgradeNpcIdentities } from "@/game/npc/identity";
import { localCompetitors, mergeNpcAdditions } from "@/game/npc/localPool";
import { GAME_CONFIG } from "@/data/config";
import { advancePopulation } from "@/game/npc/population";
import { buildLegendNpcs } from "@/game/npc/legends";
import { create } from "zustand";
import { buildWorldNpcs } from "@/game/npc/buildWorldNpcs";
import { applyWorldState, type WorldClock } from "@/game/npc/worldState";
import type { CareerRecord, Npc } from "@/types";
import {
  deleteNpcDatabase,
  isMetaCurrent,
  putNpcs,
  readNpcDatabase,
  writeNpcDatabase,
} from "./npcRepository";

interface NpcStore {
  status: "idle" | "loading" | "ready";
  /** Career whose NPC database is currently loaded */
  careerId: string | null;
  startYear: number;
  npcs: Npc[];
  /** Loads the NPC database of a career. It is built and saved only when missing or outdated. */
  ensureLocalPool: (
    careerId: string,
    country: string,
    city: string,
    year: number,
  ) => Promise<void>;
  loadDatabase: (career: CareerRecord) => Promise<void>;
  /** Rebuilds every NPC from the seed for a new career. */
  resetDatabase: (career: CareerRecord) => Promise<void>;
  /** Re-applies era, age, ranking and league rules for the current game date and mode. */
  syncWorld: (clock: WorldClock) => Promise<{ joined: Npc[]; retired: Npc[] }>;
  updateNpcs: (changed: Npc[]) => Promise<void>;
  /** Deletes the stored NPC world of a deleted character and forgets it when it is the one loaded. */
  forgetCareer: (careerId: string) => Promise<void>;
}

export const useNpcStore = create<NpcStore>()((set, get) => ({
  status: "idle",
  careerId: null,
  startYear: 0,
  npcs: [],

  ensureLocalPool: async (careerId, country, city, year) => {
    if (get().careerId !== careerId) return;
    const previous = get().npcs;
    const merged = mergeNpcAdditions(
      previous,
      localCompetitors(country, city, year),
    );
    if (merged.added.length) {
      const npcs = upgradeNpcIdentities(merged.npcs);
      set({ npcs });
      const before = new Map(previous.map((n) => [n.id, n]));
      await putNpcs(
        npcs.filter((n) => before.get(n.id) !== n),
        careerId,
      ).catch(() => undefined);
    }
  },
  loadDatabase: async (career) => {
    if (get().careerId === career.id && get().status !== "idle") return;
    set({
      status: "loading",
      careerId: career.id,
      startYear: career.startYear,
    });
    try {
      const stored = await readNpcDatabase(career);
      // The player may have switched characters while this one was loading.
      if (get().careerId !== career.id) return;
      const growing =
        stored.meta?.databaseKey === career.databaseKey &&
        stored.meta?.schemaVersion === GAME_CONFIG.world.npcDatabaseVersion &&
        stored.meta.fictionalCount < GAME_CONFIG.world.fictionalNpcCount;
      if (
        (growing || isMetaCurrent(stored.meta, career)) &&
        stored.npcs.length > 0
      ) {
        const grow =
          !!stored.meta &&
          stored.meta.fictionalCount < GAME_CONFIG.world.fictionalNpcCount;
        const candidates = [
          ...(grow ? buildWorldNpcs(career.startYear) : buildLegendNpcs()),
          ...localCompetitors(
            career.countryCode,
            career.city.name,
            career.startYear,
          ),
        ];
        const merged = mergeNpcAdditions(stored.npcs, candidates);
        const upgraded = upgradeNpcIdentities(merged.npcs);
        set({ npcs: upgraded, status: "ready" });
        if (grow)
          await writeNpcDatabase(upgraded, career).catch(() => undefined);
        else if (merged.added.length || upgraded !== merged.npcs) {
          const oldById = new Map(stored.npcs.map((n) => [n.id, n]));
          await putNpcs(
            upgraded.filter((n) => oldById.get(n.id) !== n),
            career.id,
          ).catch(() => undefined);
        }
        return;
      }
    } catch {
      // Storage unavailable: fall through and keep an in-memory world.
    }
    if (get().careerId !== career.id) return;
    const npcs = upgradeNpcIdentities([
      ...buildWorldNpcs(career.startYear),
      ...localCompetitors(
        career.countryCode,
        career.city.name,
        career.startYear,
      ),
    ]);
    set({ npcs, status: "ready" });
    await writeNpcDatabase(npcs, career).catch(() => undefined);
  },

  resetDatabase: async (career) => {
    const npcs = upgradeNpcIdentities([
      ...buildWorldNpcs(career.startYear),
      ...localCompetitors(
        career.countryCode,
        career.city.name,
        career.startYear,
      ),
    ]);
    set({
      npcs,
      status: "ready",
      careerId: career.id,
      startYear: career.startYear,
    });
    await writeNpcDatabase(npcs, career).catch(() => undefined);
  },

  syncWorld: async (clock) => {
    const previous = get().npcs;
    const careerId = get().careerId;
    const expanded = advancePopulation(previous, get().startYear, clock.year);
    const next = applyWorldState(expanded, clock);
    const oldById = new Map(previous.map((n) => [n.id, n]));
    const joined = next.filter((n) => !oldById.has(n.id));
    const retired = next.filter(
      (n) =>
        n.careerStatus === "retired" &&
        oldById.get(n.id)?.careerStatus !== "retired" &&
        oldById.has(n.id),
    );
    const changed = next.filter((npc, i) => npc !== previous[i]);
    if (changed.length) {
      set({ npcs: next });
      if (careerId) await putNpcs(changed, careerId).catch(() => undefined);
    }
    return { joined, retired };
  },

  updateNpcs: async (changed) => {
    const byId = new Map(changed.map((n) => [n.id, n]));
    set({ npcs: get().npcs.map((n) => byId.get(n.id) ?? n) });
    const careerId = get().careerId;
    if (careerId) await putNpcs(changed, careerId).catch(() => undefined);
  },

  forgetCareer: async (careerId) => {
    if (get().careerId === careerId)
      set({ status: "idle", careerId: null, npcs: [] });
    await deleteNpcDatabase(careerId).catch(() => undefined);
  },
}));
