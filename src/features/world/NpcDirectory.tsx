import { useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { TIERS } from '@/data/chess/tiers';
import { getCountry } from '@/data/world/countries';
import { useNpcs } from '@/hooks/useNpcs';
import type { Npc, SkillTier } from '@/types';
import { normalizeText } from '@/utils/text';
import { NpcProfileModal } from './NpcProfileModal';
import { NpcTable } from './NpcTable';

const PAGE_SIZE = 20;

export function NpcDirectory() {
  const npcs = useNpcs();
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<SkillTier | 'all'>('all');
  const [includeUnranked, setIncludeUnranked] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Npc | null>(null);

  const results = useMemo(() => {
    const q = normalizeText(query);
    return npcs
      .filter((n) => includeUnranked || n.worldRank !== null)
      .filter((n) => tier === 'all' || n.tier === tier)
      .filter(
        (n) =>
          !q ||
          normalizeText(n.name).includes(q) ||
          normalizeText(n.city).includes(q) ||
          normalizeText(getCountry(n.nationality)?.name ?? '').includes(q),
      )
      .sort((a, b) => (a.worldRank ?? 1e9) - (b.worldRank ?? 1e9) || b.currentElo - a.currentElo);
  }, [npcs, query, tier, includeUnranked]);

  const field = 'rounded-lg border border-white/10 bg-navy-900 px-3 py-2.5 text-sm text-ink outline-none focus:border-gold-500';

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="search"
          aria-label="Search players by name, city or country"
          placeholder="Search by name, city or country"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setVisible(PAGE_SIZE); }}
          className={field}
        />
        <select
          aria-label="Filter by tier"
          value={tier}
          onChange={(e) => { setTier(e.target.value as SkillTier | 'all'); setVisible(PAGE_SIZE); }}
          className={field}
        >
          <option value="all">All tiers</option>
          {TIERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>
      <label className="mb-4 flex items-center gap-2 text-sm text-ink-muted">
        <input type="checkbox" checked={includeUnranked} onChange={(e) => setIncludeUnranked(e.target.checked)} className="h-4 w-4 accent-[#d4a94a]" />
        Include retired and historical players
      </label>

      <p className="mb-2 text-sm text-ink-faint" aria-live="polite">{results.length} players</p>
      <NpcTable npcs={results.slice(0, visible)} showRank onSelect={setSelected} />
      {visible < results.length && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>Show more players</Button>
        </div>
      )}
      <NpcProfileModal npc={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
