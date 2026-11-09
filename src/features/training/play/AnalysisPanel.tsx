import { boardAnnotation } from "@/components/game/MoveAnnotation";
import { useMemo, useState } from "react";
import { Badge, Card, CardTitle, ProgressBar } from "@/components/ui";
import { labelOf } from "@/game/engine/analysis";
import type { GameState } from "@/game/chess/rules";
import { toFen } from "@/game/chess/board";
import type { FeedbackItem } from "@/game/play/feedback";
import type { GameAnalysisSummary, MoveLabel } from "@/types";
import { cn } from "@/utils/cn";
import { PositionBoard } from "../PositionBoard";
import type { AnalysisState } from "./useGameSession";

const LABEL_STYLE: Record<
  MoveLabel,
  { name: string; className: string; color: string }
> = {
  brilliant: { name: "Brilliant", className: "text-sky-300", color: "#7dd3fc" },
  book: { name: "Book", className: "text-sky-300", color: "#7dd3fc" },
  best: { name: "Best", className: "text-emerald-300", color: "#6ee7b7" },
  good: { name: "Good", className: "text-ink-muted", color: "#97a2b8" },
  inaccuracy: {
    name: "Inaccuracy",
    className: "text-yellow-300",
    color: "#fde047",
  },
  mistake: { name: "Mistake", className: "text-orange-400", color: "#fb923c" },
  blunder: { name: "Blunder", className: "text-red-400", color: "#f87171" },
};

const fmtEval = (cp: number): string =>
  Math.abs(cp) >= 1500
    ? cp > 0
      ? "+M"
      : "-M"
    : `${cp >= 0 ? "+" : ""}${(cp / 100).toFixed(1)}`;

