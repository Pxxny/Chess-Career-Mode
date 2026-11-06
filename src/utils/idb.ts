const DB_NAME = 'chess-career-mode';
const DB_VERSION = 3;

export const STORES = { keyval: 'keyval', npcs: 'npcs', meta: 'meta', openingData: 'openingData' } as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.keyval)) db.createObjectStore(STORES.keyval);
      if (!db.objectStoreNames.contains(STORES.npcs)) db.createObjectStore(STORES.npcs, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.meta)) db.createObjectStore(STORES.meta);
      if (!db.objectStoreNames.contains(STORES.openingData)) db.createObjectStore(STORES.openingData);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

/** Runs `work` in one transaction and resolves with its request result once the transaction commits. */
export async function transact<T = undefined>(
  storeNames: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const request = work(tx);
    tx.oncomplete = () => resolve(request ? request.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
