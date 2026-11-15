import { StatDelta } from './StatDelta';
import { Coins } from 'lucide-react';
import { formatMoney } from '@/utils/format';

export function MoneyChip({ amount }: { amount: number }) {
  return (
    <div
      role="img"
      aria-label={`Money: ${formatMoney(amount)}`}
      className="relative flex items-center gap-2 rounded-full bg-navy-700 px-3 py-1.5"
    >
      <StatDelta value={amount} format={formatMoney} />
      <Coins size={14} aria-hidden className="text-gold-400" />
      <span className="text-sm font-semibold tabular-nums text-ink">{formatMoney(amount)}</span>
    </div>
  );
}
