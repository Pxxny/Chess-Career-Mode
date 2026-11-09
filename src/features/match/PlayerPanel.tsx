import { ChessPiece } from "@/components/game/ChessPiece";
import { Bot, User } from "lucide-react";
import { formatClockText } from "@/game/match/timeControls";
import type { MatchSide, PieceColor } from "@/types";
import { cn } from "@/utils/cn";

interface Props {
  side: MatchSide;
  color: PieceColor;
  /** Milliseconds left, Infinity without a clock */
  remaining: number;
  active: boolean;
  controller: "human" | "auto";
  thinking: boolean;
  ratingChange?: number | null;
}

/** One player's card: name, title, rating, nationality, who controls the side, and the clock. */
export function PlayerPanel({
  side,
  color,
  remaining,
  active,
  controller,
  thinking,
  ratingChange,
}: Props) {
  const low = Number.isFinite(remaining) && remaining < 20000;
  const title = side.title !== "none" ? side.title : "";
  return (
    <div
      data-testid={`player-${color}`}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border bg-navy-800 px-3 py-2",
        active ? "border-gold-500/60" : "border-white/[0.06]",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg",
            color === "white"
              ? "bg-stone-200 text-black"
              : "bg-charcoal-900 text-white ring-1 ring-white/20",
          )}
        >
          <ChessPiece piece={color === "white" ? "K" : "k"} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">
            {title && (
              <span className="mr-1.5 rounded bg-gold-500/20 px-1.5 py-0.5 text-xs font-bold text-gold-300">
                {title}
              </span>
            )}
            <span translate="no">{side.name}</span>
          </p>
          <p className="truncate text-xs text-ink-muted">
            {side.flag && (
              <span aria-hidden className="mr-1">
                {side.flag}
              </span>
            )}
            {side.nationality || "Unknown"} ·{" "}
            <span className="font-semibold text-ink">
              {Math.round(side.elo)}
            </span>{" "}
            Elo
            {ratingChange != null && ratingChange !== 0 && (
              <span
                className={
                  ratingChange > 0
                    ? " ml-1 text-emerald-300"
                    : " ml-1 text-red-300"
                }
              >
                {ratingChange > 0 ? "+" : ""}
                {ratingChange}
              </span>
            )}
          </p>
          <p className="flex items-center gap-1 text-[0.7rem] text-ink-faint">
            {controller === "human" ? (
              <User className="h-3 w-3" aria-hidden />
            ) : (
              <Bot className="h-3 w-3" aria-hidden />
            )}
            {controller === "human"
              ? "You are moving"
              : thinking
                ? "Thinking…"
                : "Simulated"}
          </p>
        </div>
      </div>
      <div
        role="timer"
        aria-label={`${color} clock`}
        data-testid={`clock-${color}`}
        className={cn(
          "min-w-[5.5rem] rounded-lg px-3 py-1.5 text-center font-mono text-xl font-bold tabular-nums",
          active ? "bg-gold-500 text-navy-950" : "bg-navy-900 text-ink-muted",
          low && active && "bg-red-500 text-white",
        )}
      >
        {Number.isFinite(remaining) ? formatClockText(remaining) : "∞"}
      </div>
    </div>
  );
}
