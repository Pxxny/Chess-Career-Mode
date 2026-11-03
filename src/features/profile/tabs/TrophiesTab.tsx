import { Card, CardTitle } from '@/components/ui';
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
  const { history } = useSave();
  return (
    <div className="grid gap-4">
      {TROPHY_CATEGORIES.map(({ id, label, empty }) => {
        const trophies = history.trophies.filter((t) => t.category === id).reverse().sort(newestFirst);
        return (
          <Card key={id}>
            <CardTitle aside={<span className="text-sm tabular-nums text-ink-muted">{trophies.length}</span>}>{label}</CardTitle>
            {trophies.length === 0 ? (
              <p className="text-sm text-ink-muted">{empty}</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {trophies.map((t) => (
                  <li key={t.id} className="py-2.5">
                    <p className="font-semibold text-ink">{t.name}</p>
                    <p className="text-sm text-ink-muted">{t.description}</p>
                    <p className="text-xs text-ink-faint">
                      Year {t.year}, week {t.week}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
