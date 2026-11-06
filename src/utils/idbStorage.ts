import type { StateStorage } from 'zustand/middleware';
import { STORES, transact } from './idb';

/** Zustand-compatible storage adapter backed by IndexedDB. */
export const idbStorage: StateStorage = {
  getItem: async (name) =>
    (await transact<string>([STORES.keyval], 'readonly', (tx) => tx.objectStore(STORES.keyval).get(name))) ?? null,
  setItem: async (name, value) => {
    await transact([STORES.keyval], 'readwrite', (tx) => tx.objectStore(STORES.keyval).put(value, name));
  },
  removeItem: async (name) => {
    await transact([STORES.keyval], 'readwrite', (tx) => tx.objectStore(STORES.keyval).delete(name));
  },
};
