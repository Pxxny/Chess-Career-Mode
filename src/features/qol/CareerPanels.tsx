import { confirmUI } from "@/i18n/translate";
import { useState } from "react";
import { Button, Card, CardTitle, Modal } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { useGameStore } from "@/store/gameStore";
import { restInfo } from "@/game/training/engine";
import {
  AUTO_REST,
  AUTO_TRAINING,
  CAREER_JOBS,
  careerDay,
  jobIssue,
  qolOf,
  transferIssue,
  type CalendarAdvanceReport,
} from "@/game/qol/career";
import { COUNTRIES, getCountry } from "@/data/world/countries";
export function WorkPanel() {
  const save = useSave(),
    work = useGameStore((s) => s.workCareerJob),
    [message, setMessage] = useState("");
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Work & income</CardTitle>
        <p className="text-sm text-ink-muted">
          Earn outside tournaments. Each job uses today's hours and AP. Up to
          two jobs per day, each job once. Earnings are recorded in your career
          ledger.
        </p>
        <p className="mt-3 text-sm text-ink">
          ${save.player.money} · {save.player.ap.current} AP ·{" "}
          {Math.max(0, 8 - save.training.hoursUsedToday)} hours left
        </p>
        {message && (
          <p role="status" className="mt-3 text-sm text-gold-300">
            {message}
          </p>
        )}
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        {CAREER_JOBS.map((j) => {
          const issue = jobIssue(save, j);
          return (
            <Card key={j.id}>
              <CardTitle>{j.name}</CardTitle>
              <p className="text-sm text-ink-muted">{j.description}</p>
              <p className="my-3 text-sm text-ink">
                Earn ${j.pay} · {j.hours}h · {j.ap} AP · +{j.fatigue} fatigue
              </p>
              <p className="mb-3 text-xs text-ink-muted">
                {j.elo
                  ? `${j.elo}+ Elo · reputation ${j.reputation}+`
                  : "Available to every player"}
              </p>
              <Button
                disabled={!!issue}
                onClick={() => {
                  const r = work(j.id);
                  setMessage(
                    r.ok ? `${j.name} completed. Earned $${j.pay}.` : r.error,
                  );
                }}
              >
                Work · {j.name}
              </Button>
              {issue && <p className="mt-2 text-xs text-ink-muted">{issue}</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
export function FederationTransferPanel() {
  const save = useSave(),
    state = qolOf(save),
    request = useGameStore((s) => s.requestFederationTransfer),
    [country, setCountry] = useState(""),
    [message, setMessage] = useState("");
  const issue = transferIssue(save);
  return (
    <Card className="mb-4">
      <CardTitle>Nationality & federation</CardTitle>
      <p className="text-sm text-ink-muted">
        Born into {getCountry(state.birthCountry)?.name ?? state.birthCountry}.
        Currently representing {getCountry(save.player.country)?.name}. Change
        your in-game representation after 1800 Elo and 25 rated career games.
        Processing: 30 game days, $250; one transfer per game year. These are
        career-game rules.
      </p>
      {state.transfer ? (
        <p role="status" className="mt-3 text-sm text-gold-300">
          Application: {getCountry(state.transfer.country)?.name} ·{" "}
          {Math.max(0, state.transfer.ready - careerDay(save))} days left
          {careerDay(save) >= state.transfer.ready
            ? " · Waiting for your current tournament to finish"
            : ""}
          .
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <select
            aria-label="New federation"
            className="min-w-0 max-w-full flex-1 rounded-lg bg-navy-900 p-3 text-sm text-ink"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">Choose a federation…</option>
            {COUNTRIES.filter(
              (c) =>
                c.continent !== "Antarctica" && c.code !== save.player.country,
            ).map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
          <Button
            disabled={!!issue || !country}
            onClick={() => {
              if (
                !confirmUI(
                  "Apply for a federation transfer? The $250 processing fee is non-refundable. Completion cancels and refunds entries restricted to your former federation.",
                )
              )
                return;
              const r = request(country);
              setMessage(
                r.ok
                  ? "Application submitted. Your current federation stays active during processing."
                  : r.error,
              );
            }}
          >
            Apply · $250
          </Button>
        </div>
      )}
      {!state.transfer && issue && (
        <p className="mt-2 text-xs text-ink-muted">{issue}</p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-gold-300">
          {message}
        </p>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        Completed transfers move your home to the new federation's capital,
        reset membership and refund incompatible national entries. Your existing
        games, titles, Elo and birthplace remain in your history.
      </p>
    </Card>
  );
}
export function AdvanceToEvent({
  eventId,
  name,
  ready = false,
}: {
  eventId: string;
  name: string;
  ready?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [ids, setIds] = useState<string[]>(["tactics-puzzle"]),
    [report, setReport] = useState<CalendarAdvanceReport | null>(null),
    [error, setError] = useState("");
  const advance = useGameStore((s) => s.simulateUntil);
  return (
    <>
      <Button
        variant="secondary"
        disabled={ready}
        onClick={() => setOpen(true)}
      >
        {ready ? "Date reached" : "Simulate until tournament"}
      </Button>
      {open && (
        <Modal
          open
          title={`Plan the days before ${name}`}
          onClose={() => setOpen(false)}
          size="lg"
        >
          <p className="mb-3 text-sm text-ink-muted">
            Choose sessions to attempt once each day, in the order below. Normal
            costs, requirements and fatigue apply. Blocked sessions are skipped;
            you also rest on your own when too exhausted and with any hours
            left over. Leave every box empty to rest. Stops for your earliest registered event so you do not miss
            it.
          </p>
          <div className="max-h-72 space-y-2 overflow-auto">
            {[
              ...AUTO_REST.map((r) => ({
                id: r.id,
                name: restInfo(r.kind).label,
                hours: restInfo(r.kind).hours,
                ap: 0,
                money: 0,
              })),
              ...AUTO_TRAINING,
            ].map((d) => (
              <label
                key={d.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg bg-navy-900 p-3 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={ids.includes(d.id)}
                  onChange={(e) =>
                    setIds((prev) =>
                      e.target.checked
                        ? [...prev, d.id]
                        : prev.filter((id) => id !== d.id),
                    )
                  }
                />
                <span>
                  {d.name}
                  <span className="block text-xs text-ink-muted">
                    {d.hours}h · {d.ap} AP · ${d.money}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                setOpen(false);
                setReport(null);
                const chosen = [...AUTO_REST, ...AUTO_TRAINING]
                  .filter((d) => ids.includes(d.id))
                  .map((d) => d.id);
                const r = await advance(eventId, chosen);
                if (r.ok) {
                  setReport(r.report);
                  setError("");
                } else setError(r.error);
              }}
            >
              Confirm & simulate
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
      {report && (
        <p role="status" className="mt-2 text-xs text-ink-muted">
          {report.cancelled ? "Stopped" : "Ready"} after {report.days} days ·{" "}
          {report.trained} sessions completed · {report.skipped} skipped ·{" "}
          {report.stoppedFor}
          {report.notes.length > 0 && (
            <span className="mt-1 block">{report.notes.join(" / ")}</span>
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </>
  );
}
export function CalendarProgressDialog() {
  const progress = useGameStore((s) => s.calendarProgress),
    cancel = useGameStore((s) => s.cancelCalendar);
  if (!progress) return null;
  return (
    <Modal open title="Advancing your calendar" onClose={cancel}>
      <p role="status" aria-live="polite" className="text-sm text-ink">
        {progress.days} / {progress.total} days · {progress.target}
      </p>
      <progress
        className="my-4 w-full accent-[var(--accent)]"
        value={progress.days}
        max={Math.max(1, progress.total)}
      />
      <p className="mb-3 text-xs text-ink-muted">
        Completed days are saved. Cancel stops after the current day.
      </p>
      <Button variant="secondary" onClick={cancel}>
        Stop simulation
      </Button>
    </Modal>
  );
}
