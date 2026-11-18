import type { ReactNode } from "react";
import { Card } from "@/components/ui";

export function EliteStats({ items }: { items: ReadonlyArray<readonly [string, ReactNode]> }) {
  return <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
    {items.map(([label, value]) => <div key={label} className="surface-card rounded-2xl border bg-navy-800 p-4 sm:p-5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-2 text-xl font-bold tabular-nums text-gold-300 sm:text-3xl">{value}</dd>
    </div>)}
  </dl>;
}

export function EliteHero({ title, label, children, artwork }: { title: string; label: ReactNode; children?: ReactNode; artwork?: ReactNode }) {
  return <Card className="elite-hero mb-5 flex flex-wrap items-center justify-between gap-4 sm:p-7">
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-widest text-gold-300">{label}</p>
      <h2 className="my-2 break-words font-display text-3xl sm:text-4xl" translate="no">{title}</h2>
      {children}
    </div>
    {artwork}
  </Card>;
}

export const eliteLink = "inline-flex min-h-11 items-center rounded-xl border border-gold-500/40 bg-gold-500 px-4 py-2 text-sm font-bold text-[#0b1220] transition hover:brightness-110";
