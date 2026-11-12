import { confirmUI } from "@/i18n/translate";
import { UpcomingPredictions } from "@/features/prediction/CareerPrediction";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { SectionMenu } from "@/components/ui/SectionMenu";
import { useSave } from "@/hooks/useGame";
import { useNpcs } from "@/hooks/useNpcs";
import { useGameStore } from "@/store/gameStore";
import { useMatchRunning } from "@/store/matchLocks";
import { useOpeningDb } from "@/store/openingStore";
import { buildMatchSetup } from "@/game/match/setup";
import type { MatchSetup } from "@/game/match/session";
import { dayLabel, gameDay, hhmm, roundSlot } from "@/game/competition/agenda";
import {
  esportsOf,
  esportsEntryIssue,
  esportsStandings,
  esportsRoundDay,
  nextEsportsGame,
  recruitmentChance,
  teamRating,
} from "@/game/esports/core";
import {
  ESPORTS_TIERS,
  ESPORTS_REFERENCES,
  ORGANIZATIONS,
  esportsEvents,
  esportsTier,
} from "@/game/esports/catalog";
import type {
  CareerFocus,
  EsportsCommand,
  EsportsCompetition,
} from "@/game/esports/types";
import { AdvanceToEvent } from "@/features/qol/CareerPanels";
import { getCountry } from "@/data/world/countries";
import { NpcProfileModal } from "@/features/world/NpcProfileModal";
import type { Npc } from "@/types";

