/**
 * Sim-jank fix: during Simulate Season each day's NPC calendar work is resumed across browser tasks
 * (time-sliced) instead of blocking the main thread. Where the day yields must not change anything:
 * yielding after every step (budget 0) must give exactly the state of never yielding (the original
 * blocking day), with and without Pause -> reload -> Resume.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";

const VOLATILE = new Set(["timing", "wallMs", "searchMs", "roundTripMs", "runMs", "gameMs", "lastGameMs", "createdAt", "avatarSeed", "startedAt", "committedAt", "updatedAt", "at"]);
const norm = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) if (!VOLATILE.has(k)) o[k] = norm((v as Record<string, unknown>)[k]);
    return o;
  }
  return v;
};

type Mods = {
  G: typeof import("@/store/gameStore");
  N: typeof import("@/store/npcStore");
  J: typeof import("@/store/simulationJournal");
};
async function load(): Promise<Mods> {
  const G = await import("@/store/gameStore");
  const N = await import("@/store/npcStore");
  const J = await import("@/store/simulationJournal");
  await import("@/game/match/chessjs");
  return { G, N, J };
}
async function idle(m: Mods) {
  for (let i = 0; i < 20000; i++) {
    const s = m.G.useGameStore.getState().save;
    if (!m.J.simulationPending() && !m.J.simulationActive() && !s?.tournamentArchivePending?.length && !s?.matchArchivePending?.length) break;
    await new Promise((r) => setTimeout(r, 5));
  }
  await new Promise((r) => setTimeout(r, 50));
}

/** Simulates (reading news as a player would) until the season day `until`, then pauses. */
async function simulateTo(m: Mods, until: number) {
  const { seasonOf } = await import("@/game/career/seasonSimulation");
  const { highlightsOf } = await import("@/game/career/highlights");
  for (let g = 0; g < 500; g++) {
    const unsub = m.G.useGameStore.subscribe((st) => {
      const s = seasonOf(st.save!);
      if (s && s.days >= until && st.seasonRunning) m.G.useGameStore.getState().cancelCalendar();
    });
    const r = await m.G.useGameStore.getState().simulateSeason("balanced", []);
    unsub();
    const save = m.G.useGameStore.getState().save!;
    const unread = highlightsOf(save).unread;
    if ((seasonOf(save)?.days ?? 0) >= until || seasonOf(save)?.status === "completed") break;
    if (unread.length) for (const id of unread) m.G.useGameStore.getState().readArticle(id);
    else if (!r.ok) throw new Error(r.error);
  }
  await idle(m);
}

async function state(m: Mods) {
  const { upgradeSave } = await import("@/game/training/migrate");
  const save = upgradeSave(m.G.useGameStore.getState().save!);
  return {
    // The ordered NPC array below covers roster order, including on an in-memory save.
    save: norm({ ...save, npcOrder: undefined, tournamentArchivePending: undefined, matchArchivePending: undefined }),
    npcs: norm(m.N.useNpcStore.getState().npcs), // includes list order
  };
}

async function run(careerId: string, pauses: number[], end: number, budgetMs: number) {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
  const orig = globalThis.crypto.randomUUID.bind(globalThis.crypto);
  let pinned = false;
  vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => {
    if (pinned) return orig();
    pinned = true;
    return careerId as `${string}-${string}-${string}-${string}-${string}`;
  });
  let m = await load();
  m.G.setDaySliceBudget(budgetMs);
  const S = await import("@/store/saveSlots");
  const { startCareer } = await import("@/features/creation/startCareer");
  const { DEFAULT_APPEARANCE } = await import("@/data/appearance");
  await S.slotManager.init();
  await startCareer({ name: "Bench", gender: "male", countryCode: "TH", city: { name: "Bangkok", custom: false }, archetype: "balanced", appearance: DEFAULT_APPEARANCE, startYear: 2026, alternateHistory: false, playerDatabase: "small" } as never, 1);
  await idle(m);
  for (const p of pauses) {
    await simulateTo(m, p);
    // Reload: the page is gone; everything comes back from IndexedDB.
    vi.resetModules();
    m = await load();
    m.G.setDaySliceBudget(budgetMs);
    for (let i = 0; i < 2000 && !m.G.useGameStore.persist.hasHydrated(); i++) await new Promise((r) => setTimeout(r, 5));
    const save = m.G.useGameStore.getState().save!;
    await m.N.useNpcStore.getState().loadDatabase(save.career, save.npcOrder);
    await m.N.useNpcStore.getState().syncWorld({ ...save.world.date, alternateHistory: save.world.alternateHistory ?? false });
    await idle(m);
  }
  await simulateTo(m, end);
  vi.restoreAllMocks();
  return state(m);
}

describe("time-sliced season days are deterministic", () => {
  for (const seed of ["slice-seed-a", "slice-seed-b"])
    it(`career ${seed}: yield after every step == never yield (and with a reload)`, async () => {
      const blocking = await run(seed, [], 40, Infinity);
      const sliced = await run(seed, [], 40, 0);
      expect(sliced.npcs).toEqual(blocking.npcs);
      expect(sliced.save).toEqual(blocking.save);
      const reloaded = await run(seed, [13], 40, 0);
      expect(reloaded.npcs).toEqual(blocking.npcs);
      expect(reloaded.save).toEqual(blocking.save);
    }, 900_000);
});