/** Evaluation over the game, white's point of view. Click a point to look at that position. */
function EvalGraph({
  evals,
  labels,
  selected,
  onSelect,
}: {
  evals: number[];
  labels: MoveLabel[];
  selected: number;
  onSelect: (ply: number) => void;
}) {
  const W = 600;
  const H = 120;
  const n = Math.max(1, evals.length - 1);
  const x = (i: number): number => (i / n) * W;
  const y = (cp: number): number =>
    H / 2 - (Math.max(-800, Math.min(800, cp)) / 800) * (H / 2 - 4);
  const line = evals
    .map(
      (e, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(e).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${W},${H / 2} L0,${H / 2} Z`;
  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Evaluation graph over ${n} half-moves. Final evaluation ${fmtEval(evals[evals.length - 1] ?? 0)} for White.`}
        className="w-full overflow-hidden rounded-lg bg-navy-900"
      >
        <path d={area} fill="#e8ebf2" opacity="0.14" />
        <line
          x1="0"
          x2={W}
          y1={H / 2}
          y2={H / 2}
          stroke="#68738a"
          strokeDasharray="3 3"
        />
        <path d={line} fill="none" stroke="#e5c166" strokeWidth="2" />
        {labels.map((l, i) =>
          l === "mistake" || l === "blunder" ? (
            <circle
              key={i}
              cx={x(i + 1)}
              cy={y(evals[i + 1] ?? 0)}
              r="3.5"
              fill={LABEL_STYLE[l].color}
            />
          ) : null,
        )}
        <line
          x1={x(selected)}
          x2={x(selected)}
          y1="0"
          y2={H}
          stroke="#e5c166"
          strokeWidth="1"
          opacity="0.7"
        />
        {/* wide invisible hit areas for clicking */}
        {evals.map((_, i) => (
          <rect
            key={i}
            x={x(i) - W / n / 2}
            y="0"
            width={Math.max(6, W / n)}
            height={H}
            fill="transparent"
            className="cursor-pointer"
            onClick={() => onSelect(i)}
          />
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px] text-ink-faint">
        <span>White better ↑</span>
        <span>Dots mark mistakes and blunders</span>
        <span>Black better ↓</span>
      </figcaption>
    </figure>
  );
}

interface Props {
  game: GameState;
  analysis: AnalysisState | { status: "done"; data: GameAnalysisSummary };
  feedback: FeedbackItem[];
  color: "white" | "black";
}

/** Review of a finished game: board you can step through, evaluation graph, move labels, key moments and advice. */
export function AnalysisPanel({ game, analysis, feedback, color }: Props) {
  const [ply, setPly] = useState(game.ucis.length);
  const data = analysis.status === "done" ? analysis.data : null;
  const labels = useMemo(
    () => (data ? data.labels.split("").map((l) => labelOf(l)) : []),
    [data],
  );
  const position = game.positions[Math.min(ply, game.positions.length - 1)];
  const counts = useMemo(() => {
    const own = {
      white: {} as Record<string, number>,
      black: {} as Record<string, number>,
    };
    labels.forEach((l, i) => {
      const side = game.positions[i].turn === "w" ? "white" : "black";
      own[side][l] = (own[side][l] ?? 0) + 1;
    });
    return own;
  }, [labels, game.positions]);
  const moments = useMemo(() => {
    if (!data) return [];
    const withLoss = (
      data as Partial<{
        keyMoments: Array<{
          ply: number;
          san: string;
          label: MoveLabel;
          color: string;
          loss: number;
          betterSan: string | null;
        }>;
      }>
    ).keyMoments;
    if (withLoss) return withLoss.slice(0, 6);
    return labels
      .flatMap((l, i) =>
        l === "mistake" || l === "blunder"
          ? [
              {
                ply: i + 1,
                san: game.sans[i],
                label: l,
                color: game.positions[i].turn === "w" ? "white" : "black",
                loss: 0,
                betterSan: null as string | null,
              },
            ]
          : [],
      )
      .slice(0, 6);
  }, [data, labels, game.sans, game.positions]);

  return (
    <Card className="mt-4">
      <CardTitle
        aside={
          data ? (
            <Badge>
              {data.engine} · depth {data.depth}
            </Badge>
          ) : undefined
        }
      >
        Game analysis
      </CardTitle>

      {analysis.status === "running" && (
        <div aria-live="polite" className="mb-4">
          <p className="mb-1 text-sm text-ink-muted">
            Analysing move {analysis.done} of {analysis.total}…
          </p>
          <ProgressBar
            value={(analysis.done / Math.max(1, analysis.total)) * 100}
            label="Analysis progress"
          />
        </div>
      )}
      {analysis.status === "error" && (
        <p className="mb-4 text-sm text-red-300">
          The analysis could not finish: {analysis.message}
        </p>
      )}
      {analysis.status === "idle" && (
        <p className="mb-4 text-sm text-ink-muted">
          This game was too short to analyse.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div>
          <PositionBoard
            annotation={boardAnnotation(game.moves[ply - 1], labels[ply - 1])}
            fen={toFen(position)}
            perspective={color}
            label={`Position after ${ply} half-moves`}
          />
          <div className="mt-2 flex items-center justify-center gap-2">
            {[
              ["⏮", "First position", () => setPly(0)],
              ["◀", "Previous move", () => setPly(Math.max(0, ply - 1))],
              [
                "▶",
                "Next move",
                () => setPly(Math.min(game.ucis.length, ply + 1)),
              ],
              ["⏭", "Last position", () => setPly(game.ucis.length)],
            ].map(([glyph, label, fn]) => (
              <button
                key={label as string}
                type="button"
                aria-label={label as string}
                onClick={fn as () => void}
                className="h-10 w-10 rounded-lg border border-white/10 bg-navy-700 text-ink hover:bg-navy-600"
              >
                {glyph as string}
              </button>
            ))}
          </div>
          <p className="mt-1 text-center text-xs text-ink-muted">
            {ply === 0
              ? "Start position"
              : `After ${game.positions[ply - 1].fullmove}${game.positions[ply - 1].turn === "w" ? "." : "..."} ${game.sans[ply - 1]}${data ? ` · ${fmtEval(data.evals[ply] ?? 0)}` : ""}`}
          </p>
        </div>

        <div>
          {data && (
            <EvalGraph
              evals={data.evals}
              labels={labels}
              selected={ply}
              onSelect={setPly}
            />
          )}
          {data && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {(["white", "black"] as const).map((side) => (
                <div
                  key={side}
                  className={cn(
                    "rounded-lg border p-3",
                    side === color
                      ? "border-gold-500/40 bg-gold-500/5"
                      : "border-white/10",
                  )}
                >
                  <p className="text-xs uppercase tracking-wide text-ink-muted">
                    {side === color ? `You (${side})` : `Opponent (${side})`}
                  </p>
                  <p className="font-display text-2xl font-bold tabular-nums text-ink">
                    {Math.round(
                      side === "white"
                        ? data.whiteAccuracy
                        : data.blackAccuracy,
                    )}
                    %
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {(
                      [
                        "brilliant",
                        "best",
                        "good",
                        "inaccuracy",
                        "mistake",
                        "blunder",
                      ] as MoveLabel[]
                    ).map((l) => (
                      <span
                        key={l}
                        className={cn(
                          "mr-2 inline-block",
                          LABEL_STYLE[l].className,
                        )}
                      >
                        {counts[side][l] ?? 0}{" "}
                        {LABEL_STYLE[l].name.toLowerCase()}
                      </span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {data && (
        <ol
          className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm"
          aria-label="Moves with their judgement"
        >
          {game.sans.map((san, i) => (
            <li key={i} className="inline-flex items-baseline gap-1">
              {(game.positions[i].turn === "w" || i === 0) && (
                <span className="text-ink-faint">
                  {game.positions[i].fullmove}
                  {game.positions[i].turn === "w" ? "." : "..."}
                </span>
              )}
              <button
                type="button"
                onClick={() => setPly(i + 1)}
                className={cn(
                  "rounded px-1 font-semibold hover:bg-white/10",
                  LABEL_STYLE[labels[i] ?? "good"].className,
                  ply === i + 1 && "bg-white/10 ring-1 ring-gold-500/60",
                )}
                title={LABEL_STYLE[labels[i] ?? "good"].name}
              >
                {san}
                {labels[i] === "brilliant"
                  ? "!!"
                  : labels[i] === "blunder"
                    ? "??"
                    : labels[i] === "mistake"
                      ? "?"
                      : labels[i] === "inaccuracy"
                        ? "?!"
                        : ""}
              </button>
            </li>
          ))}
        </ol>
      )}

      {moments.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-bold text-ink">Key moments</h3>
          <ul className="space-y-1.5 text-sm">
            {moments.map((m) => (
              <li key={m.ply}>
                <button
                  type="button"
                  onClick={() => setPly(m.ply)}
                  className="text-left hover:underline"
                >
                  <span
                    className={cn(
                      "font-semibold",
                      LABEL_STYLE[m.label].className,
                    )}
                  >
                    {LABEL_STYLE[m.label].name}
                  </span>{" "}
                  <span className="text-ink">
                    {game.positions[m.ply - 1].fullmove}
                    {game.positions[m.ply - 1].turn === "w" ? "." : "..."}{" "}
                    {m.san}
                  </span>{" "}
                  <span className="text-ink-muted">
                    ({m.color === color ? "you" : "opponent"}
                    {m.loss ? `, −${Math.round(m.loss)}` : ""}
                    {m.betterSan ? `, better: ${m.betterSan}` : ""})
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-bold text-ink">Feedback</h3>
          <ul className="space-y-2">
            {feedback.map((f, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-lg border-l-4 bg-navy-900 px-3 py-2 text-sm",
                  f.tone === "good"
                    ? "border-emerald-400"
                    : f.tone === "warn"
                      ? "border-orange-400"
                      : "border-sky-400",
                )}
              >
                <p className="font-semibold text-ink">{f.title}</p>
                <p className="text-ink-muted">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
