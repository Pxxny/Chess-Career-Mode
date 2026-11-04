import { useMemo, useState } from 'react';
import { Badge, Card, CardTitle } from '@/components/ui';
import { bookMoves, OPENING_BOOK, OPENING_FAMILIES } from '@/data/chess/openingBook';
import { positionAfter } from '@/game/training/positions';
import { toFen } from '@/game/chess/board';
import { cn } from '@/utils/cn';
import { normalizeText } from '@/utils/text';
import { PositionBoard } from './PositionBoard';

const norm = (s: string): string => normalizeText(s).replace('defense', 'defence');

export function OpeningsTab() {
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('all');
  const [side, setSide] = useState<'all' | 'white' | 'black'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [plies, setPlies] = useState(0);

  const list = useMemo(
    () =>
      OPENING_BOOK.filter(
        (o) => (family === 'all' || o.family === family) && (side === 'all' || o.side === side) && (!query || [o.name, o.eco, o.family, ...(o.aliases ?? [])].some((t) => norm(t).includes(norm(query)))),
      ),
    [query, family, side],
  );
  const selected = OPENING_BOOK.find((o) => o.id === openId) ?? null;
  const moves = selected ? bookMoves(selected) : [];
  const fen = selected ? toFen(positionAfter(selected.id, plies) ?? positionAfter(selected.id, 0)!) : '';

  return (
    <>
      <Card className="mb-4">
        <CardTitle aside={<Badge>{list.length} of {OPENING_BOOK.length}</Badge>}>Opening database</CardTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-sm font-semibold text-ink">
            Search
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, ECO or family" className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-navy-700 px-3 text-ink" />
          </label>
          <label className="text-sm font-semibold text-ink">
            Family
            <select value={family} onChange={(e) => setFamily(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-navy-700 px-3 text-ink">
              <option value="all">All</option>
              {OPENING_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink">
            Side
            <select value={side} onChange={(e) => setSide(e.target.value as typeof side)} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-navy-700 px-3 text-ink">
              <option value="all">Both</option>
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
          </label>
        </div>
      </Card>

      {selected && (
        <Card className="mb-4">
          <CardTitle aside={<Badge tone="gold">{selected.eco}</Badge>}>{selected.name}</CardTitle>
          <PositionBoard fen={fen} label={`${selected.name} after ${plies} half-moves`} />
          <div className="mt-3">
            <label className="text-sm text-ink-muted" htmlFor="ply">
              Move {plies} of {moves.length}
            </label>
            <input id="ply" type="range" min={0} max={moves.length} value={plies} onChange={(e) => setPlies(Number(e.target.value))} className="w-full accent-gold-500" />
          </div>
          <ol className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted">
            {moves.map((m, i) => (
              <li key={`${i}-${m}`}>
                <button type="button" onClick={() => setPlies(i + 1)} className={cn('rounded px-1', plies === i + 1 && 'bg-gold-500/20 text-gold-300')}>
                  {i % 2 === 0 ? `${i / 2 + 1}.` : ''}
                  {m}
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-ink-faint">Train this line with Thematic Games in the Sessions tab.</p>
        </Card>
      )}

      <Card>
        {list.length === 0 ? (
          <p className="text-sm text-ink-muted">No opening matches your search.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {list.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(o.id);
                    setPlies(Math.min(6, bookMoves(o).length));
                  }}
                  aria-pressed={openId === o.id}
                  className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{o.name}</span>
                    <span className="block text-xs text-ink-muted">
                      {o.family} · {o.side} · {o.styles.join(', ')}
                    </span>
                  </span>
                  <Badge>{o.eco}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
