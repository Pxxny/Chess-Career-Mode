import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-ink-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}
