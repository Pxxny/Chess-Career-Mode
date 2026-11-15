import { achievementCatalog } from "@/game/career/achievements";
import { Card, CardTitle, EmptyState } from '@/components/ui';
import { useSave } from '@/hooks/useGame';
import { newestFirst } from '@/game/history/createHistory';
import type { TrophyCategory } from '@/types';

export const TROPHY_CATEGORIES: Array<{ id: TrophyCategory; label: string; empty: string }> = [
  { id: 'tournament', label: 'Tournament wins', empty: 'Win a tournament to earn a trophy.' },
  { id: 'league', label: 'League achievements', empty: 'Rise into a higher league to earn one.' },
  { id: 'elo', label: 'Elo milestones', empty: 'Each 100 Elo you gain above your start is recorded.' },
  { id: 'title', label: 'Chess titles', empty: 'Titles are awarded as your peak Elo grows.' },
  { id: 'special', label: 'Special achievements', empty: 'Debuts, streaks and upsets are recorded here.' },
];

export function TrophiesTab() {
  const save = useSave(); const {history}=save; const catalog=achievementCatalog(save);
  return <div className="grid gap-4">
    {!history.trophies.length&&<Card><EmptyState title="Your first trophy awaits" description="Enter a local tournament and start your first title run."/></Card>}
    <Card data-testid="achievement-catalog"><details><summary className="cursor-pointer font-semibold">Career challenges · {catalog.filter(a=>a.earned).length} / {catalog.length}</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">{catalog.map(a=><div key={a.id} className={`rounded-xl p-3 ${a.earned?"bg-gold-500/15":"bg-navy-900"}`}><p className="font-semibold">{a.earned?"✓ ":""}{a.name}</p><p className="mt-1 text-xs text-ink-muted">{a.description}</p><progress className="mt-2 w-full accent-[var(--accent)]" value={Math.min(a.value,a.target)} max={a.target}/><p className="text-xs text-ink-muted">{Math.min(a.value,a.target)} / {a.target}</p></div>)}</div></details></Card>
    {TROPHY_CATEGORIES.filter(category=>history.trophies.some(t=>t.category===category.id)).map(({id,label})=><Card key={id}><CardTitle>{label}</CardTitle><ul className="divide-y divide-white/5">{history.trophies.filter(t=>t.category===id).reverse().sort(newestFirst).map(t=><li key={t.id} className="py-3"><p className="font-semibold text-gold-300">{t.name}</p><p className="text-xs text-ink-muted">{t.description}</p><p className="mt-1 text-xs text-ink-faint">{t.year} · W{t.week}</p></li>)}</ul></Card>)}
  </div>;
}
