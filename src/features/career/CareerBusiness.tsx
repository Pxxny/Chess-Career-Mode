import { useState } from "react";
import { Button, Card, CardTitle } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { useGameStore } from "@/store/gameStore";
import { SPONSORSHIPS } from "@/data/reputation";
import {
  sponsorsOf,
  sponsorProgress,
  legacyOf,
  legacyUnlocked,
  LEGACY_LABELS,
  type LegacyRole,
} from "@/game/career/business";
import {
  stampFromIndex,
  dateLabel,
  stampIndex,
} from "@/game/competition/catalog";
export function CareerBusiness() {
  const save = useSave(),
    state = sponsorsOf(save),
    legacy = legacyOf(save),
    progress = sponsorProgress(save),
    [error, setError] = useState(""),
    act = useGameStore((s) => s.careerAction);
  const run = (command: Parameters<typeof act>[0]) => {
    const r = act(command);
    setError(r.ok ? "" : r.error);
  };
  return (
    <div className="space-y-4" data-testid="career-business">
      {error && (
        <p className="text-red-300" role="alert">
          {error}
        </p>
      )}
      <Card data-testid="sponsorship-panel">
        <CardTitle>Sponsorship contracts</CardTitle>
        <p className="text-sm text-ink-muted">
          One contract at a time, lasting 12 weeks. Payment is every 4 weeks
          when you complete the activity targets. No payment for a missed
          target. A four-week cooldown follows cancellation or expiry.
        </p>
        {state.active && progress ? (
          <div className="mt-4 rounded-lg border border-gold-500/30 p-3">
            <p className="font-semibold">
              {SPONSORSHIPS.find((s) => s.id === state.active!.sponsorId)?.name}
            </p>
            <p className="mt-2 text-sm">
              Rated games: {progress.games} / {progress.needGames} · Training
              sessions: {progress.sessions} / 8
            </p>
            <p className="text-xs text-ink-muted">
              Next review: {dateLabel(stampFromIndex(state.active.nextPayment))}{" "}
              · Paid ${state.active.paid} · Missed {state.active.missed}
            </p>
            <Button
              className="mt-3"
              variant="secondary"
              onClick={() => run({ type: "cancel-sponsor" })}
            >
              Cancel contract
            </Button>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {SPONSORSHIPS.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-white/10 p-3 text-sm"
              >
                <p className="font-semibold">{s.name}</p>
                <p>
                  {s.minElo}+ Elo · Reputation {s.minReputation}+
                </p>
                <p>
                  ${s.monthly} / 4 weeks · {s.id === "brand" ? 12 : 6} rated
                  games + 8 training sessions
                </p>
                <Button
                  className="mt-2"
                  disabled={
                    save.player.rating < s.minElo ||
                    save.player.reputation < s.minReputation ||
                    stampIndex(save.world.date) < state.cooldownUntil
                  }
                  onClick={() => run({ type: "sponsor", id: s.id })}
                >
                  Sign contract
                </Button>
              </li>
            ))}
          </ul>
        )}
        {state.history.length > 0 && (
          <details className="mt-4 text-sm">
            <summary>Past contracts</summary>
            <ul>
              {state.history.map((c) => (
                <li key={c.id}>
                  {SPONSORSHIPS.find((s) => s.id === c.sponsorId)?.name} · $
                  {c.paid} · {c.missed} missed
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>
      <Card data-testid="legacy-panel">
        <CardTitle>Life beyond the peak</CardTitle>
        <p className="text-sm text-ink-muted">
          Keep competing or build a second career in chess. Roles unlock at age
          35, after ten seasons, or at a peak Elo of 2400. Changing role has a
          four-week cooldown.
        </p>
        <p className="mt-3 font-semibold">{LEGACY_LABELS[legacy.role]}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(LEGACY_LABELS).map(([id, label]) => (
            <Button
              key={id}
              variant="secondary"
              disabled={
                legacy.role === id || (id !== "active" && !legacyUnlocked(save))
              }
              onClick={() =>
                run({ type: "legacy-role", role: id as LegacyRole })
              }
            >
              {label}
            </Button>
          ))}
        </div>
        {legacy.role !== "active" && (
          <div className="mt-4">
            <p className="text-sm">
              {legacy.role === "mentor"
                ? "Run a group lesson and share your experience."
                : legacy.role === "commentator"
                  ? "Commentate a chess session for an audience."
                  : "Represent chess at a community event."}
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              Once per week · 2 AP · 2 hours · +6 fatigue · +1 reputation
            </p>
            <p className="text-sm">
              Income: $
              {legacy.role === "mentor"
                ? 40
                : legacy.role === "commentator"
                  ? 60
                  : 80}
            </p>
            <Button
              className="mt-3"
              disabled={legacy.lastServiceWeek >= stampIndex(save.world.date)}
              onClick={() => run({ type: "legacy-service" })}
            >
              Do weekly legacy activity
            </Button>
          </div>
        )}
        <p className="mt-3 text-sm">
          Weekly contributions: {legacy.services} / 12 for a legacy achievement
        </p>
      </Card>
    </div>
  );
}
