import { MatchComparison } from "./MatchComparison";
import { useId } from "react";
import { Badge, Card, CardTitle } from "@/components/ui";
import { displayPercentages } from "@/game/prediction/model";
import type { PredictionSnapshot } from "@/game/prediction/types";
import type { GameOutcome } from "@/types";

const attributeLabel = (key: unknown): string =>
  ({
    peakElo: "Peak Elo",
    form: "Current form",
    morale: "Morale",
    fatigue: "Fatigue",
    preparation: "Preparation quality",
    openingFamiliarity: "Opening familiarity",
    tactics: "Tactics",
    calculation: "Calculation",
    opening: "Opening knowledge",
    positional: "Positional understanding",
    endgame: "Endgame technique",
    visualization: "Visualization",
    timeManagement: "Time management",
    concentration: "Concentration",
    mental: "Mental toughness",
  })[String(key)] ?? String(key);

export function PredictionSummary({
  prediction,
  actual,
}: {
  prediction?: Pick<PredictionSnapshot, "adjusted">;
  actual?: GameOutcome;
}) {
  if (!prediction)
    return (
      <span className="text-xs text-ink-faint">
        No pre-match prediction recorded.
      </span>
    );
  const [w, d, l] = displayPercentages(prediction.adjusted);
  return (
    <span
      className="block text-xs tabular-nums text-ink-muted"
      data-testid="prediction-summary"
    >
      Before game: <span className="text-emerald-300">W {w.toFixed(2)}%</span> ·{" "}
      <span className="text-amber-300">D {d.toFixed(2)}%</span> ·{" "}
      <span className="text-red-300">L {l.toFixed(2)}%</span>
      {actual ? ` · Actual: ${actual}` : ""}
    </span>
  );
}
export function PredictionPanel({
  prediction: p,
  actual,
  compact = false,
  preview = false,
}: {
  prediction: PredictionSnapshot;
  actual?: GameOutcome;
  compact?: boolean;
  preview?: boolean;
}) {
  const titleId = useId();
  const values = displayPercentages(p.adjusted),
    base = displayPercentages(p.baseline);
  const outcomes = [
    { label: "Win", color: "bg-emerald-500", text: "text-emerald-300" },
    { label: "Draw", color: "bg-amber-400", text: "text-amber-300" },
    { label: "Loss", color: "bg-red-500", text: "text-red-300" },
  ];
  return (
    <Card
      className="mb-4"
      data-testid="match-prediction"
      aria-labelledby={titleId}
    >
      <CardTitle
        aside={<Badge>{preview ? "Preview" : "Recorded before play"}</Badge>}
      >
        <span id={titleId}>Match prediction</span>
      </CardTitle>
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-ink-faint">
            Player
          </p>
          <p className="break-words font-semibold text-ink">
            <span translate="no">{p.player.name}</span>
          </p>
          <p className="text-sm tabular-nums text-ink-muted">
            Elo {p.player.elo}
          </p>
        </div>
        <span className="text-xs font-bold text-ink-faint">VS</span>
        <div className="min-w-0 text-right">
          <p className="text-xs uppercase tracking-wide text-ink-faint">
            Opponent
          </p>
          <p className="break-words font-semibold text-ink">
            <span translate="no">{p.opponent.name}</span>
          </p>
          <p className="text-sm tabular-nums text-ink-muted">
            Elo {p.opponent.elo}
          </p>
        </div>
      </div>
      <div className="space-y-3" aria-label="Predicted outcome">
        {outcomes.map((o, i) => (
          <div key={o.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className={o.text}>{o.label}</span>
              <span
                className="font-semibold tabular-nums text-ink"
                data-testid={`probability-${o.label.toLowerCase()}`}
              >
                {values[i].toFixed(2)}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`${o.label} probability`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={values[i]}
              className="h-2.5 overflow-hidden rounded-full bg-navy-900"
            >
              <div
                className={`h-full rounded-full ${o.color}`}
                style={{ width: `${values[i]}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[
          [
            "Elo difference",
            `${p.eloDifference >= 0 ? "+" : ""}${p.eloDifference}`,
          ],
          ["Match classification", p.classification],
          ["Expected score", `${(p.adjusted.expected * 100).toFixed(2)}%`],
          ["Confidence", p.confidence],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-ink-faint">{label}</dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {(!compact || preview) && <MatchComparison prediction={p} />}
      {actual && (
        <p
          className="mt-4 rounded-lg bg-navy-900 p-3 text-sm text-ink"
          data-testid="prediction-actual"
        >
          Actual result:{" "}
          <strong
            className={
              actual === "win"
                ? "text-emerald-300"
                : actual === "loss"
                  ? "text-red-300"
                  : "text-ink-muted"
            }
          >
            {actual.toUpperCase()}
          </strong>
          . Original probability of this outcome:{" "}
          {(p.adjusted[actual] * 100).toFixed(2)}%.
        </p>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        {p.support.games.toLocaleString()} relevant historical games ·{" "}
        {p.support.played.toLocaleString()} played by an engine/human ·{" "}
        {p.support.simulated.toLocaleString()} abstract simulations.{" "}
        {p.support.games < p.config.historyMin
          ? "Using the baseline draw prior for sparse groups."
          : "Smoothed historical draw calibration."}
      </p>
      {!compact && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-gold-300">
            Model, conditions & factors
          </summary>
          <div className="mt-3 space-y-3 text-xs text-ink-muted">
            <p>
              Raw Elo expected score:{" "}
              <strong className="text-ink">
                {(p.baseline.expected * 100).toFixed(2)}%
              </strong>{" "}
              = win + ½ draw. Elo baseline W/D/L:{" "}
              {base.map((n) => `${n.toFixed(2)}%`).join(" / ")}. Context
              adjustment: {p.modifierElo >= 0 ? "+" : ""}
              {p.modifierElo.toFixed(1)} Elo (cap ±{p.config.maxAdjustment}).
            </p>
            <p>
              {p.conditions.color === "unknown"
                ? "Colour unknown"
                : `Playing ${p.conditions.color}`}{" "}
              · {p.conditions.timeControl} ·{" "}
              {p.conditions.tournamentName ?? p.conditions.tournamentType}.
              Opening{" "}
              {p.conditions.opening === "unknown"
                ? "not known before play"
                : `planned: ${p.conditions.opening}`}
              . Pressure {(p.conditions.pressure * 100).toFixed(0)}% ·
              importance {(p.conditions.importance * 100).toFixed(0)}%.
            </p>
            <table className="w-full text-left">
              <caption className="sr-only">
                Context factors in Elo points
              </caption>
              <thead>
                <tr>
                  <th className="pb-1">Factor</th>
                  <th className="pb-1 text-right">Adjustment</th>
                </tr>
              </thead>
              <tbody>
                {p.factors.map((f) => (
                  <tr key={f.name}>
                    <td className="py-1">{f.name}</td>
                    <td className="text-right tabular-nums">
                      {f.elo >= 0 ? "+" : ""}
                      {f.elo.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <caption className="sr-only">
                  Attributes recorded before the match
                </caption>
                <thead>
                  <tr>
                    <th>Attribute</th>
                    <th className="text-right">Player</th>
                    <th className="text-right">Opponent</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...Object.keys(p.player.skills ?? {}).map((key) => [
                      key,
                      p.player.skills?.[key as keyof typeof p.player.skills],
                      p.opponent.skills?.[
                        key as keyof typeof p.opponent.skills
                      ],
                    ]),
                    ...(
                      [
                        "peakElo",
                        "form",
                        "morale",
                        "fatigue",
                        "preparation",
                        "openingFamiliarity",
                      ] as const
                    ).map((key) => [key, p.player[key], p.opponent[key]]),
                  ].map(([key, a, b]) => (
                    <tr key={String(key)}>
                      <td className="py-1">{attributeLabel(key)}</td>
                      <td className="text-right tabular-nums">
                        {typeof a === "number" ? a.toFixed(1) : "Unknown"}
                      </td>
                      <td className="text-right tabular-nums">
                        {typeof b === "number" ? b.toFixed(1) : "Unknown"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(p.player.data === "npc-estimate" ||
              p.opponent.data === "npc-estimate") && (
              <p>
                NPC numeric skills/fatigue are estimates from their rating,
                declared strengths, training intensity and round. Form and
                morale use their saved values.
              </p>
            )}
            <p>
              Draw parameters are game-design priors, not a fitted real-world
              FIDE dataset. Simulated evidence improves internal consistency; it
              does not establish real-world predictive accuracy. Values round to
              100.00%; tiny nonzero probabilities may display 0.00%.
            </p>
          </div>
        </details>
      )}
      {preview && (
        <p className="mt-2 text-xs text-ink-faint">
          Preview updates with preparation and conditions. The match stores its
          final prediction before the first move.
        </p>
      )}
    </Card>
  );
}
