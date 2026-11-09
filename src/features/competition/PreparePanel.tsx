import { dayStamp } from "@/game/competition/agenda";
import { playerOpponentId } from "@/game/match/tournament";
import { nextEsportsGame } from "@/game/esports/core";
import { CareerPredictionPanel } from "@/features/prediction/CareerPrediction";
import { RepertoirePicker } from "@/features/qol/RepertoirePicker";
import { useMemo, useState } from "react";
import { Button, Card, CardTitle, Tabs } from "@/components/ui";
import { WorldHub } from "@/features/expansion/WorldHub";
import { useSave } from "@/hooks/useGame";
import { useNpcs } from "@/hooks/useNpcs";
import { useGameStore } from "@/store/gameStore";
import { useOpeningDb } from "@/store/openingStore";
import {
  competitionOf,
  APPROACHES,
  DECISIONS,
  PREP_COST,
} from "@/game/competition/preparation";
import { stampIndex, dateLabel } from "@/game/competition/catalog";
import { getBookOpening } from "@/data/chess/openingBook";
import type { EventRepertoire } from "@/game/competition/types";

const repertoireGroups: {
  key: keyof EventRepertoire;
  label: string;
  first?: string;
}[] = [
  { key: "white", label: "White repertoire" },
  { key: "black", label: "Black repertoire" },
  { key: "vs-e4", label: "Response to 1.e4", first: "e4" },
  { key: "vs-d4", label: "Response to 1.d4", first: "d4" },
  { key: "vs-c4", label: "Response to 1.c4", first: "c4" },
  { key: "vs-nf3", label: "Response to 1.Nf3", first: "Nf3" },
  { key: "backups", label: "Backup variations" },
];
export function PreparePanel() {
  const save = useSave(),
    npcs = useNpcs(),
    db = useOpeningDb(),
    state = competitionOf(save);
  const configure = useGameStore((s) => s.configureCompetition),
    prepare = useGameStore((s) => s.prepareCompetition),
    scout = useGameStore((s) => s.scoutCompetitionOpponent);
  const [tab, setTab] = useState<
      "preparation" | "scout" | "plan" | "repertoire"
    >("preparation"),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [selectedNpc, setSelectedNpc] = useState(""),
    [search, setSearch] = useState("");
  const available = [
    ...(save.tournament?.status === "playing"
      ? [
          {
            id: save.tournament.eventId,
            name: save.tournament.name,
            time: save.tournament.timeControl.category,
            type: save.tournament.details?.category ?? "tournament",
            round: save.tournament.round,
            rounds: save.tournament.rounds,
            year: save.tournament.year,
            week: save.tournament.week,
            ids: save.tournament.players
              .filter((p) => !p.isPlayer)
              .map((p) => p.id),
          },
        ]
      : []),
    ...save.registrations
      .filter(
        (r) =>
          r.details?.format !== "team" &&
          stampIndex(r) >= stampIndex(save.world.date),
      )
      .map((r) => ({
        id: r.eventId,
        name: r.name,
        time: r.details?.timeControl.category ?? "classical",
        type: r.details?.category ?? "tournament",
        round: undefined,
        rounds: undefined,
        year: r.year,
        week: r.week,
        ids: r.entrantIds ?? [],
      })),
    ...(save.esports?.active?.status === "playing"
      ? [
          {
            id: save.esports.active.event.id,
            name: save.esports.active.event.name,
            year: dayStamp(save.esports.active.event.day).year,
            week: dayStamp(save.esports.active.event.day).week,
            time: save.esports.active.event.timeControl.category,
            type: "esports",
            round: save.esports.active.round,
            rounds: 3,
            ids: save.esports.active.teams
              .filter((t) => !t.members.some((m) => m.id === "player"))
              .flatMap((t) => t.members.map((m) => m.id)),
          },
        ]
      : []),
    ...(save.esports?.entries ?? [])
      .filter((e) => e.event.id !== save.esports?.active?.event.id)
      .map((e) => ({
        id: e.event.id,
        name: e.event.name,
        year: dayStamp(e.event.day).year,
        week: dayStamp(e.event.day).week,
        time: e.event.timeControl.category,
        type: "esports",
        round: undefined,
        rounds: 3,
        ids: [] as string[],
      })),
  ];
  const target = available.find((e) => e.id === state.target) ?? available[0];
  const fieldIds = target?.ids ?? [];
  const field = useMemo(() => {
    const ids = new Set(fieldIds);
    return npcs.filter((n) => ids.has(n.id));
  }, [npcs, fieldIds.join("|")]);
  const paired =
    target && save.tournament?.eventId === target.id
      ? playerOpponentId(save.tournament)
      : target && save.esports?.active?.event.id === target.id
        ? (() => {
            const g = nextEsportsGame(save);
            return g ? { id: g.opponent.id, color: g.color } : null;
          })()
        : null;
  const npc =
    field.find((n) => n.id === selectedNpc) ??
    field.find((n) => n.id === paired?.id) ??
    field[0];
  const report = state.scouts.find(
    (s) => s.eventId === target?.id && s.npcId === npc?.id,
  );
  const cost = PREP_COST[state.plan.decision],
    prepared = state.prepared?.eventId === target?.id ? state.prepared : null;
  const dirty =
    prepared &&
    (JSON.stringify(prepared.plan) !== JSON.stringify(state.plan) ||
      JSON.stringify(prepared.repertoire) !== JSON.stringify(state.repertoire));
  const result = (
    r: { ok: true } | { ok: false; error: string },
    success: string,
  ) => {
    setFailed(!r.ok);
    setMessage(r.ok ? success : r.error);
  };
  const setList = (key: keyof EventRepertoire, ids: string[]) =>
    configure({ repertoire: { ...state.repertoire, [key]: ids } });
  const found = useMemo(
    () =>
      db.entries.filter((e) =>
        `${e.eco} ${e.name}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [db, search],
  );
  const historical = save.matches
    .filter((m) => m.setup.white.id === npc?.id || m.setup.black.id === npc?.id)
    .slice(-8)
    .reverse();
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Tournament preparation</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-ink-muted">
            Upcoming tournament
            <select
              aria-label="Preparation tournament"
              className="mt-2 w-full rounded-lg bg-navy-900 p-3 text-sm text-ink"
              value={target?.id ?? ""}
              onChange={(e) => {
                configure({ target: e.target.value });
                setSelectedNpc("");
                setMessage("");
              }}
            >
              {!target && (
                <option value="">Register for a tournament first</option>
              )}
              {available.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {dateLabel(e)}
                </option>
              ))}
            </select>
          </label>
          <p className="self-end pb-2 text-sm text-ink-muted">
            {save.player.ap.current} AP · ${save.player.money} ·{" "}
            {Math.max(0, 8 - save.training.hoursUsedToday)} hours left today
          </p>
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          Settings are drafts. Complete preparation to apply the saved plan and
          repertoire to this event. Human moves remain under your control.
          National team cups use their separate simulation; esports prepares
          each board individually.
        </p>
      </Card>
      {npc && target && (
        <CareerPredictionPanel
          opponent={npc}
          chooseColor
          options={{
            color: paired?.color ?? "unknown",
            timeControl: target.time,
            eventId: target.id,
            eventName: target.name,
            tournamentType: target.type,
            round: target.round,
            rounds: target.rounds,
          }}
        />
      )}
      <Tabs
        label="Preparation sections"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "preparation", label: "Preparation" },
          { id: "scout", label: "Scout Opponent" },
          { id: "plan", label: "Game Plan" },
          { id: "repertoire", label: "Repertoire" },
        ]}
      >
        {tab === "preparation" && (
          <div className="space-y-4">
            <Card>
              <CardTitle>Preparation</CardTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-ink">
                    {state.plan.approach} · {state.plan.decision}
                  </p>
                  <p className="mt-2 text-sm text-ink-muted">
                    Cost: {cost.ap} AP · ${cost.money} · {cost.hours} in-game
                    hour{cost.hours > 1 ? "s" : ""}. Prepare up to {cost.depth}{" "}
                    half-moves in selected opening lines.
                  </p>
                  <p className="mt-2 text-xs text-ink-faint">
                    Adds fatigue (2 per hour). Preparation remains available for
                    this event. A scouting report costs 1 AP, $10 and 1 hour for
                    each opponent.
                  </p>
                </div>
                <div className="rounded-lg bg-navy-900 p-3">
                  <p className="text-sm text-gold-400">
                    {prepared
                      ? "Prepared snapshot available"
                      : "No preparation for this event"}
                  </p>
                  {prepared && (
                    <p className="mt-2 text-xs text-ink-muted">
                      {prepared.plan.approach} · {prepared.plan.decision} ·
                      depth {prepared.depth}
                      {dirty
                        ? " · Your draft has changed; prepare again to apply changes."
                        : ""}
                    </p>
                  )}
                  <Button
                    className="mt-3"
                    disabled={!target}
                    onClick={() => {
                      if (!target) return;
                      configure({ target: target.id });
                      result(
                        prepare(db),
                        "Preparation completed. The paid plan is now active for this event.",
                      );
                    }}
                  >
                    Prepare for tournament
                  </Button>
                </div>
              </div>
              <details className="mt-4 text-xs text-ink-muted">
                <summary className="cursor-pointer text-gold-400">
                  How qualifications are earned
                </summary>
                <p className="mt-2">
                  Win an Open → Grand Swiss; national top 3 → Continental;
                  continental top 3 → World Cup and Grand Swiss; World Cup or
                  Grand Swiss top 2 → Candidates; win Candidates → World
                  Championship. An international top 3 earns a super-tournament
                  invitation. Qualifications remain valid through two following
                  calendar years. Title, Elo and league conditions still apply.
                </p>
              </details>
              {state.qualifications.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-ink-muted">
                  {state.qualifications.map((q, i) => (
                    <li key={i}>
                      {q.kind} · earned {q.year} in {q.source} ·{" "}
                      {q.year < save.world.date.year - 2
                        ? "expired"
                        : `valid through ${q.year + 2}`}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <details>
              <summary className="cursor-pointer rounded-lg bg-navy-800 p-3 text-sm text-gold-400">
                Coach contracts
              </summary>
              <div className="mt-3">
                <WorldHub view="coach" />
              </div>
            </details>
          </div>
        )}
        {tab === "plan" && (
          <Card>
            <CardTitle>Game Plan</CardTitle>
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Approach
              </legend>
              <div className="flex flex-wrap gap-2">
                {APPROACHES.map((a) => (
                  <Button
                    key={a}
                    variant={
                      a === state.plan.approach ? "primary" : "secondary"
                    }
                    aria-pressed={a === state.plan.approach}
                    onClick={() =>
                      configure({ plan: { ...state.plan, approach: a } })
                    }
                  >
                    {a}
                  </Button>
                ))}
              </div>
            </fieldset>
            <p className="my-3 text-xs text-ink-muted">
              Rock Solid favours king safety and defence; Careful favours quiet
              moves; Balanced stays neutral; Ambitious favours dynamic pawn
              play; All Out Attacks favours checks and captures among sound
              candidates. These preferences do not add rating or guarantee wins.
            </p>
            <fieldset className="mt-5">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Cloud usage
              </legend>
              <div className="flex flex-wrap gap-2">
                {DECISIONS.map((d) => (
                  <Button
                    key={d}
                    variant={
                      d === state.plan.decision ? "primary" : "secondary"
                    }
                    aria-pressed={d === state.plan.decision}
                    onClick={() =>
                      configure({ plan: { ...state.plan, decision: d } })
                    }
                  >
                    {d}
                  </Button>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                Local simulation settings; no external cloud service is used.
                Play Fast uses 65% decision/search time and 4-ply preparation;
                Normal uses 100% and 8-ply; Think Deeply uses 150% and 12-ply.
                Deeper thinking also spends more game-clock time.
              </p>
            </fieldset>
            <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                role="switch"
                checked={state.plan.earlyDraw}
                onChange={(e) =>
                  configure({
                    plan: { ...state.plan, earlyDraw: e.target.checked },
                  })
                }
                className="h-5 w-5 accent-amber-400"
              />
              Accept Early Draw
            </label>
            <p className="mt-2 text-xs text-ink-muted">
              During simulated tournament play, accepts a mutually reasonable
              draw from move 11 in an equal position (within 25 cp) when you
              lead or share the lead in the last two rounds. A stubborn opponent
              may refuse. Manual play keeps the existing draw controls.
            </p>
            <p className="mt-4 text-xs text-gold-400">
              Draft saved. Use Preparation to pay and apply it.
            </p>
          </Card>
        )}
        {tab === "repertoire" && (
          <Card>
            <CardTitle>Repertoire</CardTitle>
            <p className="mb-3 text-xs text-ink-muted">
              Up to eight lines per group. Higher lines have priority. Backups
              are tried when primary lines do not match the moves played.
              Opening choices are real legal SAN lines from the opening
              database.
            </p>
            <input
              aria-label="Search preparation openings"
              placeholder="Find an opening by name or ECO…"
              className="mb-4 w-full rounded-lg bg-navy-900 p-3 text-sm text-ink"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {repertoireGroups.map((group) => {
                return (
                  <section
                    key={group.key}
                    className="min-w-0 rounded-lg bg-navy-900 p-3"
                  >
                    <h3 className="mb-2 text-sm font-semibold text-ink">
                      {group.label}
                    </h3>
                    <ol className="mb-2 space-y-2">
                      {state.repertoire[group.key].map((id, i, ids) => (
                        <li
                          key={id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted"
                        >
                          <span className="min-w-0 flex-1 break-words">
                            {i + 1}.{" "}
                            {db.byId.get(id)?.name ?? "Removed opening"}
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="min-h-9 min-w-9 rounded bg-navy-700"
                              disabled={!i}
                              aria-label={`Move ${db.byId.get(id)?.name} up in ${group.label}`}
                              onClick={() => {
                                const next = [...ids];
                                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                                setList(group.key, next);
                              }}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="min-h-9 min-w-9 rounded bg-navy-700"
                              aria-label={`Remove ${db.byId.get(id)?.name} from ${group.label}`}
                              onClick={() =>
                                setList(
                                  group.key,
                                  ids.filter((x) => x !== id),
                                )
                              }
                            >
                              ×
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <RepertoirePicker
                      db={db}
                      label={group.label}
                      query={search}
                      first={group.first}
                      side={
                        group.key === "white"
                          ? "white"
                          : group.key === "black"
                            ? "black"
                            : undefined
                      }
                      exclude={state.repertoire[group.key]}
                      disabled={state.repertoire[group.key].length >= 8}
                      onPick={(id) =>
                        setList(group.key, [...state.repertoire[group.key], id])
                      }
                    />
                  </section>
                );
              })}
            </div>
          </Card>
        )}
        {tab === "scout" && (
          <Card>
            <CardTitle>Scout Opponent</CardTitle>
            <p className="mb-3 text-xs text-ink-muted">
              Choose from the registered field. One report per opponent and
              tournament; costs 1 AP, $10 and 1 in-game hour. Public information
              is available immediately.
            </p>
            <select
              aria-label="Scout opponent"
              className="mb-4 w-full rounded-lg bg-navy-900 p-3 text-sm text-ink"
              value={npc?.id ?? ""}
              onChange={(e) => setSelectedNpc(e.target.value)}
            >
              {!npc && <option value="">No announced opponents</option>}
              {field.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} · {n.currentElo} Elo
                </option>
              ))}
            </select>
            {npc && (
              <>
                <h3 className="font-semibold text-ink">{npc.name}</h3>
                <p className="my-2 text-sm text-ink-muted">
                  Elo {npc.currentElo} · Playing style: {npc.style} ·{" "}
                  {npc.title} · {npc.careerStatus}
                </p>
                <Button
                  disabled={!!report || !target}
                  onClick={() =>
                    target &&
                    result(
                      scout(npc.id, target.id),
                      "Scouting report unlocked and stored for this event.",
                    )
                  }
                >
                  {report
                    ? "Report available"
                    : "Investigate opponent · 1 AP / $10 / 1h"}
                </Button>
                {report && (
                  <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-ink-faint">
                        Favorite openings
                      </dt>
                      <dd className="mt-1 text-ink">
                        {npc.preferredOpenings
                          .map((id) => getBookOpening(id)?.name ?? id)
                          .join(", ") || "No recorded preference"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-faint">Recent form</dt>
                      <dd className="mt-1 text-ink">
                        Form index {npc.form}/100 · Morale {npc.morale}/100
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-faint">Strengths</dt>
                      <dd className="mt-1 text-ink">
                        {npc.strengths.join(", ") || "No recorded specialty"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-faint">Weaknesses</dt>
                      <dd className="mt-1 text-ink">
                        {npc.weaknesses.join(", ") || "No recorded weakness"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-ink-faint">
                        Historical results · recorded career games against you
                      </dt>
                      <dd className="mt-2 text-ink">
                        {historical.length ? (
                          <ul className="space-y-1">
                            {historical.map((m) => (
                              <li key={m.id}>
                                {m.year} W{m.week} · Your result: {m.outcome} ·{" "}
                                {m.setup.tournament?.name ?? "Individual game"}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "No games recorded against you yet. No results are invented."
                        )}
                      </dd>
                    </div>
                  </dl>
                )}
              </>
            )}
          </Card>
        )}
      </Tabs>
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={`text-sm ${failed ? "text-red-300" : "text-gold-400"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
