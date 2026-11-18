import { EliteStats } from "@/features/elite/ElitePresentation";
import { useRankedNpcs } from "@/hooks/useNpcs";
import { computeRankings } from "@/game/world/standings";
import { useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip } from "chart.js";
import { TrendingUp } from "lucide-react";
import { Card, CardTitle, EmptyState } from "@/components/ui";
import { useGameStore } from "@/store/gameStore";
import type { Npc } from "@/types";
import { npcEloSeries, type NpcEloPeriod } from "@/game/npc/eloSeries";
import { LanguageContext } from "@/i18n/context";
import { translateUI } from "@/i18n/translate";
import { buildEloSeries, type EloPeriod } from "@/game/history/eloSeries";

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip);
const PLAYER_PERIODS: { id: EloPeriod; label: string }[] = [
  { id: "tournament", label: "Tournament" }, { id: "month", label: "Month" }, { id: "year", label: "Year" },
];

export function EloChart({npc}:{npc?:Npc}={}) {
  const save = useGameStore(s=>s.save);
  const player = npc ? {rating:npc.currentElo} : save!.player, history=save?.history;
  const PERIODS: {id:NpcEloPeriod;label:string}[] = npc ? [{id:"match",label:"Match"},...PLAYER_PERIODS] : PLAYER_PERIODS;
  const language = useContext(LanguageContext);
  const [period, setPeriod] = useState<NpcEloPeriod>(npc?.ratingHistory?.length?"match":"month");
  const [range, setRange] = useState<1 | 5 | null>(null);
  const ranked = useRankedNpcs();
  const year = save?.world.date.year ?? 0;
  const rank = save && !npc ? computeRankings(save.player, ranked).world.rank : null;
  const canvas = useRef<HTMLCanvasElement>(null);
  const descriptionId = useId();
  const points = useMemo(() => {
    const locale = language === "th" ? "th-TH" : "en-GB";
    if (npc) return npcEloSeries(npc, period, locale);
    if (!history || !save) return [];
    if (!range) return buildEloSeries(history, period as EloPeriod, locale);
    const current = new Date(Date.UTC(year, 0, (save.world.date.week - 1) * 7 + save.world.day));
    current.setUTCFullYear(current.getUTCFullYear() - range);
    const cutoff = current.getTime();
    const recent = (stamp: { year: number; week: number; day?: number }) =>
      Date.UTC(stamp.year, 0, (stamp.week - 1) * 7 + (stamp.day ?? 1)) > cutoff;
    return buildEloSeries({
      ...history,
      games: history.games.filter(recent),
      ratingHistory: history.ratingHistory.filter(recent),
    }, period as EloPeriod, locale);
  }, [npc, history, period, language, range, year, save?.world.date.week, save?.world.day]);
  const change = points.length > 1 ? points.at(-1)!.elo - points[0].elo : null;

  useEffect(() => {
    if (!canvas.current || !points.length) return;
    const chart = new Chart(canvas.current, {
      type: "line",
      data: {
        labels: points.map((p, i) => period === "tournament" ? `#${i + 1}` : p.label),
        datasets: [{
          label: "Elo", data: points.map((p) => p.elo), borderColor: "#c7a76b", borderWidth: 2.5,
          backgroundColor: (context) => {
            const area = context.chart.chartArea;
            if (!area) return "rgba(199,167,107,0.12)";
            const gradient = context.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
            gradient.addColorStop(0, "rgba(199,167,107,0.24)");
            gradient.addColorStop(1, "rgba(199,167,107,0)");
            return gradient;
          },
          fill: true, tension: 0.2, pointRadius: points.length > 30 ? 0 : 3,
          pointHoverRadius: 6, pointHitRadius: 18, pointBackgroundColor: "#c7a76b",
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: 12, right: 12 } },
        plugins: { tooltip: {
          displayColors: false, backgroundColor: "#223249", titleColor: "#f3e8d1", bodyColor: "#ddd1ba", padding: 12,
          callbacks: { title: (items) => points[items[0].dataIndex].label },
        } },
        scales: {
          x: { border: { display: false }, grid: { display: false }, ticks: { color: "#9daac0", maxTicksLimit: 6, maxRotation: 0, font: { family: "Manrope Variable, Noto Sans Thai Variable, sans-serif", size: 11 } } },
          y: { border: { display: false }, grace: "15%", grid: { color: "rgba(255,255,255,0.06)" }, ticks: { color: "#9daac0", maxTicksLimit: 5, precision: 0, font: { size: 11 } } },
        },
      },
    });
    return () => chart.destroy();
  }, [points, period, language]);

  return (
    <Card className="mb-5" data-testid={npc?"npc-elo-chart":"elo-chart"}>
      <CardTitle aside={<TrendingUp size={20} className="text-gold-400" aria-hidden />}>{npc?"NPC Elo History":"Elo Analytics"}</CardTitle>
      {!npc && save && <div className="mb-5 space-y-4">
        <EliteStats items={[["Current Elo", player.rating], ["Peak Elo", save.player.peakRating], ["Rating gain in view", change === null ? "—" : `${change > 0 ? "+" : ""}${change}`], ["World rank", `#${rank}`]]} />
        <div role="group" aria-label="Elo chart range" className="flex flex-wrap gap-2">
          {([1, 5, null] as const).map((value) => <button key={value ?? "all"} className="section-tab bg-navy-700" aria-pressed={range === value} onClick={() => setRange(value)}>{value === null ? "Career" : value === 1 ? "1 Year" : "5 Years"}</button>)}
        </div>
      </div>}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className={npc ? "flex items-baseline gap-3" : "sr-only"}>
          <strong className="font-display text-4xl tabular-nums text-ink">{player.rating.toLocaleString()}</strong>
          <span className="text-xs text-ink-muted">Current Elo</span>
          {change !== null && <span className={`rounded-full px-2 py-1 text-xs font-semibold tabular-nums ${change >= 0 ? "bg-gold-500/10 text-gold-300" : "bg-red-500/10 text-red-300"}`} aria-label={`${translateUI("Change in view")}: ${change > 0 ? "+" : ""}${change} Elo`}>{change > 0 ? "+" : ""}{change}</span>}
        </div>
        <div role="group" aria-label="Elo chart period" className="flex rounded-xl bg-navy-900 p-1">
          {PERIODS.map((p) => <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)} className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors ${period === p.id ? "bg-navy-600 text-gold-300 shadow-sm" : "text-ink-muted hover:text-ink"}`}>{p.label}</button>)}
        </div>
      </div>
      {points.length ? (
        <div className="relative h-64 w-full sm:h-72" data-testid="elo-chart-plot">
          <canvas ref={canvas} role="img" aria-label={`${translateUI("Elo progress")} · ${translateUI(PERIODS.find((p) => p.id === period)!.label)}`} aria-describedby={descriptionId} />
        </div>
      ) : <EmptyState title="No rating history yet" description={npc?"NPC ratings are recorded from played games and saved tournament results.":period === "tournament" ? "Play a rated tournament to see its closing Elo here." : "Finish a rated game to start your Elo chart."} />}
      <p id={descriptionId} className="mt-3 text-xs text-ink-faint">{npc?"Career results only. Match view shows up to 100 recorded games against you; period views also include saved NPC tournament results.":"Closing Elo for each period with recorded games. Older saves use the start of the recorded week when the day is unknown."}</p>
      {!npc&&period === "tournament" && <p className="mt-1 text-xs text-ink-faint">Tournament view uses retained rated games, including events in progress. Monthly and yearly views use the full rating history.</p>}
      {points.length > 0 && <details className="mt-4 border-t border-white/10 pt-3">
        <summary className="cursor-pointer text-sm font-semibold text-gold-300">View chart data</summary>
        <div className="mt-3 max-h-64 overflow-auto">
          <table className="w-full text-left text-sm" data-testid={npc?"npc-elo-chart-data":"elo-chart-data"}>
            <caption className="sr-only">Elo progress</caption>
            <thead className="text-ink-muted"><tr><th scope="col" className="py-2">Period</th><th scope="col" className="py-2 text-right">Elo</th></tr></thead>
            <tbody>{points.map((p) => <tr key={p.key} className="border-t border-white/5"><th scope="row" className="py-2 pr-3 font-normal" translate={period === "tournament" ? "no" : undefined}>{p.label}</th><td className="py-2 text-right font-semibold tabular-nums text-gold-300">{p.elo}</td></tr>)}</tbody>
          </table>
        </div>
      </details>}
    </Card>
  );
}
