import { z } from "zod";
import { highlightsSchema } from "@/game/career/highlights";
import { readMatchArchive, mergeMatches, matchKey } from "./matchArchive";
import { seasonOf } from "@/game/career/seasonSimulation";
import { readEventArchive, archiveKey } from "./tournamentArchive";
import {
  retainedArchives,
  type ArchivedEvent,
} from "@/game/competition/archive";
import { GAME_CONFIG } from "@/data/config";
import { validDatabaseSize } from "@/game/npc/playerDatabase";
import { upgradeSave } from "@/game/training/migrate";
import type { GameSave, Npc, MatchRecord } from "@/types";
import { openDb, STORES } from "@/utils/idb";
import { metaFor } from "./npcRepository";

export const BACKUP_LIMIT = 64 * 1024 * 1024;
export interface CareerBackup {
  format: "chess-career-mode-backup";
  version: 1;
  exportedAt: string;
  payload: {
    save: GameSave;
    npcs: Npc[];
    tournamentArchive?: ArchivedEvent[];
    matchArchive?: MatchRecord[];
  };
  checksum: string;
}
const fail = (): never => {
  throw new Error("This backup is damaged or has an unsupported format.");
};
const object = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0;
async function checksum(payload: CareerBackup["payload"]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export async function createBackup(
  save: GameSave,
  npcs: Npc[],
): Promise<CareerBackup> {
  if (!npcs.length)
    throw new Error("Wait for the NPC world to finish loading.");
  const archived = await readEventArchive(save.career.id);
  const matches = mergeMatches(
    await readMatchArchive(save.career.id),
    save.matchArchivePending ?? [],
    save.matches,
  );
  const archive = new Map(
    [...archived, ...retainedArchives(save)].map((e) => [e.id, e]),
  );
  const payload = structuredClone({
    save,
    npcs,
    ...(matches.length ? { matchArchive: matches } : {}),
    ...(archive.size ? { tournamentArchive: [...archive.values()] } : {}),
  });
  return {
    format: "chess-career-mode-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    payload,
    checksum: await checksum(payload),
  };
}
export async function parseBackup(raw: string): Promise<CareerBackup> {
  if (new TextEncoder().encode(raw).length > BACKUP_LIMIT) fail();
  let value: any;
  try {
    value = JSON.parse(raw, (key, v) =>
      ["__proto__", "constructor", "prototype"].includes(key) ? undefined : v,
    );
  } catch {
    fail();
  }
  if (
    !object(value) ||
    value.format !== "chess-career-mode-backup" ||
    value.version !== 1 ||
    !object(value.payload) ||
    !text(value.checksum)
  )
    fail();
  if (!z.object({ format: z.literal("chess-career-mode-backup"), version: z.literal(1),
    payload: z.object({ save: z.object({}).passthrough(), npcs: z.array(z.unknown()) }).passthrough(),
    checksum: z.string().min(1) }).passthrough().safeParse(value).success) fail();
  const { save, npcs } = value.payload;
  if (save.highlights !== undefined && !highlightsSchema.safeParse(save.highlights).success) fail();
  if (
    value.payload.matchArchive !== undefined &&
    (!Array.isArray(value.payload.matchArchive) ||
      value.payload.matchArchive.some(
        (m: unknown) =>
          !object(m) ||
          !text(m.id) ||
          !Array.isArray(m.moves) ||
          !object(m.setup) ||
          !text(m.result),
      ))
  )
    fail();
  if (save?.seasonSimulation !== undefined && !seasonOf(save)) fail();
  if (
    save?.career?.playerDatabase !== undefined &&
    !validDatabaseSize(save.career.playerDatabase)
  )
    fail();
  if (
    value.payload.tournamentArchive !== undefined &&
    (!Array.isArray(value.payload.tournamentArchive) ||
      value.payload.tournamentArchive.some(
        (e: unknown) =>
          !object(e) ||
          !text(e.id) ||
          !Number.isInteger(e.year) ||
          !Array.isArray(e.players) ||
          !Array.isArray(e.pairings),
      ))
  )
    fail();
  if (
    !object(save) ||
    save.version !== GAME_CONFIG.saveVersion ||
    !object(save.career) ||
    !object(save.player) ||
    !object(save.world) ||
    !object(save.history)
  )
    fail();
  if (
    !text(save.career.id) ||
    !text(save.career.databaseKey) ||
    !finite(save.career.startYear) ||
    !text(save.career.countryCode) ||
    !object(save.career.city) ||
    !text(save.career.city.name)
  )
    fail();
  if (
    !text(save.player.name) ||
    !text(save.player.country) ||
    !finite(save.player.rating) ||
    !finite(save.player.ratedGames) ||
    !object(save.player.skills) ||
    !object(save.player.ap) ||
    !object(save.player.city)
  )
    fail();
  if (
    !object(save.world.date) ||
    !Number.isInteger(save.world.date.year) ||
    !Number.isInteger(save.world.date.week) ||
    save.world.date.week < 1 ||
    save.world.date.week > 52 ||
    !finite(save.world.seed)
  )
    fail();
  for (const key of [
    "games",
    "tournaments",
    "trophies",
    "news",
    "training",
    "sessions",
    "ledger",
    "titles",
    "ratingHistory",
  ])
    if (!Array.isArray(save.history[key])) fail();
  for (const key of ["training", "practice", "repertoire"])
    if (!object(save[key])) fail();
  if (
    !Array.isArray(save.registrations) ||
    !Array.isArray(save.matches) ||
    !Array.isArray(npcs) ||
    npcs.length < 1 ||
    npcs.length > 100000
  )
    fail();
  const ids = new Set<string>();
  for (const npc of npcs) {
    if (
      !object(npc) ||
      !text(npc.id) ||
      !text(npc.name) ||
      !text(npc.nationality) ||
      !finite(npc.currentElo) ||
      !Array.isArray(npc.tournamentHistory) ||
      ids.has(npc.id)
    )
      fail();
    ids.add(npc.id);
  }
  for (const game of save.history.games)
    if (
      !object(game) ||
      !text(game.id) ||
      !["win", "draw", "loss"].includes(game.outcome) ||
      !["white", "black"].includes(game.color) ||
      !finite(game.accuracy)
    )
      fail();
  if (
    (await checksum(value.payload as CareerBackup["payload"])) !==
    value.checksum
  )
    fail();
  return value as unknown as CareerBackup;
}
/** Atomic restore into an empty slot, with a new career storage identity to keep copies independent. */
export async function restoreBackup(
  backup: CareerBackup,
  slot: number,
): Promise<void> {
  if (!Number.isInteger(slot) || slot < 1 || slot > GAME_CONFIG.saveSlots)
    throw new Error("Choose an empty character slot.");
  const validated = await parseBackup(JSON.stringify(backup));
  const save = upgradeSave(structuredClone(validated.payload.save));
  const oldId = save.career.id;
  const id = crypto.randomUUID();
  save.career = {
    ...save.career,
    id,
    databaseKey: save.career.databaseKey.replace(oldId, id),
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      [
        STORES.keyval,
        STORES.careerNpcs,
        STORES.meta,
        STORES.tournamentArchive,
        STORES.matchArchive,
      ],
      "readwrite",
    );
    let issue: Error | null = null;
    const key = `${GAME_CONFIG.saveKey}-slot-${slot}`;
    const read = tx.objectStore(STORES.keyval).get(key);
    read.onsuccess = () => {
      if (read.result !== undefined) {
        issue = new Error("Choose an empty character slot.");
        tx.abort();
        return;
      }
      tx.objectStore(STORES.keyval).put(
        JSON.stringify({ state: { save }, version: GAME_CONFIG.saveVersion }),
        key,
      );
      for (const match of mergeMatches(
        validated.payload.matchArchive ?? [],
        save.matchArchivePending ?? [],
        save.matches,
      ))
        tx.objectStore(STORES.matchArchive).put({
          key: matchKey(id, match.id),
          match,
        });
      for (const npc of validated.payload.npcs)
        tx.objectStore(STORES.careerNpcs).put({ key: `${id}|${npc.id}`, npc });
      tx.objectStore(STORES.meta).put(metaFor(save.career), `npc-db:${id}`);
      for (const event of validated.payload.tournamentArchive ?? [])
        tx.objectStore(STORES.tournamentArchive).put({
          key: archiveKey(id, event),
          event,
        });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () =>
      reject(
        issue ?? tx.error ?? new Error("The backup could not be restored."),
      );
  });
}
export function downloadBackup(backup: CareerBackup) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `Chess-Career-Mode-Backup-${backup.payload.save.world.date.year}-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
