import { SeasonPresentation } from "./SeasonPresentation";
import { standings } from "@/game/match/tournament";
import { SeasonCoach } from "./CareerTools";
import { useSeasonGameStatus } from "@/store/seasonGameClient";
import { useEffect, useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { LEARNING_FOCUSES, type LearningFocus } from "@/game/career/learningFocus";
import { Button, Card, CardTitle, Modal } from "@/components/ui";
import { useGameStore } from "@/store/gameStore";
import { seasonOf } from "@/game/career/seasonSimulation";
import {
  FOCUS_LABELS,
  planningOf,
  type AnnualFocus,
} from "@/game/career/planning";
import { dayLabel, gameDay } from "@/game/competition/agenda";
import { translateUI } from "@/i18n/translate";
export function SimulateSeason() {
  const save = useGameStore((s) => s.save)!,
    busy = useGameStore((s) => s.calendarProgress),
    run = useGameStore((s) => s.simulateSeason);
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [focus, setFocus] = useState<AnnualFocus>(planningOf(save).current.focus);
  const [learningFocus, setLearningFocus] = useState<LearningFocus[]>([]);
  const season = seasonOf(save),
    resume =
      season?.status === "paused" && season.year === save.world.date.year;
  return (
    <Card className="season-card mb-4" data-testid="simulate-season-panel">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400"><Sparkles size={20} aria-hidden /></span>
        <div className="min-w-0 flex-1">
      <CardTitle>Simulate Season</CardTitle>
      <p className="mb-4 text-sm text-ink-muted">
        Automatically train, rest, recover AP, earn entry money, enter suitable
        tournaments and play through the rest of this year.
      </p>
        </div>
      </div>
      <details className="mb-4 rounded-xl bg-navy-900/50 p-3"><summary className="cursor-pointer text-sm">Ask your coach before simulating</summary><div className="mt-3"><SeasonCoach/></div></details>
      {season && (
        <details className="mb-4 rounded-xl bg-navy-900/60 p-3 text-sm" data-testid="season-summary">
          <summary className="cursor-pointer font-semibold">{season.year} · {translateUI(season.status === "completed" ? "Season complete" : "Simulation paused")} · {season.games} {translateUI("games")}</summary>
          {season.focus === "learning" && !!season.learningFocus?.length && (
            <p className="mt-2 text-gold-300">{season.learningFocus.map((id) => translateUI(LEARNING_FOCUSES.find((f) => f.id === id)!.label)).join(" · ")}</p>
          )}
          <p>
            {season.year} ·{" "}
            {translateUI(
              season.status === "completed"
                ? "Season complete"
                : "Simulation paused",
            )}{" "}
            · {season.days} days
          </p>
          <p>
            {season.games} games · {season.wins}W {season.draws}D{" "}
            {season.losses}L · {season.tournaments} tournaments
          </p>
          <p>
            {season.sessions} training sessions · {season.restDays} recovery
            days · {season.workDays} work days
          </p>
          <p>
            Elo {season.startRating} → {season.endRating ?? save.player.rating}{" "}
            · ${season.startMoney} → ${season.endMoney ?? save.player.money}
          </p>
          {season.timing && (
            <p data-testid="season-timing">
              Total processing: {(season.timing.runMs / 1000).toFixed(1)} s ·
              Game processing: {(season.timing.gameMs / 1000).toFixed(1)} s ·
              Average per game:{" "}
              {(
                season.timing.gameMs /
                Math.max(1, season.timing.games) /
                1000
              ).toFixed(2)}{" "}
              s
            </p>
          )}
          {season.notes.map((n, i) => (
            <p key={i} className="mt-2 text-gold-300">
              {translateUI(n)}
            </p>
          ))}
        </details>
      )}
      <Button
        disabled={!!busy || !!save.pendingMatch}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        {resume ? "Resume season simulation" : "Simulate Season"}
        <ArrowUpRight size={16} aria-hidden />
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-red-300">
          {translateUI(error)}
        </p>
      )}
      {open && (
        <Modal
          open
          title={resume ? "Resume season simulation" : "Simulate Season"}
          onClose={() => setOpen(false)}
          size="lg"
          footer={
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => {
                setOpen(false);
                void run(focus, learningFocus).then((r) => { if (!r.ok) setError(r.error); });
              }}>{resume ? "Resume simulation" : "Start season simulation"}</Button>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          }
        >
          <p className="mb-3 text-sm">
            Simulate from {dayLabel(gameDay(save)).slice(0, 10)} until the start
            of {save.world.date.year + 1}.
          </p>
          <label className="mb-3 block text-sm">
            Season approach
            <select
              aria-label="Season approach"
              disabled={resume}
              value={resume ? season!.focus : focus}
              onChange={(e) => setFocus(e.target.value as AnnualFocus)}
              className="mt-2 w-full rounded-lg bg-navy-900 p-3"
            >
              {Object.entries(FOCUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {(resume ? season!.focus : focus) === "learning" && (
            <fieldset className="mb-4" disabled={resume}>
              <legend className="font-semibold text-ink">Learning priorities</legend>
              <p className="mb-3 mt-1 text-sm text-ink-muted">Choose one or more areas. Leave all unchecked to improve weaker skills automatically.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {LEARNING_FOCUSES.map((item) => {
                  const selected = (resume ? season!.learningFocus ?? [] : learningFocus).includes(item.id);
                  return (
                    <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${selected ? "border-gold-500/60 bg-gold-500/10" : "border-white/10 bg-navy-900/50 hover:border-white/25"}`}>
                      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-gold-500" checked={selected}
                        onChange={() => setLearningFocus((prev) => selected ? prev.filter((id) => id !== item.id) : [...prev, item.id])} aria-label={item.label} />
                      <span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-xs text-ink-muted">{item.detail}</span></span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-ink-faint">Selected areas take turns during training. AP, fatigue and session requirements still apply.</p>
            </fieldset>
          )}
          <details className="mb-4 rounded-xl bg-navy-900/60 p-3 text-sm text-ink-muted">
            <summary className="cursor-pointer font-semibold">How simulation works</summary>
            <p className="mt-2">Season games play real legal moves with the dedicated two-ply season engine. Results, openings, replays, chess clocks and PGN are saved. Full engine analysis is available on request.</p>
            <p className="mt-2">Normal AP, training hours, fatigue, entry fees and eligibility apply. The manager keeps a $50 reserve, takes available jobs when funds are low and honors existing tournament bookings. New automatic entries are individual events that finish this year.</p>
          </details>
          <p className="mb-4 text-xs text-ink-muted">
            You can pause after the current action and continue later. Reloading
            keeps completed progress and waits for you to resume. Keep this
            browser tab open while simulating.
          </p>
        </Modal>
      )}
    </Card>
  );
}
export function SeasonProgressDialog() {
  const running = useGameStore((s) => s.seasonRunning),
    save = useGameStore((s) => s.save),
    pause = useGameStore((s) => s.cancelCalendar);
  const gameStatus = useSeasonGameStatus();
  const [elapsed, setElapsed] = useState(0),
    [gameElapsed, setGameElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const at = performance.now();
    const tick = () => {
      setElapsed((performance.now() - at) / 1000);
      const game = useSeasonGameStatus.getState();
      setGameElapsed(
        game.started === null ? 0 : (performance.now() - game.started) / 1000,
      );
    };
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [running]);
  const [stopping, setStopping] = useState(false);
  useEffect(() => {
    if (running) setStopping(false);
  }, [running]);
  const season = save && seasonOf(save);
  if (!running || !save || !season) return null;
  const stop = () => {
    setStopping(true);
    pause();
  };
  return (
    <Modal open title="Simulating season" onClose={stop} size="game"><div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div data-testid="season-progress" className="min-w-0 space-y-3"><SeasonPresentation action={translateUI(season.action)} tournaments={season.tournaments} stopping={stopping}/>
        <p role="status">
          {season.year} · {dayLabel(gameDay(save)).slice(0, 10)} · {season.days}{" "}
          / {season.targetDay - season.startDay} days
        </p>
        <progress
          aria-label="Season progress"
          max={season.targetDay - season.startDay}
          value={season.days}
          className="w-full accent-[var(--accent)]"
        />
        <p>{translateUI(season.action)}</p>
        <p data-testid="season-elapsed">
          Elapsed this run: {elapsed.toFixed(1)} s
        </p>
        {gameStatus.started !== null && (
          <p data-testid="season-game-progress">
            Playing recorded game: {gameStatus.ply} plies ·{" "}
            {gameElapsed.toFixed(1)} s
          </p>
        )}
        <p>
          {season.games} games · {season.wins}W {season.draws}D {season.losses}L
          · {season.tournaments} tournaments
        </p>
        <p>
          {season.sessions} training sessions · Elo {save.player.rating} · $
          {save.player.money}
        </p>
        <p className="text-xs text-ink-muted">
          Completed actions are saved. Pause stops after the current action.
        </p>
        <Button variant="secondary" onClick={stop} disabled={stopping}>
          {stopping ? "Pausing…" : "Pause simulation"}
        </Button>
      </div><aside className="min-w-0 rounded-xl bg-navy-900/60 p-3" data-testid="live-season-standings"><h3 className="mb-2 font-semibold">Live tournament standings</h3>{save.tournament ? <><p className="mb-3 break-words text-sm text-gold-300">{save.tournament.name} · Round {save.tournament.round}</p><ol className="max-h-[55dvh] space-y-2 overflow-y-auto">{standings(save.tournament).map(r=><li key={r.player.id} className={`grid grid-cols-[2rem_minmax(0,1fr)_3rem] gap-2 rounded-lg p-2 text-xs ${r.player.isPlayer?"bg-gold-500/15 text-gold-300":"bg-navy-800"}`}><span>#{r.rank}</span><span className="break-words">{r.player.name}<span className="block text-ink-muted">Elo {r.player.elo}</span></span><strong>{r.player.points} pts</strong></li>)}</ol></> : <p className="text-sm text-ink-muted">Standings appear when your next tournament starts.</p>}</aside></div>
    </Modal>
  );
}
