import { Award, Handshake, History, Mail, Medal, Swords, TrendingUp, Trophy, type LucideIcon } from 'lucide-react';
import { Card, CardTitle, EmptyState } from '@/components/ui';
import type { NewsItem, NewsKind } from '@/types';

const ICONS: Record<NewsKind, LucideIcon> = {
  invitation: Mail,
  title: Award,
  ranking: TrendingUp,
  rivalry: Swords,
  promotion: Medal,
  sponsorship: Handshake,
  history: History,
  milestone: Trophy,
};

const LIMIT = 8;

export function NewsSection({ news }: { news: NewsItem[] }) {
  const shown = news.slice(0, LIMIT);
  return (
    <Card className="mb-4">
      <CardTitle>Career news</CardTitle>
      {shown.length === 0 ? (
        <EmptyState title="Nothing to report" description="Invitations, titles, promotions and offers will show up here." />
      ) : (
        <ul className="divide-y divide-white/5">
          {shown.map((item) => {
            const Icon = ICONS[item.kind];
            return (
              <li key={item.id} className="flex gap-3 py-3">
                <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-gold-500" />
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{item.headline}</p>
                  {item.detail && <p className="text-sm text-ink-muted">{item.detail}</p>}
                  <p className="mt-0.5 text-xs text-ink-faint">
                    Year {item.year}, week {item.week}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
