import { highlightsOf } from "@/game/career/highlights";
import { useState } from "react";
import { Badge, Card, CardTitle, Modal } from "@/components/ui";
import { useGameStore } from "@/store/gameStore";
import type { YearReview } from "@/game/career/yearReview";
import { formatMoney } from "@/utils/format";
import { STAT_LABELS } from "@/data/stats";

const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;
function ReviewDetails({ review: r }: { review: YearReview }) {
  const games = r.rated.wins + r.rated.draws + r.rated.losses;
  const practice = r.practice.wins + r.practice.draws + r.practice.losses;
  const rows: [string, string][] = [
    [
      "Career Elo",
      `${r.startRating} → ${r.endRating} (${signed(r.endRating - r.startRating)})`,
    ],
    ["Peak Elo this year", String(r.peakRating)],
    [
      "Rated games",
      `${games} · ${r.rated.wins}W ${r.rated.draws}D ${r.rated.losses}L`,
    ],
    [
      "Score rate",
      games
        ? `${(((r.rated.wins + r.rated.draws / 2) / games) * 100).toFixed(1)}%`
        : "No rated games",
    ],
    [
      "Draw rate",
      games
        ? `${((r.rated.draws / games) * 100).toFixed(1)}%`
        : "No rated games",
    ],
    [
      "Tournaments completed",
      `${r.tournaments + r.esportsTournaments} · ${r.tournaments} traditional, ${r.esportsTournaments} esports`,
    ],
    [
      "Tournament wins / podiums",
      `${r.tournamentWins + r.esportsWins} / ${r.podiums + r.esportsPodiums}`,
    ],
    [
      "Practice games",
      `${practice} · ${r.practice.wins}W ${r.practice.draws}D ${r.practice.losses}L`,
    ],
    ["Training sessions", String(r.sessions)],
    [
      "Cash change",
      `${formatMoney(r.endMoney - r.startMoney)} · balance ${formatMoney(r.endMoney)}`,
    ],
    ["Reputation change", signed(r.endReputation - r.startReputation)],
    ["New trophies", String(r.trophies)],
    ["Titles earned", r.titles.join(", ") || "None"],
  ];
  return (
    <>
      {r.coverage === "retained" && (
        <p className="mb-3 text-sm text-ink-muted">
          This year began before annual tracking was installed. Game and
          tournament totals use retained history; cash, reputation and skill
          changes start when tracking began.
        </p>
      )}
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-lg bg-navy-700/60 p-3">
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd className="mt-1 break-words text-sm font-semibold tabular-nums text-ink">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm font-semibold text-ink">Skill improvements</p>
      <p className="mt-1 text-sm text-ink-muted">
        {r.improvements.length
          ? r.improvements
              .map(
                (s) =>
                  `${STAT_LABELS[s.stat as keyof typeof STAT_LABELS] ?? s.stat} ${signed(s.change)}`,
              )
              .join(" · ")
          : "No skill changes recorded."}
      </p>
    </>
  );
}
export function YearReviewDialog() {
  const importantNews = useGameStore((s) => s.save ? highlightsOf(s.save).unread.length : 0);
  const state = useGameStore((s) => s.save?.yearReview);
  const running = useGameStore((s) => s.calendarProgress);
  const dismiss = useGameStore((s) => s.dismissYearReview);
  const review = state?.reviews.find((r) => state.unread.includes(r.year));
  if (!review || running || importantNews) return null;
  return (
    <Modal
      open
      title={`${review.year} · Year in review`}
      onClose={() => dismiss(review.year)}
      size="lg"
    >
      <ReviewDetails review={review} />
      <button
        className="mt-5 rounded-lg bg-gold-500 px-4 py-2 font-semibold text-navy-950"
        onClick={() => dismiss(review.year)}
      >
        Continue to {review.year + 1}
      </button>
      <p className="mt-2 text-xs text-ink-faint">
        Saved under Career → Year in review.
      </p>
    </Modal>
  );
}
export function YearReviews() {
  const reviews = useGameStore((s) => s.save?.yearReview?.reviews) ?? [];
  const [year, setYear] = useState<number | null>(null);
  const review = reviews.find((r) => r.year === year) ?? reviews.at(-1);
  return (
    <Card className="mb-4">
      <CardTitle aside={<Badge>{reviews.length} completed years</Badge>}>
        Year in review
      </CardTitle>
      {review ? (
        <>
          <label className="mb-4 block text-sm text-ink-muted">
            Year
            <select
              aria-label="Review year"
              className="ml-3 rounded-lg bg-navy-800 p-2 text-ink"
              value={review.year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[...reviews].reverse().map((r) => (
                <option key={r.year} value={r.year}>
                  {r.year}
                </option>
              ))}
            </select>
          </label>
          <ReviewDetails review={review} />
        </>
      ) : (
        <p className="text-sm text-ink-muted">
          Your first annual summary appears after the last day of week 52. It
          will include Elo, tournaments, wins/draws/losses, practice, training
          and finances.
        </p>
      )}
    </Card>
  );
}
