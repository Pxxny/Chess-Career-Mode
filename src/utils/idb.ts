import { temporaryCareer } from "./temporaryCareer";
import { beginMeasurement } from "@/diagnostics/performance";
const DB_NAME = "chess-career-mode";
const DB_VERSION = 7;

export const STORES = {
  keyval: "keyval",
  matchArchive: "matchArchive",
  npcs: "npcs",
  meta: "meta",
  openingData: "openingData",
  careerNpcs: "careerNpcs",
  tournamentArchive: "tournamentArchive",
  /** Compact match references. Full boards stay in the tournament or match archive. */
  matchIndex: "matchIndex",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (temporaryCareer) return Promise.reject(new Error("Browser storage is disabled in a temporary career."));
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let abandoned = false;
    const fail = (error: unknown) => {
      if (abandoned) return;
      abandoned = true;
      clearTimeout(timeout);
      reject(error);
    };
    const timeout = setTimeout(() => fail(new Error("Browser storage is taking too long to respond.")), 15000);
    request.onblocked = () => fail(new Error("Close other tabs or installed windows of this game, then reload."));
    request.onupgradeneeded = () => {
      if (abandoned) { request.transaction?.abort(); return; }
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.keyval))
        db.createObjectStore(STORES.keyval);
      if (!db.objectStoreNames.contains(STORES.npcs))
        db.createObjectStore(STORES.npcs, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORES.meta))
        db.createObjectStore(STORES.meta);
      if (!db.objectStoreNames.contains(STORES.openingData))
        db.createObjectStore(STORES.openingData);
      if (!db.objectStoreNames.contains(STORES.tournamentArchive))
        db.createObjectStore(STORES.tournamentArchive, { keyPath: "key" });
      if (!db.objectStoreNames.contains(STORES.matchArchive))
        db.createObjectStore(STORES.matchArchive, { keyPath: "key" });
      // One NPC world per character: records are keyed `<career id>|<npc id>`.
      if (!db.objectStoreNames.contains(STORES.careerNpcs))
        db.createObjectStore(STORES.careerNpcs, { keyPath: "key" });
      if (!db.objectStoreNames.contains(STORES.matchIndex)) {
        const index = db.createObjectStore(STORES.matchIndex, { keyPath: "key" });
        index.createIndex("byCareer", "careerId");
        index.createIndex("byNpc", ["careerId", "npcId", "day", "key"]);
        index.createIndex("byEvent", ["careerId", "eventId", "round", "key"]);
        index.createIndex("byMatch", ["careerId", "matchId"]);
        index.createIndex("byH2H", ["careerId", "npcId", "opponentId", "day", "key"]);
      }
    };
    request.onsuccess = () => {
      if (abandoned) {
        request.result.close();
        return;
      }
      clearTimeout(timeout);
      request.result.onversionchange = () => {
        request.result.close();
        dbPromise = null;
      };
      resolve(request.result);
    };
    request.onerror = () => fail(request.error);
  }).catch(error => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

/** Runs `work` in one transaction and resolves with its request result once the transaction commits. */
export async function transact<T = undefined>(
  storeNames: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => IDBRequest<T> | void,
  options?: { timeoutMs: number },
): Promise<T | undefined> {
  const measured = beginMeasurement(
    mode === "readonly" ? "storage.read" : "storage.write",
  );
  let status = "error";
  try {
    const db = await openDb();
    const result = await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);
      const request = work(tx);
      const timer = options && setTimeout(() => {
        reject(new Error("Saved careers are taking too long to read or save. Try again."));
        // Stop this request so a later retry cannot race a pending migration write.
        try { tx.abort(); } catch { /* Already completed or aborted. */ }
      }, options.timeoutMs);
      const finish = () => clearTimeout(timer);
      tx.oncomplete = () => {
        finish();
        resolve(request ? request.result : undefined);
      };
      const fail = () => {
        finish();
        reject(tx.error ?? new Error("Browser storage could not complete the request."));
      };
      tx.onerror = fail;
      tx.onabort = fail;
    });
    status = "ok";
    return result;
  } finally {
    measured({ stores: storeNames.join(","), status });
  }
}
