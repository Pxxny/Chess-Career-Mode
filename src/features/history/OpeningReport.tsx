import { openingAnalytics } from "@/game/history/matchLedger";
import type { MatchRecord } from "@/types";
import { useMemo } from "react";

const pct = (value: number | null) =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;

/** Opening totals from stored games that contain moves. Result-only games are ignored. */
export function OpeningReport({
  matches,
  perspective = "player",
}: {
  matches: readonly MatchRecord[];
  perspective?: "player" | string;
}) {
  const report = useMemo(
    () => openingAnalytics(matches, perspective),
    [matches, perspective],
  );
  if (!report.replayGames)
    return (
      <p className="text-sm text-ink-muted">
        No recorded moves, so opening statistics are not available.
      </p>
    );
  return (
    <div>
      <p className="mb-2 text-xs text-ink-muted">
        Counted from {report.replayGames} games with real moves. Games scored
        without a board are excluded.
      </p>
      {report.lines.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Those games have moves, but no ECO was stored from the move list.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] text-sm">
          {report.lines.slice(0, 12).map((line) => (
            <li key={`${line.eco}|${line.name}`} className="py-2">
              <span className="font-semibold text-ink">
                {line.eco} {line.name}
              </span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                {line.games} games · {line.wins}W {line.draws}D {line.losses}L ·
                win rate {pct(line.wins / line.games)} · score{" "}
                {pct((line.wins + line.draws / 2) / line.games)} · white{" "}
                {line.whiteGames} · black {line.blackGames}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
