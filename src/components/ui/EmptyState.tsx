import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      <div className="mt-4 flex justify-center">{action ?? <Link to="/complete" className="inline-flex min-h-11 items-center rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950">Find a tournament</Link>}</div>
    </div>
  );
}
