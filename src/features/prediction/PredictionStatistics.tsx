import { useState } from "react";
import { Button, Card, CardTitle, Tabs } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { useGameStore } from "@/store/gameStore";
import {
  predictionOf,
  reliabilityError,
  DEFAULT_PREDICTION_CONFIG,
} from "@/game/prediction/statistics";
import type {
  PredictionConfig,
  PredictionScope,
  UpsetRecord,
} from "@/game/prediction/types";
import type { GameOutcome } from "@/types";
import { PredictionPanel } from "./PredictionPanel";

const percent = (n: number): string => `${(n * 100).toFixed(2)}%`;
function Upset({
  label,
  record,
}: {
  label: string;
  record: UpsetRecord | null;
}) {
  return (
    <div className="rounded-lg bg-navy-900 p-3">
      <p className="text-xs text-ink-faint">{label}</p>
      {record ? (
        <>
          <p className="mt-1 font-semibold text-ink">
            {record.winner} beat {record.loser}
          </p>
          <p className="text-xs text-ink-muted">
            {record.gap} Elo overcome · win probability{" "}
            {percent(record.probability)} · {record.event} · {record.source}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-ink-muted">
          No qualifying upset recorded yet.
        </p>
      )}
    </div>
  );
}
export function PredictionStatistics() {
  const save = useSave(),
    state = predictionOf(save),
    configure = useGameStore((s) => s.configurePrediction);
  const [tab, setTab] = useState<
    "accuracy" | "upsets" | "settings"
  >("accuracy");
  const [scope, setScope] = useState<PredictionScope>("career"),
    [outcome, setOutcome] = useState<GameOutcome>("win");
  const [opened, setOpened] = useState<string | null>(null),
    [limit, setLimit] = useState(10);
  const totals = state.metrics[scope],
    selected = state.recent.find((o) => o.prediction.id === opened);
  const recent = state.recent
    .filter((o) => o.scope === scope)
    .slice(-limit)
    .reverse();
  const count = totals.adjusted.games;
  const groups = Object.keys(state.cells).filter((k) =>
    k.startsWith("coarse|"),
  ).length;
  const settings: {
    key: keyof Pick<
      PredictionConfig,
      | "drawBase"
      | "maxAdjustment"
      | "historyPrior"
      | "historyMin"
      | "historyWeight"
      | "upsetGap"
    >;
    label: string;
    min: number;
    max: number;
    step: number;
  }[] = [
    {
      key: "drawBase",
      label: "Classical draw prior at 1800 Elo",
      min: 0.05,
      max: 0.6,
      step: 0.01,
    },
    {
      key: "maxAdjustment",
      label: "Maximum context adjustment (Elo)",
      min: 0,
      max: 120,
      step: 5,
    },
    {
      key: "historyPrior",
      label: "Smoothing prior (games)",
      min: 80,
      max: 1000,
      step: 20,
    },
    {
      key: "historyMin",
      label: "Minimum samples per group",
      min: 10,
      max: 100,
      step: 5,
    },
    {
      key: "historyWeight",
      label: "Historical calibration weight",
      min: 0,
      max: 0.8,
      step: 0.05,
    },
    {
      key: "upsetGap",
      label: "Minimum upset Elo gap",
      min: 150,
      max: 600,
      step: 25,
    },
  ];
  return (
    <section className="mb-5 space-y-4" data-testid="prediction-statistics">
      <h2 className="font-display text-xl font-bold text-ink">
        Match predictions & calibration
      </h2>
      <Tabs
        label="Prediction sections"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "accuracy", label: "Accuracy" },
          { id: "upsets", label: "Upsets" },
          { id: "settings", label: "Model settings" },
        ]}
      >
        {tab === "accuracy" && (
          <div className="space-y-4">
            <Card>
              <CardTitle>Prediction performance</CardTitle>
              <label className="text-sm text-ink-muted">
                Game sample
                <select
                  aria-label="Prediction game sample"
                  value={scope}
                  onChange={(e) => {
                    setScope(e.target.value as PredictionScope);
                    setOpened(null);
                    setLimit(10);
                  }}
                  className="ml-3 rounded-lg bg-navy-900 p-2 text-ink"
                >
                  <option value="career">Career matches</option>
                  <option value="practice">Practice games</option>
                  <option value="npc">NPC games</option>
                </select>
              </label>
              <p className="my-3 text-sm text-ink-muted">
                {count.toLocaleString()} completed predictions in this sample.{" "}
                {state.learned.toLocaleString()} eligible games inform {groups}{" "}
                rating/time groups. Older games without a pre-match snapshot are
                excluded.
              </p>
              <div className="overflow-x-auto">
                <table
                  className="w-full text-left text-sm"
                  data-testid="prediction-metrics"
                >
                  <thead>
                    <tr>
                      <th className="p-2">Model</th>
                      <th className="p-2">Brier ↓</th>
                      <th className="p-2">Log loss ↓</th>
                      <th className="p-2">Top-choice accuracy</th>
                      <th className="p-2">Calibration error ↓</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["baseline", "adjusted"] as const).map((kind) => {
                      const t = totals[kind];
                      return (
                        <tr key={kind}>
                          <td className="p-2">
                            {kind === "baseline"
                              ? "Elo baseline"
                              : "Context + history"}
                          </td>
                          <td className="p-2 tabular-nums">
                            {count ? (t.brier / count).toFixed(4) : "—"}
                          </td>
                          <td className="p-2 tabular-nums">
                            {count ? (t.logLoss / count).toFixed(4) : "—"}
                          </td>
                          <td className="p-2 tabular-nums">
                            {count ? percent(t.correct / count) : "—"}
                          </td>
                          <td className="p-2 tabular-nums">
                            {count ? percent(reliabilityError(t)) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-ink-faint">
                Brier uses the sum over three outcomes (0–2). Log loss uses
                natural logs. Calibration error averages the 10-bin absolute
                reliability error over W/D/L. Top-choice accuracy is secondary:
                an underdog victory alone does not invalidate a probability.
                Scores accumulate before learning each result.
              </p>
              <p className="mt-2 text-xs text-ink-faint">
                Career includes human games, engine simulations and national
                team simulations; practice is separate. NPC statistics include
                abstract simulations. These samples measure this game's
                simulation, not real-world chess calibration.
              </p>
            </Card>
            <Card>
              <CardTitle>Reliability by probability</CardTitle>
              <label className="text-sm text-ink-muted">
                Outcome
                <select
                  aria-label="Reliability outcome"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as GameOutcome)}
                  className="ml-3 rounded-lg bg-navy-900 p-2 text-ink"
                >
                  {(["win", "draw", "loss"] as const).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <p className="my-3 text-xs text-ink-muted">
                A calibrated bin has similar forecast and observed frequencies.
                Bins with fewer than 30 games are labelled sparse.
              </p>
              <div className="space-y-3">
                {totals.adjusted.bins[outcome].map((b, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[4rem_minmax(0,1fr)_6rem] items-center gap-2 text-xs"
                  >
                    <span className="tabular-nums text-ink-muted">
                      {i * 10}–{(i + 1) * 10}%
                    </span>
                    <div className="space-y-1">
                      <div className="h-2 rounded bg-navy-900">
                        <div
                          className="h-2 rounded bg-sky-400"
                          style={{
                            width: `${b.games ? (b.probability / b.games) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <div className="h-2 rounded bg-navy-900">
                        <div
                          className="h-2 rounded bg-emerald-400"
                          style={{
                            width: `${b.games ? (b.observed / b.games) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-right tabular-nums text-ink-muted">
                      {b.games
                        ? `${percent(b.observed / b.games)} · n=${b.games}${b.games < 30 ? " sparse" : ""}`
                        : "No games"}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                <span className="text-sky-300">Blue: mean forecast</span> ·{" "}
                <span className="text-emerald-300">
                  Green: observed frequency
                </span>
              </p>
            </Card>
            <Card>
              <CardTitle>Original forecasts & results</CardTitle>
              {!recent.length && (
                <p className="text-sm text-ink-muted">
                  Complete a game to start collecting forecasts. New careers
                  begin with no invented historical samples.
                </p>
              )}
              <ul className="divide-y divide-white/10">
                {recent.map((o) => (
                  <li key={o.prediction.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpened(
                          opened === o.prediction.id ? null : o.prediction.id,
                        )
                      }
                      className="w-full py-3 text-left"
                    >
                      <span className="block text-sm font-semibold text-ink">
                        {o.prediction.player.name} vs{" "}
                        {o.prediction.opponent.name} · {o.result}
                      </span>
                      <span className="text-xs text-ink-muted">
                        Year {o.prediction.stamp.year}, week{" "}
                        {o.prediction.stamp.week} · {o.source}
                        {!o.eligible ? " · excluded from draw learning" : ""} ·
                        outcome probability{" "}
                        {percent(o.prediction.adjusted[o.result])}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {state.recent.filter((o) => o.scope === scope).length > limit && (
                <Button
                  variant="secondary"
                  onClick={() => setLimit((n) => n + 20)}
                >
                  Show more forecasts
                </Button>
              )}
              <p className="mt-3 text-xs text-ink-faint">
                Recent details retain 500 career/practice games and 200 NPC
                games; lifetime scores and biggest upsets remain after older
                details expire.
              </p>
            </Card>
            {selected && (
              <PredictionPanel
                prediction={selected.prediction}
                actual={selected.result}
              />
            )}
          </div>
        )}
        {tab === "upsets" && (
          <Card>
            <CardTitle>Upset records</CardTitle>
            <p className="mb-3 text-sm text-ink-muted">
              A lower-rated winner must overcome at least the threshold recorded
              in its original model settings. No outcome is forced to create an
              upset.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Upset
                label="Biggest career upset / Elo difference overcome"
                record={state.upsets.biggestCareer}
              />
              <Upset
                label="Most unexpected career victory"
                record={state.upsets.unexpectedCareer}
              />
              <Upset
                label="Biggest NPC upset"
                record={state.upsets.biggestNpc}
              />
              <Upset
                label="Most unexpected NPC victory"
                record={state.upsets.unexpectedNpc}
              />
            </div>
            <h3 className="mb-2 mt-5 font-semibold text-ink">
              Historical upset records
            </h3>
            <ul className="space-y-2">
              {state.upsets.records
                .slice()
                .reverse()
                .slice(0, 30)
                .map((r) => (
                  <li key={r.id} className="text-sm text-ink-muted">
                    {r.winner} ({r.winnerElo}) beat {r.loser} ({r.loserElo}) · +
                    {r.gap} · {percent(r.probability)} · {r.source}
                  </li>
                ))}
            </ul>
          </Card>
        )}
        {tab === "settings" && (
          <Card>
            <CardTitle>Model settings</CardTitle>
            <p className="mb-4 text-sm text-ink-muted">
              Changes apply to future forecasts. Existing snapshots and scores
              retain their original settings. Advanced controls adjust
              individual factors within balanced limits.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {settings.map((s) => (
                <label key={s.key} className="text-sm text-ink-muted">
                  {s.label}: {state.config[s.key]}
                  <input
                    aria-label={s.label}
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={state.config[s.key]}
                    onChange={(e) =>
                      configure({ [s.key]: Number(e.target.value) })
                    }
                    className="mt-2 block w-full accent-gold-500"
                  />
                </label>
              ))}
            </div>
            <details className="mt-5">
              <summary className="cursor-pointer text-gold-300">
                Advanced model parameters
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(
                  [
                    [
                      "drawRatingSlope",
                      "Draw rate per rating point",
                      0,
                      0.0003,
                      0.00001,
                    ],
                    ["drawGapScale", "Draw Elo-gap scale", 200, 1200, 25],
                    [
                      "drawScoreShare",
                      "Maximum draw share of underdog expected score",
                      0.5,
                      0.95,
                      0.01,
                    ],
                    [
                      "aggressiveDrawBias",
                      "Aggressive style draw adjustment",
                      -0.08,
                      0,
                      0.005,
                    ],
                    [
                      "solidDrawBias",
                      "Solid style draw adjustment",
                      0,
                      0.08,
                      0.005,
                    ],
                    ["skillElo", "Skills (Elo / point)", 0, 0.7, 0.05],
                    ["formElo", "Form (Elo / point)", 0, 0.5, 0.05],
                    ["moraleElo", "Morale (Elo / point)", 0, 0.4, 0.05],
                    ["fatigueElo", "Fatigue (Elo / point)", 0, 0.8, 0.05],
                    [
                      "preparationElo",
                      "Preparation (Elo / point)",
                      0,
                      0.3,
                      0.02,
                    ],
                    ["peakElo", "Peak recovery coefficient", 0, 0.06, 0.005],
                    ["pressureElo", "Pressure (Elo / point)", 0, 0.3, 0.02],
                    [
                      "familiarityElo",
                      "Opening familiarity (Elo / point)",
                      0,
                      0.2,
                      0.02,
                    ],
                    ["headToHeadElo", "Head-to-head maximum (Elo)", 0, 25, 1],
                  ] as const
                ).map(([key, label, min, max, step]) => (
                  <label key={key} className="text-sm text-ink-muted">
                    {label}: {state.config[key]}
                    <input
                      aria-label={label}
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={state.config[key]}
                      onChange={(e) =>
                        configure({ [key]: Number(e.target.value) })
                      }
                      className="mt-2 block w-full accent-gold-500"
                    />
                  </label>
                ))}
                {(
                  ["classical", "rapid", "blitz", "bullet", "none"] as const
                ).map((time) => (
                  <div key={time} className="space-y-3">
                    <label className="block text-sm text-ink-muted">
                      {time} White advantage: {state.config.whiteElo[time]} Elo
                      <input
                        aria-label={`${time} White advantage`}
                        type="range"
                        min={0}
                        max={40}
                        step={1}
                        value={state.config.whiteElo[time]}
                        onChange={(e) =>
                          configure({
                            whiteElo: {
                              ...state.config.whiteElo,
                              [time]: Number(e.target.value),
                            },
                          })
                        }
                        className="mt-2 block w-full accent-gold-500"
                      />
                    </label>
                    <label className="block text-sm text-ink-muted">
                      {time} draw multiplier: {state.config.timeDraw[time]}
                      <input
                        aria-label={`${time} draw multiplier`}
                        type="range"
                        min={0.2}
                        max={1.3}
                        step={0.05}
                        value={state.config.timeDraw[time]}
                        onChange={(e) =>
                          configure({
                            timeDraw: {
                              ...state.config.timeDraw,
                              [time]: Number(e.target.value),
                            },
                          })
                        }
                        className="mt-2 block w-full accent-gold-500"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </details>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => configure(DEFAULT_PREDICTION_CONFIG)}
            >
              Reset prediction settings
            </Button>
          </Card>
        )}
      </Tabs>
    </section>
  );
}
