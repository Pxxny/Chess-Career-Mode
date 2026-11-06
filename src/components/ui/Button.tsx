import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'danger';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary: 'bg-gold-500 text-navy-950 hover:bg-gold-400',
  secondary: 'border border-white/10 bg-navy-700 text-ink hover:bg-navy-600',
  danger: 'border border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/20',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({ variant = 'primary', className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={cn(base, variants[variant], className)} {...rest}>
      {children}
    </button>
  );
}

interface ButtonLinkProps {
  to: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({ to, variant = 'primary', className, children }: ButtonLinkProps) {
  return (
    <Link to={to} className={cn(base, variants[variant], className)}>
      {children}
    </Link>
  );
}
