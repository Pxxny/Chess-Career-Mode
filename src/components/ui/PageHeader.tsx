import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, eyebrow, description, action }: PageHeaderProps) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gold-300">{eyebrow}</p>}
        <h1 className="break-words font-display text-3xl font-medium text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-ink-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}