function DailyPlan({
  competition,
  event,
}: {
  competition?: EsportsCompetition;
  event: import("@/game/esports/types").EsportsEvent;
}) {
  const days = Array.from({ length: event.days }, (_, i) => ({
    day: i + 1,
    rounds: [1, 2, 3].filter((r) => roundSlot(r, 3, event.days, 30).day === i),
  }));
  return (
    <details className="mt-3 text-xs" data-testid="esports-daily-plan">
      <summary className="cursor-pointer text-gold-300">
        {event.days === 1 ? "Single day" : `${event.days} days`} · daily games &
        times
      </summary>
      <table className="mt-2 w-full text-left text-ink-muted">
        <thead>
          <tr>
            <th>Day</th>
            <th>Your games</th>
            <th>Team board games</th>
            <th>Times</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td className="py-1">{d.day}</td>
              <td>{d.rounds.length}</td>
              <td>{d.rounds.length * event.size}</td>
              <td>
                {d.rounds.length
                  ? d.rounds
                      .map((r) => hhmm(roundSlot(r, 3, event.days, 30).minute))
                      .join(", ")
                  : "Rest day"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-ink-faint">
        One game per teammate per fixture, on parallel boards. Three team
        fixtures; chess clocks remain separate from the itinerary.
      </p>
    </details>
  );
}
function TeamResults({ competition: c }: { competition: EsportsCompetition }) {
  return (
    <>
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[420px] text-left text-sm"
          data-testid="esports-standings"
        >
          <thead>
            <tr className="text-ink-faint">
              {["#", "Team", "Match pts", "Board pts", "W / D / L"].map((h) => (
                <th key={h} className="py-2 pr-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {esportsStandings(c).map((r, i) => (
              <tr
                key={r.team.id}
                className={
                  r.team.members.some((m) => m.id === "player")
                    ? "text-gold-300"
                    : "text-ink-muted"
                }
              >
                <td className="py-2">{i + 1}</td>
                <td className="pr-2">{r.team.name}</td>
                <td>{r.points}</td>
                <td>{r.boardPoints}</td>
                <td>
                  {r.wins} / {r.draws} / {r.losses}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Team fixture win 3 points, draw 1. Ties: board points, team ID.
      </p>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-gold-300">
          Fixtures & all board results
        </summary>
        <div className="max-h-80 space-y-3 overflow-auto pt-3">
          {c.rounds.map((fixtures, i) => (
            <div key={i}>
              <h4 className="font-semibold text-ink">Round {i + 1}</h4>
              {fixtures.map((f) => (
                <div key={f.id} className="mt-2 rounded bg-navy-900 p-2">
                  <p className="text-ink">
                    {c.teams.find((t) => t.id === f.home)?.name} —{" "}
                    {c.teams.find((t) => t.id === f.away)?.name}
                  </p>
                  {f.boards.map((b, j) => (
                    <p key={j} className="mt-1 text-ink-muted">
                      Board {j + 1}: {b.white.name} — {b.black.name} ·{" "}
                      <span
                        className={
                          b.result === 1
                            ? "text-emerald-300"
                            : b.result === 0
                              ? "text-red-300"
                              : "text-ink-muted"
                        }
                      >
                        {b.result === null
                          ? "Upcoming"
                          : `${b.result} – ${1 - b.result}`}
                      </span>
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </details>
    </>
  );
}
export function EsportsPanel({
  onStart,
}: {
  onStart: (setup: MatchSetup) => void;
}) {
  const navigate = useNavigate();
  const save = useSave(),
    npcs = useNpcs(),
    db = useOpeningDb(),
    state = esportsOf(save),
    now = gameDay(save),
    running = useMatchRunning(save.career.id);
  const action = useGameStore((s) => s.esportsAction),
    advance = useGameStore((s) => s.advanceCompetitionDay);
  const [view, setView] = useState<"events" | "team" | "offers" | "history">(
      "events",
    ),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [teamName, setTeamName] = useState(""),
    [size, setSize] = useState<2 | 3>(2),
    [query, setQuery] = useState(""),
    [npcLimit, setNpcLimit] = useState(8),
    [selected, setSelected] = useState<Npc | null>(null);
  const [tier, setTier] = useState("all"),
    [cadence, setCadence] = useState("all"),
    [format, setFormat] = useState("all"),
    [status, setStatus] = useState("all"),
    [duration, setDuration] = useState("all"),
    [limit, setLimit] = useState(8),
    [available, setAvailable] = useState(false);
  const events = useMemo(
    () => esportsEvents(now, save.career.id),
    [now, save.career.id],
  );
  const run = (command: EsportsCommand) => {
    const r = action(command);
    setError(r.ok ? "" : r.error);
    setMessage(r.ok ? r.message : "");
  };
  const market = useMemo(
    () =>
      view !== "team" || !state.team?.owner
        ? []
        : npcs
            .filter(
              (n) =>
                ["active", "semi-retired"].includes(n.careerStatus) &&
                !state.team?.members.some((m) => m.id === n.id) &&
                `${n.name} ${getCountry(n.nationality)?.name ?? n.nationality}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            )
            .sort(
              (a, b) =>
                Math.abs(a.currentElo - save.player.rating) -
                Math.abs(b.currentElo - save.player.rating),
            ),
    [npcs, state.team, query, save.player.rating, view],
  );
  const filtered = events.filter(
    (e) =>
      (tier === "all" || e.tier === tier) &&
      (cadence === "all" || e.cadence === cadence) &&
      (format === "all" || e.size === Number(format)) &&
      (status === "all" || e.status === status) &&
      (duration === "all" ||
        (duration === "single" && e.days === 1) ||
        (duration === "multi" && e.days > 1)) &&
      (!available || esportsEntryIssue(save, e, npcs) === null),
  );
  const current = state.active,
    target = nextEsportsGame(save),
    opponent = target
      ? npcs.find((n) => n.id === target.opponent.id)
      : undefined;
  const play = (mode: "play" | "simulate") => {
    if (
      !current ||
      !target ||
      !opponent ||
      running ||
      esportsRoundDay(current) !== now
    )
      return;
    const setup = buildMatchSetup({
      save,
      npc: opponent,
      playerColor: target.color,
      timeControl: current.event.timeControl,
      rated: true,
      mode,
      speed: mode === "simulate" ? "fast" : "brisk",
      tournament: target.tournament,
      seed: Math.floor(Math.random() * 2 ** 31),
      db,
    });
    onStart({ ...setup, esports: target.context });
  };
  const select = (
    label: string,
    value: string,
    fn: (value: string) => void,
    options: { value: string; label: string }[],
  ) => (
    <label className="text-xs text-ink-muted">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => {
          fn(e.target.value);
          setLimit(8);
        }}
        className="mt-1 w-full rounded-lg bg-navy-900 p-3 text-sm text-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="space-y-4" data-testid="esports-panel">
      <UpcomingPredictions circuit="esports" />
      <Card>
        <CardTitle
          aside={
            <Badge tone="gold">
              {esportsTier(save.player.rating)
                ? `${esportsTier(save.player.rating)}-Tier`
                : "Unranked · qualifiers open"}
            </Badge>
          }
        >
          Esports Circuit
        </CardTitle>
        <p className="text-sm text-ink-muted">
          Duo and Trio teams, qualifiers, weekly cups and monthly finals. Play
          either circuit whenever your dates allow; your focus never locks the
          other path. Career Elo is shared; esports team standings and bookings
          are separate.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-ink-muted">
            Primary career focus
            <select
              aria-label="Primary career focus"
              value={state.focus}
              onChange={(e) =>
                run({ type: "focus", focus: e.target.value as CareerFocus })
              }
              className="mt-1 w-full rounded-lg bg-navy-900 p-3 text-ink"
            >
              <option value="mixed">Mixed · both circuits</option>
              <option value="traditional">Traditional tournaments</option>
              <option value="esports">Esports</option>
            </select>
          </label>
          <div className="rounded-lg bg-navy-900 p-3 text-sm text-ink">
            <p>{state.team ? state.team.name : "Free Agent"}</p>
            <p className="mt-1 text-xs text-ink-faint">
              {state.team
                ? `${state.team.size === 2 ? "Duo" : "Trio"} · ${state.team.members.length}/${state.team.size} players`
                : "Wait for offers, enter a pickup qualifier, or create your own team."}
            </p>
          </div>
        </div>
      </Card>
      <SectionMenu
        label="Esports sections"
        active={view}
        onChange={setView}
        items={[
          { id: "events", label: "Esports tournaments" },
          { id: "team", label: "My team" },
          { id: "offers", label: `Free Agency (${state.offers.length})` },
          { id: "history", label: "Esports history" },
        ]}
      />
      {(message || error) && (
        <p
          role={error ? "alert" : "status"}
          className={`rounded-lg bg-navy-900 p-3 text-sm ${error ? "text-red-300" : "text-gold-300"}`}
        >
          {error || message}
        </p>
      )}
      {view === "events" && (
        <>
          {current && (
            <Card>
              <CardTitle
                aside={
                  <Badge>
                    {current.status === "playing"
                      ? `Round ${current.round}/3`
                      : "Finished"}
                  </Badge>
                }
              >
                {current.event.name}
              </CardTitle>
              {current.status === "playing" && (
                <>
                  <p
                    className="my-3 text-sm text-ink"
                    data-testid="esports-current-time"
                  >
                    {dayLabel(esportsRoundDay(current))} ·{" "}
                    {hhmm(
                      roundSlot(current.round, 3, current.event.days, 30)
                        .minute,
                    )}{" "}
                    ·{" "}
                    {target
                      ? `Your opponent: ${target.opponent.name} (${target.opponent.elo})`
                      : "Waiting for results"}
                  </p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {esportsRoundDay(current) > now ? (
                      <Button
                        variant="secondary"
                        disabled={running}
                        onClick={() => {
                          const r = advance("esports");
                          if (!r.ok) setError(r.error);
                        }}
                      >
                        Advance to next esports match day
                      </Button>
                    ) : (
                      <>
                        <Button
                          disabled={!opponent || running}
                          onClick={() => play("play")}
                        >
                          Play esports game
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={!opponent || running}
                          onClick={() => play("simulate")}
                        >
                          Simulate esports game
                        </Button>
                      </>
                    )}
                    <Button
                      variant="danger"
                      disabled={running}
                      onClick={() =>
                        confirmUI(
                          "Withdraw from this esports event? Remaining fixtures are forfeited and no prize is awarded.",
                        ) && run({ type: "withdraw" })
                      }
                    >
                      Withdraw esports event
                    </Button>
                  </div>
                </>
              )}
              {current.status === "finished" && (
                <p className="my-3 text-sm text-gold-300">
                  Final rank #{current.rank} · Team prize ${current.teamPrize} ·
                  Your share ${current.playerPrize}
                  <Button
                    className="ml-3"
                    variant="secondary"
                    onClick={() => run({ type: "close" })}
                  >
                    Close esports results
                  </Button>
                </p>
              )}
              <TeamResults competition={current} />
              <DailyPlan event={current.event} />
            </Card>
          )}
          <Card>
            <CardTitle>Esports bookings</CardTitle>
            <div className="space-y-3" data-testid="esports-bookings">
              {!state.entries.length && (
                <p className="text-sm text-ink-muted">No esports bookings.</p>
              )}
              {state.entries.map((r) => (
                <div key={r.event.id} className="rounded-lg bg-navy-900 p-3">
                  <p className="font-semibold text-ink">{r.event.name}</p>
                  <p className="my-2 text-xs text-ink-muted">
                    {dayLabel(r.event.day)} · {r.team.name} ·{" "}
                    {r.event.size === 2 ? "Duo" : "Trio"} · fee paid $
                    {r.event.fee}
                    {now > r.event.day ? " · missed" : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {now <= r.event.day && (
                      <AdvanceToEvent
                        eventId={r.event.id}
                        name={r.event.name}
                        ready={now === r.event.day}
                      />
                    )}
                    {now === r.event.day && (
                      <Button
                        disabled={
                          running ||
                          save.tournament?.status === "playing" ||
                          current?.status === "playing"
                        }
                        onClick={() =>
                          run({ type: "start", eventId: r.event.id })
                        }
                      >
                        Start esports tournament
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      disabled={running}
                      onClick={() =>
                        run({ type: "cancel", eventId: r.event.id })
                      }
                    >
                      {now < r.event.day
                        ? "Cancel esports booking (refund)"
                        : "Remove esports booking"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardTitle>Find esports tournaments</CardTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              {select("Esports tier", tier, setTier, [
                { value: "all", label: "All tiers" },
                ...ESPORTS_TIERS.map((t) => ({
                  value: t.id,
                  label: `${t.id} · ${t.min}–${Number.isFinite(t.max) ? t.max : "3500+"}`,
                })),
              ])}
              {select("Esports cadence", cadence, setCadence, [
                { value: "all", label: "All schedules" },
                ...["Weekly", "Monthly", "Qualifier"].map((s) => ({
                  value: s,
                  label: s,
                })),
              ])}
              {select("Esports team format", format, setFormat, [
                { value: "all", label: "Duo & Trio" },
                { value: "2", label: "Duo · 2 players" },
                { value: "3", label: "Trio · 3 players" },
              ])}
              {select("Esports organizer status", status, setStatus, [
                { value: "all", label: "Official & Unofficial" },
                { value: "Official", label: "Official" },
                { value: "Unofficial", label: "Unofficial" },
              ])}
              {select("Esports duration", duration, setDuration, [
                { value: "all", label: "Any duration" },
                { value: "single", label: "Single day" },
                { value: "multi", label: "Multiple days" },
              ])}
            </div>
            <label className="my-4 flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={available}
                onChange={(e) => {
                  setAvailable(e.target.checked);
                  setLimit(8);
                }}
              />
              Only esports events I can enter now
            </label>
            <div className="space-y-4" data-testid="esports-events">
              {filtered.slice(0, limit).map((e) => {
                const issue = esportsEntryIssue(save, e, npcs);
                return (
                  <article
                    key={e.id}
                    data-esports-event={e.id}
                    className="rounded-xl border border-white/10 bg-navy-900 p-4"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <h3 className="font-semibold text-ink">{e.name}</h3>
                      <Badge tone="gold">
                        {e.tier}-Tier · {e.size === 2 ? "Duo" : "Trio"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-ink-muted">
                      {e.organizer} · {e.status} · {dayLabel(e.day)} · deadline{" "}
                      {dayLabel(e.deadline)} · {e.timeControl.label}
                    </p>
                    <p className="mt-2 text-sm text-ink">
                      Team entry ${e.fee} · prize pool $
                      {e.prize.toLocaleString()} · 4 teams · 3 fixtures
                    </p>
                    <p className="mt-2 text-xs text-ink-muted">
                      {issue ?? "Entry requirements met."}
                      {e.cadence === "Qualifier" &&
                        " · Top two teams earn a same-tier monthly finals pass for 42 days."}
                      {e.cadence === "Monthly" &&
                        " · A valid same-tier qualifier pass is required."}
                    </p>
                    <DailyPlan event={e} />
                    <Button
                      className="mt-3"
                      data-testid="register-esports"
                      disabled={!!issue || running}
                      onClick={() => run({ type: "register", eventId: e.id })}
                    >
                      {state.entries.some((r) => r.event.id === e.id)
                        ? "Team registered"
                        : !state.team && e.cadence === "Qualifier"
                          ? "Enter with pickup squad"
                          : "Register esports team"}
                    </Button>
                  </article>
                );
              })}
            </div>
            {!filtered.length && (
              <p className="text-sm text-ink-muted">
                No matching esports events in the next 13 weeks.
              </p>
            )}
            {filtered.length > limit && (
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => setLimit((n) => n + 8)}
              >
                Show more esports tournaments ({filtered.length - limit})
              </Button>
            )}
          </Card>
        </>
      )}
      {view === "team" && (
        <>
          {!state.team ? (
            <Card>
              <CardTitle>Form your own team</CardTitle>
              <p className="mb-3 text-sm text-ink-muted">
                Create a club for $100, then invite NPC teammates. Invitations
                can be refused; the same player can be approached again after 14
                days.
              </p>
              <div className="flex flex-wrap gap-3">
                <input
                  aria-label="Esports team name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  maxLength={40}
                  placeholder="Your team name"
                  className="min-w-0 flex-1 rounded-lg bg-navy-900 p-3 text-sm text-ink"
                />
                <select
                  aria-label="Create team format"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value) as 2 | 3)}
                  className="rounded-lg bg-navy-900 p-3 text-ink"
                >
                  <option value={2}>Duo · 2 players</option>
                  <option value={3}>Trio · 3 players</option>
                </select>
                <Button
                  disabled={
                    running || !teamName.trim() || save.player.money < 100
                  }
                  onClick={() =>
                    run({ type: "create-team", name: teamName, size })
                  }
                >
                  Create team · $100
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <CardTitle
                aside={
                  <Badge>
                    {state.team.owner ? "Owner / captain" : "Contract player"}
                  </Badge>
                }
              >
                {state.team.name}
              </CardTitle>
              <p className="mb-3 text-sm text-ink-muted">
                {state.team.members.length}/{state.team.size} · average Elo{" "}
                {Math.round(teamRating(state.team))}
                {state.team.contractEnd !== undefined
                  ? ` · contract ends ${dayLabel(state.team.contractEnd)} · salary $${state.team.salary}/week`
                  : ""}
              </p>
              <ul className="space-y-2">
                {state.team.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-navy-900 p-3 text-sm text-ink"
                  >
                    <button
                      type="button"
                      className="text-left underline underline-offset-4"
                      onClick={() =>
                        m.id === "player"
                          ? navigate("/profile")
                          : setSelected(npcs.find((n) => n.id === m.id) ?? null)
                      }
                    >
                      {m.id === "player" ? `${save.player.name} (you)` : m.name}{" "}
                      · {m.id === "player" ? save.player.rating : m.elo}
                    </button>
                    {state.team?.owner && m.id !== "player" && (
                      <Button
                        variant="secondary"
                        disabled={
                          running ||
                          !!state.entries.length ||
                          current?.status === "playing"
                        }
                        onClick={() => run({ type: "release", npcId: m.id })}
                      >
                        Release
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4"
                variant="danger"
                disabled={
                  running ||
                  !!state.entries.length ||
                  current?.status === "playing"
                }
                onClick={() =>
                  confirmUI(
                    state.team?.owner
                      ? "Dissolve your team? The creation fee is not refunded."
                      : "Leave this team and end your contract?",
                  ) && run({ type: "leave-team" })
                }
              >
                {state.team.owner ? "Dissolve team" : "Leave organization"}
              </Button>
            </Card>
          )}
          {state.team?.owner && (
            <Card>
              <CardTitle>Recruit teammates</CardTitle>
              <input
                aria-label="Search esports recruits"
                placeholder="Search name or country…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setNpcLimit(8);
                }}
                className="mb-3 w-full rounded-lg bg-navy-900 p-3 text-sm text-ink"
              />
              <ul className="space-y-2">
                {market.slice(0, npcLimit).map((n) => {
                  const attempt = state.recruitAttempts.find(
                      (a) => a.npcId === n.id && now - a.day < 14,
                    ),
                    chance = recruitmentChance(save, n);
                  return (
                    <li
                      key={n.id}
                      data-npc-id={n.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-navy-900 p-3"
                    >
                      <button
                        className="text-left text-sm text-ink"
                        type="button"
                        onClick={() => setSelected(n)}
                      >
                        {getCountry(n.nationality)?.flag}{" "}
                        <span translate="no">{n.name}</span>
                        <span className="block text-xs text-ink-faint">
                          Elo {n.currentElo} · form {n.form} · {n.style}
                        </span>
                      </button>
                      <Button
                        variant="secondary"
                        disabled={
                          running ||
                          !!attempt ||
                          chance === 0 ||
                          state.entries.length > 0 ||
                          state.team!.members.length >= state.team!.size ||
                          current?.status === "playing"
                        }
                        onClick={() => run({ type: "recruit", npcId: n.id })}
                      >
                        {attempt
                          ? `Try again in ${14 - now + attempt.day} days`
                          : chance === 0
                            ? "Unavailable"
                            : `Invite ${n.name}`}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {market.length > npcLimit && (
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() => setNpcLimit((n) => n + 12)}
                >
                  Show more recruits
                </Button>
              )}
            </Card>
          )}
        </>
      )}
      {view === "offers" && (
        <>
          <Card>
            <CardTitle>
              {state.team ? "Your organization" : "Free Agent · team offers"}
            </CardTitle>
            <p className="mb-3 text-sm text-ink-muted">
              Clubs scout weekly. At least three esports games, the club's Elo
              requirement and recent form matter. Global elite clubs require ten
              games and strong form; their offers are very rare. You can
              continue traditional tournaments while waiting.
            </p>
            {!state.offers.length && (
              <p className="text-sm text-ink">
                No current offers. Play qualifiers or weekly events and advance
                the career calendar.
              </p>
            )}
            <div className="space-y-3">
              {state.offers.map((o) => {
                const org = ORGANIZATIONS.find(
                  (g) => g.id === o.organizationId,
                )!;
                return (
                  <div
                    key={o.id}
                    className="rounded-lg bg-navy-900 p-3 text-sm text-ink"
                  >
                    <p className="font-semibold">
                      {org.name} · {o.size === 2 ? "Duo" : "Trio"}
                    </p>
                    <p className="my-2 text-xs text-ink-muted">
                      12-week contract · ${org.salary}/week · expires{" "}
                      {dayLabel(o.expires)} · minimum {org.min} Elo
                    </p>
                    <Button
                      disabled={running || !!state.team || now > o.expires}
                      onClick={() =>
                        run({ type: "accept-offer", offerId: o.id })
                      }
                    >
                      Accept {org.name} offer
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card>
            <CardTitle>Organization directory</CardTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              {ORGANIZATIONS.map((o) => (
                <div
                  key={o.id}
                  className="rounded-lg bg-navy-900 p-3 text-sm text-ink"
                >
                  {o.name}
                  <p className="mt-1 text-xs text-ink-muted">
                    {o.min}+ Elo · prestige {o.prestige}/100 ·{" "}
                    {o.prestige >= 90 ? "Global elite" : "Pro club"}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
      {view === "history" && (
        <Card>
          <CardTitle>Esports event history</CardTitle>
          {!state.history.length && (
            <p className="text-sm text-ink-muted">
              Completed esports events appear here separately from traditional
              tournaments.
            </p>
          )}
          {[...state.history].reverse().map((c) => (
            <details
              key={c.event.id}
              className="mb-3 rounded-lg bg-navy-900 p-3"
            >
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                {c.event.name} · #{c.rank} · your prize ${c.playerPrize}
                {c.withdrawn ? " · withdrawn" : ""}
              </summary>
              <TeamResults competition={c} />
            </details>
          ))}
          <p className="mt-3 text-xs text-ink-faint">
            Actual played boards can be replayed in Tournament → History. Team
            prize money is split equally among the squad.
          </p>
        </Card>
      )}
      <details className="rounded-lg bg-navy-800 p-3 text-xs text-ink-muted">
        <summary className="cursor-pointer">Circuit tiers & references</summary>
        <p className="my-2">
          This is a fictional team circuit inspired by the event categories
          below. Elo bands and Duo/Trio formats are career rules, not Liquipedia
          classification rules.
        </p>
        <p>
          D 1800–2000 · C 2001–2200 · B 2201–2500 · A 2501–2699 · S 2700+. D
          qualifiers also admit developing players below 1800.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          {ESPORTS_REFERENCES.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {r.name}
            </a>
          ))}
        </div>
      </details>
      <NpcProfileModal npc={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
export function EsportsHomeCard() {
  const save = useSave(),
    state = esportsOf(save);
  return (
    <Card className="mb-4">
      <CardTitle>
        Career focus ·{" "}
        {state.focus === "mixed"
          ? "Both circuits"
          : state.focus === "esports"
            ? "Esports"
            : "Traditional tournaments"}
      </CardTitle>
      <p className="text-sm text-ink-muted">
        {state.team
          ? `${state.team.name} · ${state.team.size === 2 ? "Duo" : "Trio"}`
          : "Free Agent"}{" "}
        · {state.offers.length} team offers · {state.entries.length} esports
        bookings
      </p>
      <Link
        to="/complete?circuit=esports"
        className="mt-3 inline-block text-sm font-semibold text-gold-300 underline"
      >
        Open Esports Circuit
      </Link>
    </Card>
  );
}
