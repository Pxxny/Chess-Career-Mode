import { ChessTeamCanvas } from "./ChessTeamCanvas";
import { confirmUI } from "@/i18n/translate";
import { useMemo, useState } from "react";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { COUNTRIES, getCountry } from "@/data/world/countries";
import { useSave } from "@/hooks/useGame";
import { useNpcs } from "@/hooks/useNpcs";
import { useGameStore } from "@/store/gameStore";
import {
  activeCoach,
  COACHES,
  coachFee,
  dayIndex,
  cupKey,
  federationTeams,
  stateOf,
  type CoachTerm,
} from "@/game/career/expansion";
import {
  TEAM_EVENTS,
  resolveTeamEvent,
  teamInfoOf,
  teamSpec,
  type BoardSlot,
} from "@/data/chess/nationalTeamEvents";
import { buildEventTeams } from "@/game/competition/teamEvents";
import { teamEntryIssues } from "@/game/competition/teamEligibility";

const STANDINGS_SHOWN = 30;
const SLOT_LABEL: Record<BoardSlot, string> = {
  open: "Open boards",
  woman: "Women's boards",
  man: "Men's boards",
  "boy-u20": "Junior boy boards (U20)",
  "girl-u20": "Junior girl boards (U20)",
};
/** Quota text for mixed events, e.g. "Open boards: 2 · Women's boards: 2"; empty when every board is open. */
function slotSummary(
  slots: BoardSlot[] | undefined,
  boards: number,
): string[] {
  if (!slots) return [];
  const counts = new Map<BoardSlot, number>();
  for (let i = 0; i < boards; i++) {
    const slot = slots[i] ?? "open";
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }
  return [...counts].map(([slot, n]) => `${SLOT_LABEL[slot]}: ${n}`);
}

