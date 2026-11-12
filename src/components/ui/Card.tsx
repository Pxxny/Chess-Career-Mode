import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <section className={cn('surface-card min-w-0 rounded-2xl border border-white/[0.07] bg-navy-800 p-5 sm:p-6', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
      <h2 className="min-w-0 break-words font-display text-lg font-bold text-ink">{children}</h2>
      {aside}
    </div>
  );
}
