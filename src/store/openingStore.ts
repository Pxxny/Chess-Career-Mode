import { create } from 'zustand';
import { buildOpeningDatabase, getBaseOpeningDatabase, type OpeningDatabase } from '@/game/openings/database';
import { mergeUsage } from '@/game/openings/pgn';
import type { CustomOpening, UsageStats } from '@/game/openings/types';
import { STORES, transact } from '@/utils/idb';

/**
 * Holds the opening database. The built-in ECO data is available at once; openings imported from PGN files
 * and counted game collections are stored in IndexedDB (not in the career save, because they can be large and
 * belong to the player, not to one career) and merged in when the app starts.
 */
interface OpeningStore {
  db: OpeningDatabase;
  status: 'idle' | 'loading' | 'ready';
  custom: CustomOpening[];
  usageBySource: Record<string, Record<string, UsageStats>>;
  /** Set when saving to the browser failed; the data then lives only until the page closes */
  storageError: string | null;
  load: () => Promise<void>;
  addCustom: (openings: CustomOpening[]) => Promise<void>;
  addCollection: (source: string, usage: Record<string, UsageStats>) => Promise<void>;
  removeSource: (source: string) => Promise<void>;
  clearImports: () => Promise<void>;
}

const get = <T,>(key: string): Promise<T | undefined> => transact<T>([STORES.openingData], 'readonly', (tx) => tx.objectStore(STORES.openingData).get(key) as IDBRequest<T>);

const rebuild = (custom: CustomOpening[], bySource: Record<string, Record<string, UsageStats>>): OpeningDatabase =>
  custom.length === 0 && Object.keys(bySource).length === 0 ? getBaseOpeningDatabase() : buildOpeningDatabase(custom, mergeUsage(bySource));

export const useOpeningStore = create<OpeningStore>()((set, getState) => {
  let loading: Promise<void> | null = null;
  let writes = Promise.resolve();
  const persist = async (custom: CustomOpening[], usageBySource: OpeningStore['usageBySource']): Promise<void> => {
    set({ custom, usageBySource, db: rebuild(custom, usageBySource) });
    try {
      // A source may contain both lines and statistics: commit both together.
      await transact([STORES.openingData], 'readwrite', (tx) => {
        const store = tx.objectStore(STORES.openingData);
        store.put(custom, 'custom');
        store.put(usageBySource, 'usage');
      });
      set({ storageError: null });
    } catch (error) {
      set({ storageError: error instanceof Error ? error.message : 'The browser would not save the imported data.' });
    }
  };
  const update = (change: (state: OpeningStore) => [CustomOpening[], OpeningStore['usageBySource']]): Promise<void> => {
    // Wait for hydration and serialize edits so a late read/write cannot undo an import.
    const next = writes.then(async () => {
      await getState().load();
      await persist(...change(getState()));
    });
    writes = next.catch(() => {});
    return next;
  };

  return {
    db: getBaseOpeningDatabase(),
    status: 'idle',
    custom: [],
    usageBySource: {},
    storageError: null,

    load: () => {
      if (loading) return loading;
      if (getState().status === 'ready') return Promise.resolve();
      set({ status: 'loading' });
      loading = (async () => {
        try {
          const [custom, usage] = await Promise.all([get<CustomOpening[]>('custom'), get<OpeningStore['usageBySource']>('usage')]);
          const c = custom ?? [];
          const u = usage ?? {};
          set({ custom: c, usageBySource: u, db: rebuild(c, u), status: 'ready' });
        } catch (error) {
          set({ status: 'ready', storageError: error instanceof Error ? error.message : 'Imported data could not be read.' });
        }
      })();
      return loading;
    },

    addCustom: (openings) => update((state) => [[...state.custom, ...openings], state.usageBySource]),

    addCollection: (source, usage) => update((state) => [state.custom, { ...state.usageBySource, [source]: usage }]),

    removeSource: (source) => update(({ custom, usageBySource }) => {
      const { [source]: _removed, ...rest } = usageBySource;
      return [
        custom.filter((c) => c.source !== source),
        rest,
      ];
    }),

    clearImports: () => update(() => [[], {}]),
  };
});

/** The current opening database. Re-renders when imports change it. */
export const useOpeningDb = (): OpeningDatabase => useOpeningStore((s) => s.db);
