import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';

/** True once the save has been read from IndexedDB. */
export function useStoreHydration(): boolean {
  const [hydrated, setHydrated] = useState(() => useGameStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useGameStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useGameStore.persist.hasHydrated());
    return unsubscribe;
  }, []);

  return hydrated;
}
