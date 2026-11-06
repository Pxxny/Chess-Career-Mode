import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
}

export function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span>{label}</span>
        {Icon && <Icon size={16} aria-hidden className="text-gold-500" />}
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </Card>
  );
}
