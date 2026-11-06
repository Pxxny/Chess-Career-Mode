import type { ReactNode } from 'react';

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
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