export function WorldHub({
  view,
}: {
  view: "federation" | "teams" | "coach" | "news";
}) {
  const save = useSave(),
    npcs = useNpcs(),
    state = stateOf(save);
  const join = useGameStore((s) => s.joinFederation),
    play = useGameStore((s) => s.playTeamCup),
    hire = useGameStore((s) => s.hireCoach),
    cancel = useGameStore((s) => s.cancelCoach);
  const [eligibleOnly,setEligibleOnly]=useState(true);
  const [eventKey, setEventKey] = useState("olympiad");
  const [message, setMessage] = useState(""),
    [term, setTerm] = useState<CoachTerm>("game"),
    [search, setSearch] = useState("");
  const teams = useMemo(
    () => federationTeams(save, npcs),
    [save.player.country, save.player.name, save.player.rating, npcs],
  );
  const country = getCountry(save.player.country);
  const eventTeams = useMemo(
    () =>
      view === "teams"
        ? buildEventTeams(
            save,
            npcs,
            resolveTeamEvent(
              teamSpec(eventKey) ?? TEAM_EVENTS[0],
              save.world.date.year,
            ),
          )
        : [],
    [
      view,
      eventKey,
      save.world.date.year,
      save.player.country,
      save.player.name,
      save.player.rating,
      save.player.gender,
      save.player.age,
      npcs,
    ],
  );
  const currentCoach = activeCoach(save);
  const act = (
    result: { ok: true } | { ok: false; error: string },
    success: string,
  ) => setMessage(result.ok ? success : result.error);
  if (view === "news")
    return (
      <Card>
        <CardTitle>Chess news</CardTitle>
        <p className="mb-4 text-sm text-ink-muted">
          Results from your career and the simulated world circuit. A new
          eight-player circuit runs when the game week advances.
        </p>
        {save.history.news.length === 0 ? (
          <p className="text-ink-muted">
            No news yet. Play games or advance to a new week.
          </p>
        ) : (
          <ul className="space-y-4">
            {[...save.history.news].reverse().map((n) => (
              <li key={n.id} className="rounded-lg bg-navy-900 p-3">
                <p className="text-xs text-ink-faint">
                  {n.year} · week {n.week} · {n.kind}
                </p>
                <h3 className="font-semibold text-ink">{n.headline}</h3>
                {n.detail && (
                  <p className="mt-1 text-sm text-ink-muted">{n.detail}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  if (view === "coach")
    return (
      <div className="space-y-4">
        <Card>
          <CardTitle>Coaching contracts</CardTitle>
          <p className="text-sm text-ink-muted">
            One game: a lesson after your next qualifying game (at least 12
            half-moves, or checkmate). Weekly (7 game days) and monthly (30 game
            days): +10/20/30% session XP by coach level, plus game lessons. Each
            lesson awards 24/48/72 XP in the specialty. Up to four game lessons
            per game day. No automatic renewal.
          </p>
          <p className="mt-2 text-gold-400">Balance: ${save.player.money}</p>
          {currentCoach && (
            <div className="mt-3 rounded-lg bg-navy-900 p-3">
              <p className="font-semibold text-ink">
                Your coach: {currentCoach.name} · {state.coach?.term}
              </p>
              <p className="text-sm text-ink-muted">
                {state.coach?.expires === null
                  ? "One qualifying game remaining"
                  : `${Math.max(0, (state.coach?.expires ?? 0) - dayIndex(save))} game days remaining`}{" "}
                · {state.coachedGames} lessons completed
              </p>
              <Button
                className="mt-2"
                variant="secondary"
                onClick={() => {
                  if (
                    confirmUI(
                      "Cancel this contract? There is no refund for unused time.",
                    )
                  )
                    cancel();
                }}
              >
                Cancel contract (no refund)
              </Button>
            </div>
          )}
          <label className="mt-4 block text-sm text-ink-muted">
            Contract
            <select
              aria-label="Coaching contract"
              value={term}
              onChange={(e) => setTerm(e.target.value as CoachTerm)}
              className="ml-3 rounded bg-navy-900 p-2"
            >
              <option value="game">Per game</option>
              <option value="week">Weekly · 7 days</option>
              <option value="month">Monthly · 30 days</option>
            </select>
          </label>
          {message && (
            <p role="status" className="mt-3 text-gold-400">
              {message}
            </p>
          )}
        </Card>
        <div className="grid gap-3 md:grid-cols-2">
          {COACHES.map((c) => (
            <Card key={c.id}>
              <CardTitle aside={<Badge>Level {c.tier}</Badge>}>
                {c.name}
              </CardTitle>
              <p className="text-sm text-ink-muted">
                Specialty: {c.specialty} · {c.tier * 10}% training bonus on time
                contracts
              </p>
              <Button
                className="mt-3"
                disabled={
                  !!currentCoach || save.player.money < coachFee(save, c, term)
                }
                onClick={() =>
                  act(
                    hire(c.id, term),
                    "Coach hired. Contract saved to this character.",
                  )
                }
              >
                Hire {c.name} · ${coachFee(save, c, term)}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    );
  if (view === "teams") {
    const year = save.world.date.year,
      spec = teamSpec(eventKey) ?? TEAM_EVENTS[0],
      info = resolveTeamEvent(spec, year);
    const cup =
      state.cups.find((c) => c.year === year && cupKey(c) === spec.key) ?? null;
    const eventHome = eventTeams.find(
      (t) => t.country === save.player.country,
    );
    const selected = !!eventHome?.players.some((p) => p.id === "player");
    const ready = save.registrations.some(
      (r) =>
        r.details?.format === "team" &&
        teamInfoOf(r.details).key === spec.key &&
        r.year === year &&
        r.week === save.world.date.week,
    );
    const issues = teamEntryIssues(save, info);
    const rules = [
      spec.gender ? "Women only" : null,
      spec.minAge !== undefined ? `Age ${spec.minAge}+` : null,
      spec.maxAge !== undefined ? `Age ${spec.maxAge} or younger` : null,
      ...slotSummary(spec.slots, info.boards),
    ].filter(Boolean);
    const region = spec.continents
      ? `Region: ${spec.continents.join(" · ")}`
      : spec.countries
        ? `Invited federations: ${spec.countries.length}`
        : "Region: Worldwide";
    return (
      <div className="space-y-4">
        <Card>
          <CardTitle>Your national chess team · {year}</CardTitle>
          <p className="mb-3 text-sm text-gold-300">{country?.name} · {selected ? "Selected for starting boards" : "Selection follows eligible federation rankings"}</p>
          {eventHome && <ChessTeamCanvas players={eventHome.players}/>}
          <p className="text-sm text-ink-muted">
            Twenty national team competitions run each game year. Teams select
            their highest-rated eligible players for the boards; you represent
            your country when selected. Individual Elo is unchanged. Vacant
            boards lose by forfeit, so small federations can still take part.
          </p>
          <label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={eligibleOnly} onChange={e=>setEligibleOnly(e.target.checked)}/> Events for my federation and age group</label><label className="mt-3 block text-sm text-ink-muted">
            National team event
            <select
              aria-label="National team event"
              value={spec.key}
              onChange={(e) => {
                setEventKey(e.target.value);
                setMessage("");
              }}
              className="mt-1 w-full rounded-lg bg-navy-900 p-3 text-ink"
            >
              {TEAM_EVENTS.filter(e=>!eligibleOnly||e.key===eventKey||teamEntryIssues(save,resolveTeamEvent(e,year)).length===0).map((e) => (
                <option key={e.key} value={e.key}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-ink">
            {country?.flag} {country?.federation.name}
          </p>
          <ul className="my-3 space-y-1 text-sm text-ink-muted">
            <li>
              {`Teams this year: ${info.teams} (usual field ${spec.teams[0]}–${spec.teams[1]})`}
            </li>
            <li>{`Boards per match: ${info.boards} · Reserves: ${info.reserves}`}</li>
            <li>
              {info.teams <= 12
                ? "Format: round robin"
                : `Format: Swiss system, ${spec.rounds} rounds`}
            </li>
            <li>{region}</li>
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          {issues.length > 0 && (
            <p className="mb-2 text-sm text-ink-muted">
              {`Not eligible as a player: ${issues.join("; ")}.`}
            </p>
          )}
          {eventHome ? (
            <ul className="my-3 space-y-1">
              {eventHome.players.map((p, i) => (
                <li key={p.id} className="text-sm text-ink-muted">
                  Board {i + 1}: <span translate="no">{p.name}</span> · {p.elo}
                  {p.id === "player" ? " · YOU" : ""}
                </li>
              ))}
              {(eventHome.reserves ?? []).map((p) => (
                <li key={p.id} className="text-sm text-ink-muted">
                  Reserve: <span translate="no">{p.name}</span> · {p.elo}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">
              Your federation has no eligible players for this event.
            </p>
          )}
          <p className="mb-1 text-xs text-ink-muted">
            {`Selected players spend 2 AP and earn up to $${spec.prize} appearance/prize money, scaled by finishing position.`}
          </p>
          <p className="mb-3 text-xs text-ink-muted">
            Selected players must register in Tournament before the deadline
            and play in the event week. Unselected members can follow the
            simulated exhibition free. Membership is required.
          </p>
          <Button
            disabled={!!cup || (selected && !ready)}
            onClick={() => act(play(spec.key), "National team cup completed.")}
          >
            {cup
              ? "Cup finished this year"
              : selected && !ready
                ? "Register in Tournament first"
                : "Simulate national team cup"}
          </Button>
          {message && (
            <p role="status" className="mt-3 text-gold-400">
              {message}
            </p>
          )}
        </Card>
        {cup && (
          <>
            <Card>
              <CardTitle>Final standings</CardTitle>
              <p className="mb-2 flex flex-wrap gap-x-3 text-xs text-ink-muted">
                <span>{`Teams: ${cup.teamCount ?? cup.teams.length}`}</span>
                <span>
                  {cup.format === "swiss"
                    ? `Swiss, ${cup.rounds} rounds`
                    : "Round robin"}
                </span>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Nation</th>
                      <th>Match pts</th>
                      <th>Board pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cup.teams.slice(0, STANDINGS_SHOWN).map((t, i) => (
                      <tr key={t.country} className="border-t border-white/10">
                        <td className="py-2">{i + 1}</td>
                        <td>
                          {getCountry(t.country)?.flag}{" "}
                          {getCountry(t.country)?.name ?? t.country}
                        </td>
                        <td>{t.points}</td>
                        <td>{t.boardPoints}</td>
                      </tr>
                    ))}
                    {(() => {
                      const at = cup.teams.findIndex(
                        (t) => t.country === save.player.country,
                      );
                      const t = cup.teams[at];
                      return at >= STANDINGS_SHOWN && t ? (
                        <tr className="border-t border-white/10">
                          <td className="py-2">{at + 1}</td>
                          <td>
                            {getCountry(t.country)?.flag}{" "}
                            {getCountry(t.country)?.name ?? t.country}
                          </td>
                          <td>{t.points}</td>
                          <td>{t.boardPoints}</td>
                        </tr>
                      ) : null;
                    })()}
                  </tbody>
                </table>
              </div>
              {cup.teams.length > STANDINGS_SHOWN && (
                <p className="mt-2 text-xs text-ink-muted">
                  {`Showing the top ${STANDINGS_SHOWN} of ${cup.teams.length} teams, plus your federation.`}
                </p>
              )}
              <p className="mt-3 text-sm text-ink-muted">
                {cup.represented
                  ? "You represented your country."
                  : "You followed your country as a federation member."}{" "}
                Prize ${cup.prize}.
              </p>
            </Card>
            <Card>
              <CardTitle>Board results</CardTitle>
              {cup.teams.length > 12 && (
                <p className="mb-2 text-xs text-ink-muted">
                  Board results show your federation&apos;s matches.
                </p>
              )}
              <div className="max-h-96 space-y-2 overflow-auto">
                {cup.boards.map((b, i) => (
                  <p key={i} className="text-sm text-ink-muted">
                    Fixture {b.round}: {b.white} ({b.whiteElo}){" "}
                    {b.score === 1 ? "1–0" : b.score === 0 ? "0–1" : "½–½"}{" "}
                    {b.black} ({b.blackElo}){b.forfeit ? " · forfeit" : ""}
                  </p>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    );
  }
  const countByCountry = new Map<string, number>();
  for (const n of npcs)
    if (n.careerStatus === "active" || n.careerStatus === "semi-retired")
      countByCountry.set(
        n.nationality,
        (countByCountry.get(n.nationality) ?? 0) + 1,
      );
  const federations = COUNTRIES.filter((c) =>
    `${c.name} ${c.federation.name} ${c.federation.code}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Your federation</CardTitle>
        <p className="font-semibold text-ink">
          {country?.flag} {country?.federation.name} ({country?.federation.code}
          )
        </p>
        <p className="my-2 text-sm text-ink-muted">
          Your career represents {country?.name}. Annual membership: $35, valid
          through the game year. Includes National Team Cup entry and 10% off
          coaching fees.
        </p>
        <Button
          disabled={
            state.membershipYear === save.world.date.year ||
            save.player.money < 35
          }
          onClick={() => act(join(), "Federation membership activated.")}
        >
          {state.membershipYear === save.world.date.year
            ? "Member this year"
            : "Join federation · $35"}
        </Button>
        {message && (
          <p role="status" className="mt-3 text-gold-400">
            {message}
          </p>
        )}
      </Card>
      <Card>
        <CardTitle>Federation directory</CardTitle>
        <label className="block text-sm text-ink-muted">
          Search federations
          <input
            aria-label="Search federations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="my-3 block w-full rounded border border-white/10 bg-navy-900 p-2"
          />
        </label>
        <p className="mb-3 text-xs text-ink-faint">
          {federations.length} federations. Names use the country database’s
          generated federation labels.
        </p>
        <ul className="max-h-96 divide-y divide-white/10 overflow-auto">
          {federations.map((c) => (
            <li key={c.code} className="py-2 text-sm">
              <span className="text-ink">
                {c.flag} {c.federation.name} · {c.federation.code}
              </span>
              <p className="text-xs text-ink-muted">
                {countByCountry.get(c.code) ?? 0} active NPCs ·{" "}
                {teams.find((t) => t.country === c.code)?.players.length ?? 0}{" "}
                national team boards
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
