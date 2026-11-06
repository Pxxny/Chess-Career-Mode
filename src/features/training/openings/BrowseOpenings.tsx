import { useMemo, useState } from 'react';
import { Badge, Card, CardTitle, EmptyState } from '@/components/ui';
import type { OpeningDatabase } from '@/game/openings/database';
import type { FamilyInfo } from '@/game/openings/types';
import { cn } from '@/utils/cn';
import { OpeningDetail } from './OpeningDetail';

const PAGE = 24;
type Sort = 'eco' | 'popularity' | 'difficulty' | 'name';

export function BrowseOpenings({ db }: { db: OpeningDatabase }) {
  const [query, setQuery] = useState('');
  const [letter, setLetter] = useState('all');
  const [side, setSide] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [sort, setSort] = useState<Sort>('popularity');
  const [limit, setLimit] = useState(PAGE);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [variationQuery, setVariationQuery] = useState('');

  const q = query.trim().toLowerCase();
  const families = useMemo(() => {
    const matchesEntries = new Set<string>();
    if (q) for (const e of db.entries) if (e.name.toLowerCase().includes(q) || e.eco.toLowerCase() === q || e.line.toLowerCase().includes(q)) matchesEntries.add(e.family);
    const list = db.families.filter((f) => {
      if (q && !matchesEntries.has(f.name)) return false;
      if (letter !== 'all' && !(f.ecoFrom[0] === letter || f.ecoTo[0] === letter || (f.ecoFrom[0] < letter && f.ecoTo[0] > letter))) return false;
      if (side !== 'all' && f.side !== side) return false;
      if (difficulty === 'easy' && f.difficulty > 2) return false;
      if (difficulty === 'medium' && f.difficulty !== 3) return false;
      if (difficulty === 'hard' && f.difficulty < 4) return false;
      return true;
    });
    const by: Record<Sort, (a: FamilyInfo, b: FamilyInfo) => number> = {
      eco: (a, b) => a.ecoFrom.localeCompare(b.ecoFrom),
      popularity: (a, b) => b.popularity - a.popularity || a.ecoFrom.localeCompare(b.ecoFrom),
      difficulty: (a, b) => a.difficulty - b.difficulty || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(by[sort]);
  }, [db, q, letter, side, difficulty, sort]);

  const family = familyName ? db.familyByName.get(familyName) ?? null : null;
  const variations = useMemo(() => {
    if (!family) return [];
    const vq = variationQuery.trim().toLowerCase();
    return family.entryIds.map((id) => db.byId.get(id)!).filter((e) => !vq || e.name.toLowerCase().includes(vq) || e.eco.toLowerCase() === vq);
  }, [db, family, variationQuery]);
  const entry = selected ? db.byId.get(selected) ?? null : family ? db.byId.get(family.rootId) ?? null : null;

  const control = 'min-h-11 rounded-lg border border-white/10 bg-navy-900 px-3 text-sm text-ink focus:border-gold-500 focus:outline-none';

  return (
    <>
      <Card className="mb-4">
        <CardTitle aside={<Badge tone="gold">{db.entries.length.toLocaleString()} openings · {db.families.length} families · {db.ecoCodes} ECO codes</Badge>}>Opening Repertoire Manager</CardTitle>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <label htmlFor="op-search" className="sr-only">Search openings</label>
            <input id="op-search" type="search" placeholder="Search name, ECO code (B90) or moves (e4 c5)" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} className={cn(control, 'w-full')} />
          </div>
          <select aria-label="ECO volume" className={control} value={letter} onChange={(e) => { setLetter(e.target.value); setLimit(PAGE); }}>
            <option value="all">All ECO (A–E)</option>
            {['A', 'B', 'C', 'D', 'E'].map((l) => <option key={l} value={l}>ECO {l}00–{l}99</option>)}
          </select>
          <select aria-label="Colour" className={control} value={side} onChange={(e) => { setSide(e.target.value); setLimit(PAGE); }}>
            <option value="all">Either colour</option><option value="white">White openings</option><option value="black">Black defences</option>
          </select>
          <select aria-label="Difficulty" className={control} value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setLimit(PAGE); }}>
            <option value="all">Any difficulty</option><option value="easy">Easy</option><option value="medium">Moderate</option><option value="hard">Hard</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <label htmlFor="op-sort">Sort by</label>
          <select id="op-sort" className={control} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="popularity">Popularity</option><option value="eco">ECO code</option><option value="difficulty">Difficulty</option><option value="name">Name</option>
          </select>
          <span aria-live="polite">{families.length} {families.length === 1 ? 'family' : 'families'}</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card className="max-h-[48rem] overflow-y-auto p-3">
          {families.length === 0 ? (
            <EmptyState title="No openings match" description="Try fewer filters or a different search." />
          ) : (
            <ul>
              {families.slice(0, limit).map((f) => (
                <li key={f.name}>
                  <button type="button" aria-pressed={familyName === f.name} onClick={() => { setFamilyName(f.name); setSelected(null); setVariationQuery(''); }} className={cn('flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left', familyName === f.name ? 'bg-gold-500/10' : 'hover:bg-white/5')}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{f.name}</span>
                      <span className="block text-xs text-ink-muted">{f.ecoFrom}–{f.ecoTo} · {f.entryIds.length} lines · {f.side === 'white' ? 'White' : 'Black'}</span>
                    </span>
                    <span className="text-xs tabular-nums text-ink-faint" title="Popularity out of 5">★{f.popularity}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {families.length > limit && <button type="button" onClick={() => setLimit(limit + PAGE)} className="mt-2 w-full rounded-lg border border-white/10 py-2 text-sm font-semibold text-ink-muted hover:text-ink">Show more ({families.length - limit} left)</button>}
        </Card>

        <div className="min-w-0 space-y-4">
          {!family || !entry ? (
            <Card><EmptyState title="Pick an opening family" description="Choose a family on the left to see its lines, variations, history and a board you can step through." /></Card>
          ) : (
            <>
              <OpeningDetail db={db} entry={entry} onSelect={setSelected} />
              <Card>
                <CardTitle aside={<Badge>{family.entryIds.length} lines</Badge>}>{family.name}: all variations</CardTitle>
                <label htmlFor="var-search" className="sr-only">Search within this family</label>
                <input id="var-search" type="search" placeholder="Search within this family" value={variationQuery} onChange={(e) => setVariationQuery(e.target.value)} className={cn(control, 'mb-2 w-full')} />
                <ul className="max-h-80 overflow-y-auto" aria-label="Variations">
                  {variations.slice(0, 120).map((v) => {
                    const depth = db.path(v.id).length - 1;
                    return (
                      <li key={v.id}>
                        <button type="button" aria-current={entry.id === v.id} onClick={() => setSelected(v.id)} style={{ paddingLeft: `${0.5 + Math.min(depth, 6) * 0.9}rem` }} className={cn('flex w-full items-baseline gap-2 rounded py-1 pr-2 text-left text-sm', entry.id === v.id ? 'bg-gold-500/10 text-gold-300' : 'text-ink hover:bg-white/5')}>
                          <span className="shrink-0 font-mono text-xs text-ink-faint">{v.eco}</span>
                          <span className="min-w-0 flex-1 truncate">{v.variation ?? 'Main line'}{v.isMainLine ? ' ★' : ''}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {variations.length > 120 && <p className="mt-1 text-xs text-ink-faint">Showing 120 of {variations.length}. Narrow the search to see the rest.</p>}
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
