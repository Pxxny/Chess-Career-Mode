import { useEffect, useState } from 'react';
import { useOpeningDb, useOpeningStore } from '@/store/openingStore';
import { cn } from '@/utils/cn';
import { BrowseOpenings } from './openings/BrowseOpenings';
import { ImportPanel } from './openings/ImportPanel';
import { Performance } from './openings/Performance';
import { Preferences } from './openings/Preferences';

const VIEWS = [
  { id: 'browse', label: 'Browse' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'performance', label: 'Performance' },
  { id: 'import', label: 'Import' },
] as const;
type ViewId = (typeof VIEWS)[number]['id'];

export function OpeningsTab() {
  const db = useOpeningDb();
  const load = useOpeningStore((s) => s.load);
  const [view, setView] = useState<ViewId>('browse');
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <div role="group" aria-label="Opening tools" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)} className={cn('min-h-12 rounded-xl border px-3 text-sm font-semibold', view === v.id ? 'border-gold-500 bg-gold-500/10 text-gold-300' : 'border-white/10 bg-navy-800 text-ink-muted hover:text-ink')}>
            {v.label}
          </button>
        ))}
      </div>
      {view === 'browse' && <BrowseOpenings db={db} />}
      {view === 'preferences' && <Preferences db={db} />}
      {view === 'performance' && <Performance db={db} />}
      {view === 'import' && <ImportPanel />}
    </>
  );
}
