import { useEffect, useState } from "react";
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
  const season = seasonOf(save),
    resume =
      season?.status === "paused" && season.year === save.world.date.year;
  return (
    <Card className="mb-4" data-testid="simulate-season-panel">
      <CardTitle>Simulate Season</CardTitle>
      <p className="mb-3 text-sm text-ink-muted">
        Automatically train, rest, recover AP, earn entry money, enter suitable
        tournaments and play through the rest of this year.
      </p>
      {season && (
        <div className="mb-3 text-sm" data-testid="season-summary">
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
          {season.notes.map((n, i) => (
            <p key={i} className="mt-2 text-gold-300">
              {translateUI(n)}
            </p>
          ))}
        </div>
      )}
      <Button
        disabled={!!busy || !!save.pendingMatch}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        {resume ? "Resume season simulation" : "Simulate Season"}
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
        >
          <p className="mb-3 text-sm">
            Simulate from {dayLabel(gameDay(save)).slice(0, 10)} until the start
            of {save.world.date.year + 1}.
          </p>
          <p className="mb-3 text-sm text-ink-muted">
            Game results use the season simulation model, including Elo, skills,
            form and fatigue. Results affect your career. No moves or engine
            analysis are generated.
          </p>
          <p className="mb-3 text-sm text-ink-muted">
            Normal AP, training hours, fatigue, entry fees and eligibility
            apply. The manager keeps a $50 reserve, takes available jobs when
            funds are low and honors existing tournament bookings. New automatic
            entries are individual events that finish this year.
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
          <p className="mb-4 text-xs text-ink-muted">
            You can pause after the current action and continue later. Reloading
            keeps completed progress and waits for you to resume. Keep this
            browser tab open while simulating.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setOpen(false);
                void run(focus).then((r) => {
                  if (!r.ok) setError(r.error);
                });
              }}
            >
              {resume ? "Resume simulation" : "Start season simulation"}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}
export function SeasonProgressDialog() {
  const running = useGameStore((s) => s.seasonRunning),
    save = useGameStore((s) => s.save),
    pause = useGameStore((s) => s.cancelCalendar);
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
    <Modal open title="Simulating season" onClose={stop} size="lg">
      <div data-testid="season-progress" className="space-y-3">
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
      </div>
    </Modal>
  );
}
