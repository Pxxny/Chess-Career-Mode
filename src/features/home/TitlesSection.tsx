import { Check, Lock } from "lucide-react";
import { Badge, Card, CardTitle, ProgressBar } from "@/components/ui";
import type { TitleStatus } from "@/game/career/titles";
import { cn } from "@/utils/cn";

export function TitlesSection({ titles }: { titles: TitleStatus }) {
  return (
    <Card className="mb-4">
      <CardTitle
        aside={
          titles.earned.length ? (
            <Badge tone="gold">{titles.earned.length} earned</Badge>
          ) : undefined
        }
      >
        Chess titles
      </CardTitle>
      <p className="text-sm text-ink-muted">Current career title</p>
      <p className="mb-3 text-xs text-ink-muted">
        Simplified career requirements; existing earned titles are kept.
      </p>
      <p className="font-display text-2xl font-bold text-gold-400">
        {titles.currentLabel}
      </p>

      <div className="mt-4">
        {titles.next ? (
          <>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-ink-muted">
                Progress to {titles.next.label}
              </span>
              <span className="tabular-nums text-ink">
                {Math.round(titles.percent)}%
              </span>
            </div>
            <ProgressBar
              value={titles.percent}
              label={`Progress to ${titles.next.label}`}
            />
            <p className="mt-2 text-sm text-ink-muted">
              {titles.pointsToNext} more peak Elo points needed (
              {titles.next.minElo}).
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-muted">You hold the highest title.</p>
        )}
      </div>

      <ul className="mt-4 divide-y divide-white/5">
        {titles.requirements.map((r) => (
          <li
            key={r.id}
            className={cn(
              "flex items-center justify-between gap-3 py-2.5",
              !r.earned && "opacity-70",
            )}
          >
            <div className="min-w-0">
              <p className="font-semibold text-ink">{r.label}</p>
              <p className="text-xs text-ink-muted">{r.requirement}</p>
            </div>
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 text-xs font-semibold",
                r.earned ? "text-emerald-300" : "text-ink-faint",
              )}
            >
              {r.earned ? (
                <Check size={14} aria-hidden />
              ) : (
                <Lock size={14} aria-hidden />
              )}
              {r.earned ? "Earned" : "Locked"}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
