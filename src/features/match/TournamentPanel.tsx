import { hasOpeningCeremony } from "@/game/competition/presentation";
import { CareerTools } from "@/features/career/CareerTools";
import { tournamentCategory } from "@/game/competition/categories";
import { TOURNAMENT_CONTINENTS, matchesVenueContinent } from "@/game/competition/venues";
import { earnedEntries } from "@/game/competition/earnedEntries";
import { TournamentSpotlightDialog } from "@/features/tournaments/TournamentSpotlight";
import { circuitVisible, circuitAdvancement } from "@/game/competition/qualificationCircuit";
import { useLocation, useSearchParams } from "react-router-dom";
import { TournamentDetail } from "@/features/tournaments/TournamentDetail";
import { eventKind } from "@/game/competition/archive";
import { registrationWindow } from "@/game/competition/registrationWindow";
import { confirmUI } from "@/i18n/translate";
import { UpcomingPredictions } from "@/features/prediction/CareerPrediction";
import { PredictionSummary } from "@/features/prediction/PredictionPanel";
import { TournamentDayClock, TournamentTimetable } from "./TournamentTimetable";
import {
  tournamentReady,
  bookedStart,
  bookedEnd,
  reservedUntil,
  eventAgenda,
  dayLabel,
} from "@/game/competition/agenda";
import { bookingConflict } from "@/game/esports/core";
import { registrationCount, type EntryEvent } from "@/game/competition/entries";
import { showcaseSelection } from "@/game/competition/showcase";
import {
  matchesTournamentSearch,
  matchesOrganizer,
  matchesQualificationFilter,
  type TournamentSearch,
} from "@/game/competition/finder";
import { TournamentFinder } from "./TournamentFinder";
import { AdvanceToEvent } from "@/features/qol/CareerPanels";
import { TournamentHistoryDialog } from "@/features/qol/HistoryDialogs";
import { useMatchRunning } from "@/store/matchLocks";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { useNpcs } from "@/hooks/useNpcs";
import { getCountry } from "@/data/world/countries";
import { useGameStore } from "@/store/gameStore";
import { useOpeningDb } from "@/store/openingStore";
import { buildMatchSetup } from "@/game/match/setup";
import { playerOpponentId, standings } from "@/game/match/tournament";
import type { MatchSetup } from "@/game/match/session";
import { registrationStates, previewEntrants } from "@/game/match/registration";
import { preserveBookedVenues, regionForSave, getSchedule, type ScheduledEvent } from "@/game/world/schedule";
import {
  dateLabel,
  HISTORICAL_REFERENCE,
  stampIndex,
} from "@/game/competition/catalog";
import {
  eligibilityIssues,
  registrationIssue,
  requirementsText,
} from "@/game/competition/eligibility";
import type { ActiveTournament } from "@/types";

export function EventFacts({ event }: { event: ScheduledEvent }) {
  const d = event.details;
  const save = useSave();
  const facts = [
    [
      "Location",
      d?.host?.mode === "online"
        ? "Online"
        : `${d?.location ?? "Local venue"}, ${getCountry(d?.country ?? "")?.name ?? d?.country ?? "Home country"}`,
    ],
    [
      "Start",
      d?.agenda?.exactStart || d?.qualificationCircuit
        ? dayLabel(bookedStart(event))
        : d?.reference?.sourceYear === event.year
          ? `${d.reference.startDate} (W${event.week})`
          : d?.historicalSchedule
            ? `${d.historicalSchedule.startDate} (W${event.week})`
            : dateLabel(event),
    ],
    [
      "End",
      d?.agenda?.exactStart || d?.qualificationCircuit
        ? dayLabel(bookedEnd(event))
        : d?.reference?.sourceYear === event.year && d.reference.endDate
          ? `${d.reference.endDate} (W${d.end.week})`
          : d?.historicalSchedule
            ? `${d.historicalSchedule.endDate} (W${d.end.week})`
            : dateLabel(d?.end ?? event),
    ],
    ["Registration deadline", dayLabel(registrationWindow(save, event).close)],
    ["Entry fee", `$${event.entryFee}`],
    ["Travel estimate", `$${d?.travelCost ?? 0}`],
    ["Total to register", `$${event.entryFee + (d?.travelCost ?? 0)}`],
    ["Required Elo", `${event.minElo}+`],
    [
      "Participant limit",
      d?.teamEvent ? `${event.fieldSize} national teams` : event.fieldSize,
    ],
    ["Duration", `${eventAgenda(event).days} day(s)`],
    ...(d?.agenda?.exactStart
      ? [["Starting day", dayLabel(bookedStart(event))]]
      : []),
    ["Organizer", d?.organizer ? d.organizer.name : "Not recorded"],
    ["Organization", d?.organizer?.status ?? "Not recorded"],
    ["Time control", d?.timeControl.label ?? "Classical"],
    ["Format", d?.format ?? "swiss"],
    ...(d?.format?.includes("round-robin")
      ? [
          [
            "Games per opponent",
            d.format === "round-robin-bo3"
              ? "BO3 · 2–3 games, plus a decider if tied"
              : d.format === "double-round-robin"
                ? "2"
                : "1",
          ],
          ["Opponents per player", event.fieldSize - 1],
        ]
      : []),
    ["Rounds", d?.rounds ?? "Announced at start"],
    ["Prize money", `$${d?.prize ?? 0}`],
    ["Prestige", `${d?.prestige ?? 0}/100`],
    ["Qualification requirements", requirementsText(event)],
    ...(d?.qualificationCircuit?.sponsor ? [["Sponsor", d.qualificationCircuit.sponsor], ["World Finals destination", d.qualificationCircuit.worldFinalName ?? "World Qualification Finals"]] : []),
    ...(d?.qualificationCircuit ? [["Qualification route", circuitAdvancement(d) || "Final stage · qualifiers from all continents"], ["Qualification season", d.qualificationCircuit.season]] : []),
  ];
  return (
    <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
      {facts.map(([k, v]) => (
        <div key={k}>
          <dt className="text-ink-faint">{k}</dt>
          <dd className="mt-0.5 break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
export function TournamentStandings({ t }: { t: ActiveTournament }) {
  const rows = useMemo(() => standings(t), [t]);
  const live = useGameStore(s=>s.save?.tournament?.eventId===t.eventId);
  const playerRating = useGameStore(s=>s.save?.player.rating);
  const population = useNpcs();
  const ratings = useMemo(()=>new Map(population.map(n=>[n.id,n.currentElo])),[population]);
  const bo3 = t.details?.format === "round-robin-bo3";
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="max-h-[32rem] overflow-auto">
      {selected && (
        <TournamentHistoryDialog
          key={`${t.eventId}-${selected}`}
          t={t}
          playerId={selected}
          onClose={() => setSelected(null)}
        />
      )}
      <table
        className="w-full min-w-[560px] text-left text-sm"
        data-testid="standings"
      >
        <caption className="mb-2 text-left text-xs text-ink-muted">
          {t.details?.format?.includes("round-robin")
            ? "Ties: Sonneborn–Berger, wins, Elo, ID."
            : "Ties: Buchholz Cut 1, Buchholz, Sonneborn–Berger, wins, Elo, ID."}{" "}
          Bye tiebreak scores use a virtual opponent; byes do not count as wins.
        </caption>
        <thead className="sticky top-0 bg-navy-800 text-xs text-ink-faint">
          <tr>
            {(bo3
              ? ["#", "Player", live?"Current Elo":"Elo at entry", "Series wins"]
              : ["#", "Player", live?"Current Elo":"Elo at entry", "Points", "BH-C1", "BH", "SB", "Wins"]
            ).map((h) => (
              <th key={h} className="py-2 pr-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.player.id}
              className={
                r.player.isPlayer
                  ? "bg-gold-500/10 text-gold-400"
                  : "text-ink-muted"
              }
            >
              <td className="py-2">{r.rank}</td>
              <td className="pr-3">
                <button
                  type="button"
                  className="min-h-11 text-left underline decoration-current/30 underline-offset-4 hover:text-ink"
                  onClick={() => setSelected(r.player.id)}
                  aria-label={`Tournament games for ${r.player.name}`}
                >
                  {getCountry(r.player.countryCode)?.flag} {r.player.name}
                  {r.player.isPlayer ? " (you)" : ""}
                </button>
              </td>
              <td>{live?(r.player.isPlayer?playerRating:ratings.get(r.player.id))??r.player.elo:r.player.elo}</td>
              <td>{r.player.points}</td>
              {!bo3 && (
                <>
                  <td>{r.buchholzCut1.toFixed(1)}</td>
                  <td>{r.buchholz.toFixed(1)}</td>
                  <td>{r.sonnebornBerger.toFixed(2)}</td>
                  <td>{r.wins}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function PairingHistory({ t }: { t: ActiveTournament }) {
 const [round,setRound]=useState(Math.min(t.round-1,t.pairings.length-1)),[mine,setMine]=useState(false);
 useEffect(()=>setRound(Math.max(0,t.round-1)),[t.round,t.eventId]);
 const index=Math.max(0,Math.min(round,t.pairings.length-1)),names=new Map(t.players.map(p=>[p.id,`${p.name} (${p.elo})`]));
 return <section className="mt-4 rounded-xl bg-navy-900 p-4" data-testid="pairings-history"><h3 className="font-semibold">Pairings & history</h3><div className="my-3 flex flex-wrap items-center gap-2"><Button variant="secondary" disabled={index===0} onClick={()=>setRound(index-1)}>←</Button><select aria-label="Pairing round" value={index} onChange={e=>setRound(Number(e.target.value))} className="rounded-lg bg-navy-800 p-3">{t.pairings.map((_,i)=><option key={i} value={i}>Round {i+1}{i===t.round-1?' · current':''}</option>)}</select><Button variant="secondary" disabled={index>=t.pairings.length-1} onClick={()=>setRound(index+1)}>→</Button><label className="text-xs"><input type="checkbox" checked={mine} onChange={e=>setMine(e.target.checked)}/> My board only</label></div><ul className="max-h-96 space-y-2 overflow-auto">{(t.pairings[index]??[]).filter(p=>!mine||p.white==='player'||p.black==='player').map(p=><li key={p.white} className={`min-w-0 rounded-xl border p-3 text-sm ${p.white==='player'||p.black==='player'?'border-gold-500/40':'border-white/10'}`}><div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"><p className="break-words">♔ {names.get(p.white)}</p><strong className="text-gold-300">{p.result===null?'Upcoming':`${p.result} – ${1-p.result}`}</strong><p className="break-words">♚ {p.black==='bye'?'Bye':names.get(p.black)}</p></div>{(p.prediction??p.forecast)&&<div className="mt-2"><PredictionSummary prediction={p.prediction??p.forecast}/></div>}</li>)}</ul></section>;
}

function Entrants({ event }: { event: EntryEvent }) {
  const save = useSave(),
    npcs = useNpcs();
  const [open, setOpen] = useState(false);
  const field = useMemo(
    () => (open ? previewEntrants(save, event, npcs) : []),
    [
      open,
      save.registrations,
      save.career.id,
      save.world.seed,
      save.world.date,
      save.world.day,
      save.player.rating,
      npcs,
      event.id,
      event.level,
      event.fieldSize,
      event.details,
    ],
  );
  return (
    <details
      className="mt-3 text-xs"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer text-gold-400">
        NPC entrants{open ? ` (${field.length})` : ""}
      </summary>
      {open && (
        <>
          <p className="my-2 text-ink-faint">
            NPC registrations increase as game days pass until the deadline.
            Paid entries hold a seat; inactive entrants are removed at the
            start. Showcases list organizer invitations. All fields are
            simulated.
          </p>
          <ul className="max-h-48 overflow-auto">
            {field.map((n) => (
              <li
                key={n.id}
                className="flex justify-between gap-2 py-1 text-ink-muted"
              >
                <span>
                  {getCountry(n.nationality)?.flag}{" "}
                  <span translate="no">{n.name}</span>
                </span>
                <span>
                  {n.currentElo} · {n.careerStatus}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}
export function TournamentPanel({
  onStart,
  swissOnly = false,
}: {
  onStart: (setup: MatchSetup) => void;
  swissOnly?: boolean;
}) {
  const save = useSave(),
    npcs = useNpcs(),
    db = useOpeningDb();
  const running = useMatchRunning(save.career.id);
  const acceptInvitation = useGameStore((s) => s.acceptShowcaseInvitation);
  const [finderOpen, setFinderOpen] = useState(false);
  const [viewTournament, setViewTournament] = useState(false);
  const [spotlight, setSpotlight] = useState<ScheduledEvent | null>(null);
  const [search, setSearch] = useState<TournamentSearch | null>(null);
  const register = useGameStore((s) => s.registerForEvent),
    cancel = useGameStore((s) => s.cancelRegistration),
    start = useGameStore((s) => s.startTournament),
    withdraw = useGameStore((s) => s.withdrawTournament),
    close = useGameStore((s) => s.closeTournament);
  const [location, setLocation] = useState("all");
  const [continent, setContinent] = useState("all");
  const [source, setSource] = useState("all");
  const [organizer,setOrganizer]=useState<TournamentSearch["organizer"]>("all");
  const [qualificationFilter, setQualificationFilter] = useState<TournamentSearch["qualification"]>("all");
  const [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [limit, setLimit] = useState(6);
  const [urlParams, setUrlParams] = useSearchParams();
  const route = useLocation();
  const selectedEventId = urlParams.get("event");
  const events = useMemo(() => {
    return preserveBookedVenues(save, getSchedule(save.world.date, regionForSave(save), save.career.id, 52));
  }, [save.world.date, save.player.country, save.player.city.name, save.player.birthPlace, save.career.id, save.registrations, save.tournament, save.calendarTournaments]);
  const targetEvent = selectedEventId
    ? events.find((e) => e.id === selectedEventId)
    : undefined;
  const regs = registrationStates(save).filter(
    (r) => !swissOnly || (r.details?.format ?? "swiss") === "swiss",
  );
  const earned = useMemo(() => earnedEntries(save, events).filter(
    ({ event }) => !swissOnly || event.details?.format === "swiss",
  ), [save, events, swissOnly]);
  useEffect(() => {
    if (urlParams.get("section") !== "registrations") return;
    const frame = requestAnimationFrame(() => {
      const section = document.getElementById("your-registrations");
      section?.focus({ preventScroll: true });
      section?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [urlParams, route.key]);
  const t = save.tournament;
  const showCurrent =
    t && (!swissOnly || (t.details?.format ?? "swiss") === "swiss");
  const next = t ? playerOpponentId(t) : null,
    npc = next ? npcs.find((n) => n.id === next.id) : undefined;
  const play = (mode: "play" | "simulate") => {
    if (!t || !next || !npc || running || !tournamentReady(save)) return;
    onStart(
      buildMatchSetup({
        save,
        npc,
        playerColor: next.color,
        timeControl: t.timeControl,
        rated: true,
        mode,
        speed: mode === "simulate" ? "fast" : "brisk",
        tournament: {
          id: t.eventId,
          name: t.name,
          level: t.level,
          round: t.round,
          rounds: t.rounds,
        },
        seed: Math.floor(Math.random() * 2 ** 31),
        db,
      }),
    );
  };
  const result = (r: { ok: true } | { ok: false; error: string }) =>
    setError(r.ok ? "" : r.error);
  const filtered = events.filter(
    (e) =>
      (!swissOnly || e.details?.format === "swiss") &&
      matchesOrganizer(e,organizer) && circuitVisible(save.player.country, e.details) && matchesQualificationFilter(e, qualificationFilter) &&
      matchesVenueContinent(e.details?.country, continent) &&
      (!search ||
        (matchesTournamentSearch(e, search) &&
          (!search.availableOnly ||
            registrationIssue(save, e, npcs) === null))) &&
      (source === "all" ||
        (source === "fide" && !!e.details?.reference) ||
        (source === "fictional" && !e.details?.reference)) &&
      (location === "all" ||
        (location === "home" && e.details?.country === save.player.country) ||
        (location === "abroad" && e.details?.country !== save.player.country) ||
        e.details?.country === location) &&
      (category === "all" || tournamentCategory(e) === category) &&
      (query
        ? e.name.toLowerCase().includes(query.toLowerCase())
        : !targetEvent || e.id === targetEvent.id),
  );
  return (
    <div className="space-y-4" data-testid="tournament-panel"><Card><CardTitle>Competition hub</CardTitle><p className="mb-3 text-sm text-ink-muted">Play your current event, manage earned places or find your next tournament.</p><div className="flex flex-wrap gap-2">{[["current-tournament","Play & results"],["your-registrations",`Your entries (${regs.length+earned.length})`],["available-tournaments","Find a tournament"]].map(([id,label])=><Button key={id} variant="secondary" onClick={()=>document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"})}>{label}</Button>)}</div></Card>
      {spotlight && <TournamentSpotlightDialog event={spotlight} onClose={() => setSpotlight(null)} />}
      {viewTournament && t && (
        <TournamentDetail
          tournament={t}
          onClose={() => setViewTournament(false)}
        />
      )}
      {finderOpen && (
        <TournamentFinder
          initial={search??{fromWeek:0,toWeek:52,minElo:0,maxElo:save.player.rating,continent,qualification:qualificationFilter,minPlayers:2,maxPlayers:256,availableOnly:true,organizer}}
          continent={continent}
          qualification={qualificationFilter}
          rating={save.player.rating}
          onClose={() => setFinderOpen(false)}
          onApply={(value) => {
            setSearch(value);
            setOrganizer(value.organizer??"all");
            setContinent(value.continent);
            setQualificationFilter(value.qualification ?? "all");
            setUrlParams((params) => {
              params.delete("event");
              return params;
            });
            setLocation("all");
            setSource("all");
            setCategory("all");
            setQuery("");
            setLimit(6);
            setFinderOpen(false);
          }}
        />
      )}
      {swissOnly && (
        <Card>
          <CardTitle>Swiss Open</CardTitle>
          <p className="text-sm text-ink-muted">
            Score groups, colour balancing and maximum matching avoid repeat
            opponents whenever a complete pairing without repeats exists. Lowest
            score gets the bye, preferring players without a previous bye. This
            game implementation is not FIDE-certified Dutch pairing software.
          </p>
        </Card>
      )}
      <div id="current-tournament" className="scroll-mt-24">{showCurrent && t ? (
        <Card>
          <CardTitle
            aside={
              <Badge tone="gold">
                {t.status === "finished"
                  ? "Finished"
                  : t.details?.format === "round-robin-bo3"
                    ? `Series ${Math.ceil(t.round / 3)} / ${Math.ceil(t.rounds / 3)} · game ${((t.round - 1) % 3) + 1}`
                    : `Round ${t.round} / ${t.rounds}`}
              </Badge>
            }
          >
            Current tournament · {t.name}
          </CardTitle>
          <details className="mb-4"><summary className="cursor-pointer text-sm text-gold-300">Tournament information</summary><dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {[
              ["Location", t.details?.location ?? save.player.city.name],
              [
                "Country",
                getCountry(t.details?.country ?? save.player.country)?.name ??
                  save.player.country,
              ],
              ["Tournament category", t.details?.category ?? t.level],
              ["Organizer", t.details?.organizer?.name ?? "Not recorded"],
              ["Organization", t.details?.organizer?.status ?? "Not recorded"],
              ["Time control", t.timeControl.label],
              [
                "Player ranking",
                `World #${npcs.filter((n) => (n.careerStatus === "active" || n.careerStatus === "semi-retired") && n.currentElo > save.player.rating).length + 1}`,
              ],
              [
                "Tournament standing",
                `#${standings(t).find((r) => r.player.isPlayer)?.rank ?? "—"} / ${t.players.length}`,
              ],
              ["Tournament prize", `$${t.prizeFund}`],
              ["Registration status", "Registered · fee paid"],
              ["Format", t.details?.format ?? "swiss"],
              [
                "Entry requirements",
                t.entryRequirements ??
                  (t.details
                    ? [
                        t.details.minimumTitle,
                        t.details.qualification,
                        t.details.nationality,
                        t.details.minimumLeague,
                      ]
                        .filter(Boolean)
                        .join(" · ") ||
                      "Elo / reputation checked at registration"
                    : `${t.level} · checked at registration`),
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-ink-faint">{k}</dt>
                <dd className="mt-1 text-ink">{v}</dd>
              </div>
            ))}
          </dl></details>
          {t.status === "playing" && next && (
            <div className="mb-4 rounded-lg bg-navy-900 p-3">
              <h3 className="font-semibold text-ink">Upcoming match</h3>
              <p className="my-2 text-sm text-ink-muted">
                Round {t.round}:{" "}
                <span translate="no">
                  {npc?.name ?? t.players.find((p) => p.id === next.id)?.name}
                </span>{" "}
                · Elo{" "}
                {npc?.currentElo ??
                  t.players.find((p) => p.id === next.id)?.elo}{" "}
                · You play {next.color}.
              </p>
              <UpcomingPredictions circuit="traditional" />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!npc || running || !tournamentReady(save)}
                  onClick={() => play("play")}
                  data-testid="play-round"
                >
                  Play the game
                </Button>
                <Button
                  disabled={!npc || running || !tournamentReady(save)}
                  variant="secondary"
                  onClick={() => play("simulate")}
                >
                  Simulate (take control any time)
                </Button>
              </div>
            </div>
          )}
          {t.status === "finished" && (
            <div className="mb-4 text-sm text-gold-400">
              Final rank: {t.finalRank} · Prize: ${t.prize}
              <Button className="ml-3" onClick={close}>
                Close results
              </Button>
            </div>
          )}
          {t.status === "playing" && (
            <TournamentDayClock tournament={t} interactive />
          )}
          <Button
            className="mb-3"
            variant="secondary"
            onClick={() => setViewTournament(true)}
            data-testid="open-current-tournament"
          >
            Open tournament / watch games
          </Button>
          <TournamentTimetable tournament={t} />
          {t.details?.qualificationCircuit && <p className="my-3 rounded-xl bg-gold-500/10 p-3 text-sm text-gold-300">{circuitAdvancement(t.details) || "Final stage · qualifiers from all continents"}</p>}
          <h3 className="mb-2 font-semibold text-ink">Tournament standings</h3>
          <TournamentStandings t={t} />
          <PairingHistory t={t} />
          {t.status === "playing" && (
            <Button
              variant="danger"
              disabled={running}
              className="mt-4"
              onClick={() =>
                confirmUI(
                  "Withdraw? Remaining games are forfeited; no prize or qualification is awarded.",
                ) && withdraw()
              }
            >
              Withdraw from the tournament
            </Button>
          )}
        </Card>
      ) : (
        <Card>
          <CardTitle>Current tournament</CardTitle>
          <p className="text-sm text-ink-muted">
            {t
              ? "An individual event is running in Tournament. Finish it before starting another."
              : "No tournament in progress. Register below, then start during the event week. Finish before the end week; unplayed rounds are forfeited when the calendar passes it."}
          </p>
        </Card>
      )}
      </div><Card id="your-registrations" tabIndex={-1} className="scroll-mt-24" data-testid="your-registrations">
        <CardTitle aside={<Badge tone="gold">{regs.length + earned.length}</Badge>}>Your registrations</CardTitle>
        <p className="mb-4 text-sm text-ink-muted">Your qualified events and national team entries appear here automatically. Qualified entries still need registration confirmation.</p>
        {running && (
          <p role="status" className="mb-3 text-xs text-gold-400">
            A match is running in the background. Its result will appear when it
            finishes.
          </p>
        )}
        {!regs.length && !earned.length && (
          <p className="text-sm text-ink-muted">
            You are not registered for any event.
          </p>
        )}
        <ul className="space-y-3" data-testid="registrations">
          {regs.map((r) => (
            <li key={r.eventId} data-event-id={r.eventId} className={`rounded-lg bg-navy-900 p-3 ${urlParams.get("focusRegistration") === r.eventId ? "ring-1 ring-gold-400" : ""}`}>
              <p className="font-semibold text-ink">{r.name}</p>
              <p className="mt-2 text-xs font-semibold text-gold-300">
                {r.status === "missed" ? "Event missed" : r.status === "ready" ? "Registered · ready to play" : "Registered · waiting to play"}
              </p>
              {r.details?.format === "team" && <p className="mt-1 text-xs text-gold-300">{save.highlights?.seen.includes(`national-selected:${r.eventId}`) ? "Selected for the national team" : "National team entry"}</p>}
              {r.details && <p className="mt-1 text-xs text-ink-muted">{r.details.location} · {getCountry(r.details.country)?.name ?? r.details.country}</p>}
              <p className="my-2 text-xs text-ink-muted">
                {dateLabel(r)} · {r.status} · fee paid ${r.entryFee} · travel $
                {r.travelCost ?? 0}
                {r.status === "missed" ? " · fee lost" : ""}
              </p>
              <Entrants
                event={{
                  id: r.eventId,
                  level: r.level,
                  fieldSize: r.fieldSize,
                  details: r.details,
                }}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status !== "missed" && (
                  <AdvanceToEvent
                    eventId={r.eventId}
                    name={r.name}
                    ready={r.status === "ready"}
                  />
                )}
                {r.status === "ready" && (
                  <Button
                    data-testid="start-event"
                    disabled={t?.status === "playing" || running}
                    onClick={() => result(start(r.eventId))}
                  >
                    {r.details?.format === "team"
                      ? "Play national teams event"
                      : "Start tournament"}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => cancel(r.eventId)}>
                  {r.status === "upcoming"
                    ? "Cancel (refund)"
                    : "Remove registration"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {!!earned.length && <ul className="mt-3 space-y-3" data-testid="qualified-registrations">
          {earned.map(({ event, qualification }) => {
            const window = registrationWindow(save, event);
            const issue = registrationIssue(save, event, npcs);
            return <li key={event.id} data-event-id={event.id} className={`rounded-xl border border-gold-500/20 bg-gold-500/5 p-4 ${(urlParams.get("focusRegistration") === event.id || (!urlParams.get("focusRegistration") && urlParams.get("qualification") === qualification.kind)) ? "ring-1 ring-gold-400" : ""}`}>
              <p className="text-xs font-semibold text-gold-300">{window.status === "upcoming" ? "Qualified · waiting for registration" : issue ? "Qualified · requirements pending" : "Qualified · confirm registration"}</p>
              <h3 className="mt-2 break-words font-semibold text-ink">{event.name}</h3>
              {event.details?.qualificationCircuit?.worldFinalName && <p className="mt-2 text-xs text-gold-300"><span>World Finals destination</span>: <span translate="no">{event.details.qualificationCircuit.worldFinalName}</span></p>}
              <p className="mt-2 text-xs text-ink-muted">{dateLabel(event)} · {event.details?.location} · {getCountry(event.details?.country ?? "")?.name ?? event.details?.country}</p>
              <p className="mt-2 text-xs text-ink-muted"><span>Qualified via</span>: <span translate="no">{qualification.source}</span> ({qualification.year})</p>
              <p className="mt-1 text-xs text-ink-muted"><span>Qualification valid through</span>: {event.details?.qualificationCircuit?.season ?? qualification.year + 2}</p>
              <p className="mt-2 text-xs text-ink-muted"><span>Registration opens</span>: {dayLabel(window.open)} · <span>Registration deadline</span>: {dayLabel(window.close)}</p>
              <p className="mt-1 text-xs text-ink-muted"><span>Entry fee</span>: ${event.entryFee} · <span>Travel</span>: ${event.details?.travelCost ?? 0}</p>
              {issue && <p className="mt-3 text-xs text-gold-300">{issue}</p>}
              <details className="mt-3 text-sm"><summary className="cursor-pointer text-ink-muted">Entry details</summary><div className="mt-3"><EventFacts event={event} /></div></details>
              <Button className="mt-3" disabled={!!issue || running} onClick={() => result(register(event))}>Confirm registration</Button>
            </li>;
          })}
        </ul>}
        <p className="mt-3 text-xs text-ink-faint">
          Use End Day in Train to advance the calendar. Start in the listed
          week; registration closes at the end of the deadline week. One
          registration per starting week.
        </p>
      </Card>
      <Card id="available-tournaments" className="scroll-mt-24">
        <CardTitle>Upcoming tournaments</CardTitle>
        <p className="mb-4 rounded-xl bg-gold-500/10 p-3 text-sm text-gold-300">Sponsored qualification circuits: Local → National → Continental → World. Each event publishes its advancing places and named World Finals destination. Places vary by event and season; federation and continent restrictions still apply.</p>
        <p className="mb-3 text-sm text-ink-muted">Already qualified? Your place rolls down to the next eligible finisher until all available places are filled.</p>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setFinderOpen(true)}>
            Find suitable tournaments
          </Button>
          {search && (
            <>
              <span role="status" className="text-xs text-ink-muted">
                {filtered.length} matching tournaments
              </span>
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch(null);
                  setOrganizer("all");
                  setContinent("all");
                  setLimit(6);
                }}
              >
                Clear finder
              </Button>
            </>
          )}
        </div>
        <p className="mb-3 text-xs text-ink-muted">Continent filters use the host country. Annual venues target 20% in your birth city and 80% elsewhere; historical and national-team hosts keep their recorded locations.</p>
        <p className="mb-3 text-xs text-ink-muted">
          Career fields, fees, entry deadlines, requirements, prizes and results
          are simulated. Dates and formats are generated unless a historical
          source is cited. National teams use the separate four-board,
          eight-team round-robin simulation.
        </p>
        <fieldset className="mb-4 grid gap-3 rounded-xl border border-white/10 p-3 sm:grid-cols-2 lg:grid-cols-3"><legend className="px-2 text-sm font-semibold">Narrow your tournament search</legend>
          <label className="min-w-0 text-xs text-ink-muted"><span className="mb-1 block">Calendar origin</span><select
            aria-label="Tournament source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setLimit(6);
            }}
            className="max-w-full rounded-lg bg-navy-900 p-3 text-sm text-ink"
          >
            <option value="all">Every organizer</option>
            <option value="fide">Published real-world calendars</option>
            <option value="fictional">Career-generated events</option>
          </select></label>
          <label className="min-w-0 text-xs text-ink-muted"><span className="mb-1 block">How do I enter?</span><select aria-label="Qualification entry" value={qualificationFilter ?? "all"} onChange={(e) => {
            const qualification = e.target.value as TournamentSearch["qualification"];
            setQualificationFilter(qualification); setLimit(6);
            setSearch((previous) => previous ? { ...previous, qualification, availableOnly: false } : null);
          }} className="max-w-full rounded-lg bg-navy-900 p-3 text-sm text-ink">
            <option value="all">Any entry requirement</option><option value="required">Must qualify first</option><option value="qualifier">Earn a place in the next stage</option><option value="circuit">Local → National → Continental → World</option>
          </select></label>
          <label className="min-w-0 text-xs text-ink-muted"><span className="mb-1 block">Host continent</span><select data-testid="tournament-continent-filter" aria-label="Tournament continent" value={continent} onChange={(e) => {
            setContinent(e.target.value); setLocation("all"); setLimit(6);
            setSearch((previous) => previous ? { ...previous, continent: e.target.value } : null);
          }} className="max-w-full rounded-lg bg-navy-900 p-3 text-sm text-ink">
            <option value="all">All continents</option>
            {TOURNAMENT_CONTINENTS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
          <label className="min-w-0 text-xs text-ink-muted"><span className="mb-1 block">Where will I travel?</span><select
            aria-label="Tournament location"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setLimit(6);
            }}
            className="max-w-full rounded-lg bg-navy-900 p-3 text-sm text-ink"
          >
            <option value="all">All locations</option>
            <option value="home">Home country</option>
            <option value="abroad">Abroad</option>
            {[
              ...new Set(
                events
                  .filter((e) => matchesVenueContinent(e.details?.country, continent))
                  .map((e) => e.details?.country)
                  .filter((c): c is string => !!c),
              ),
            ]
              .sort((a, b) =>
                (getCountry(a)?.name ?? a).localeCompare(
                  getCountry(b)?.name ?? b,
                ),
              )
              .map((c) => (
                <option key={c} value={c}>
                  {getCountry(c)?.flag} {getCountry(c)?.name ?? c}
                </option>
              ))}
          </select></label>
          <label className="min-w-0 text-xs text-ink-muted"><span className="mb-1 block">Organizer type</span><select aria-label="Tournament organizer" value={organizer??'all'} onChange={e=>{const value=e.target.value as TournamentSearch['organizer'];setOrganizer(value);setLimit(6);setSearch(previous=>previous?{...previous,organizer:value}:null);}} className="w-full rounded-lg bg-navy-900 p-3 text-sm text-ink"><option value="all">All organizers</option><option>Official</option><option>Unofficial</option><option value="Sponsor">Sponsor-hosted</option></select></label>
          <input
            aria-label="Search tournaments"
            placeholder="Search tournaments…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selectedEventId)
                setUrlParams((params) => {
                  params.delete("event");
                  return params;
                });
              setLimit(6);
            }}
            className="min-w-0 flex-1 rounded-lg bg-navy-900 p-3 text-sm text-ink"
          />
          <label className="min-w-0 text-xs text-ink-muted"><span className="mb-1 block">Competition style</span><select
            aria-label="Tournament category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setLimit(6);
            }}
            className="max-w-full rounded-lg bg-navy-900 p-3 text-sm text-ink"
          >
            <option value="all">Every competition format</option>
            {[...new Set(events.map(tournamentCategory))].sort().map(c=><option key={c} value={c}>{c}</option>)}
          </select></label>
        </fieldset>
        <ul className="space-y-4" data-testid="open-events">
          {filtered.slice(0, limit).map((e) => {
            const totalEntrants = e.details?.showcase
              ? null
              : registrationCount(save, e, npcs);
            const full = totalEntrants !== null && totalEntrants >= e.fieldSize;
            const invitation = e.details?.showcase
              ? showcaseSelection(save, e, npcs)
              : null;
            const registered = save.registrations.some(
                (r) => r.eventId === e.id,
              ),
              played = save.history.tournaments.some(
                (r) => r.tournamentId === e.id,
              ),
              closed =
                stampIndex(save.world.date) >
                stampIndex(e.registrationDeadline),
              notOpen = registrationWindow(save, e).status === "upcoming",
              issues = eligibilityIssues(save, e),
              conflict = bookingConflict(
                save,
                bookedStart(e),
                reservedUntil(e),
                e.id,
              ),
              afford =
                save.player.money >= e.entryFee + (e.details?.travelCost ?? 0);
            return (
              <li
                key={e.id}
                data-event-id={e.id}
                data-host-country={e.details?.country ?? ""}
                data-host-city={e.details?.location ?? ""}
                data-host-continent={getCountry(e.details?.country ?? "")?.continent ?? ""}
                data-event-kind={eventKind(e)}
                className="rounded-xl border border-white/10 bg-navy-900 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">{e.name}</h3>
                    <p className="mt-1 text-xs text-ink-faint">
                      {e.details?.category} ·{" "}
                      {e.details?.reference
                        ? "FIDE-listed reference · career simulation"
                        : e.details?.historicalSchedule
                          ? "Verified dates & format · career simulation"
                          : e.details?.provenance === "fictional"
                            ? "Fictional event"
                            : "Inspired format · game schedule"}
                    </p>
                  </div>
                  <Badge tone={closed ? "neutral" : "gold"}>
                    {registered
                      ? "Registered"
                      : notOpen
                        ? "Not open yet"
                        : closed
                          ? "Registration closed"
                          : e.details?.showcase
                            ? invitation?.invited
                              ? "You are invited"
                              : "Invitation only"
                            : full
                              ? "Full"
                              : "Registration open"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-ink-muted">{dateLabel(e)} · {e.details?.location} · ${e.entryFee + (e.details?.travelCost??0)} total</p>
                <p className="mt-1 text-xs text-gold-300">{tournamentCategory(e)} · {circuitAdvancement(e.details)}</p>
                {e.details?.organizer?.sponsorId&&<p className="mt-2 text-xs font-semibold text-gold-300">Sponsor-hosted · {e.details.organizer.name} · {e.details.organizer.status}</p>}
                {e.details?.sponsorship&&<p className="mt-2 text-xs text-gold-300">Event partner · {e.details.sponsorship.name} · Market share {e.details.sponsorship.marketShare.toFixed(2)}%</p>}
                <p className="mt-1 text-xs text-ink-faint">{hasOpeningCeremony(e)?"Opening & award ceremonies":"Award ceremony after the final round"}</p>
                <Button className="mt-2" variant="secondary" onClick={()=>setSpotlight(e)}>City map & tournament spotlight</Button><details className="mt-3"><summary className="cursor-pointer text-sm text-gold-300">Requirements, schedule & players</summary><EventFacts event={e} />

                {e.details?.qualificationCircuit && <p className="mt-3 rounded-lg bg-gold-500/10 p-3 text-sm text-gold-300" data-testid="qualification-route">{circuitAdvancement(e.details) || "Final stage · qualifiers from all continents"}</p>}
                <TournamentTimetable event={e} />
                {totalEntrants !== null && e.details?.format !== "team" && (
                  <p
                    className="mt-3 text-sm text-ink"
                    data-testid="entry-count"
                  >
                    {Math.min(
                      e.fieldSize,
                      totalEntrants + (registered ? 1 : 0),
                    )}{" "}
                    / {e.fieldSize} registered
                    {registered ? " · includes you" : ""}
                    {full && !registered ? " · full" : ""}
                  </p>
                )}
                {invitation && (
                  <p className="mt-3 text-sm text-ink-muted">
                    Organizer-selected showmatch · up to{" "}
                    {e.details!.showcase!.perCountry} rising stars per country,
                    up to {e.details!.showcase!.countries} countries · age{" "}
                    {e.details!.showcase!.maxAge} and under ·{" "}
                    {e.details!.rounds} rounds. Current selection:{" "}
                    {invitation.entrants.length + (invitation.invited ? 1 : 0)}{" "}
                    players from {invitation.countries} countries.{" "}
                    {invitation.invited
                      ? "Your organizer invitation is available."
                      : "Public registration is unavailable. Reach your national top five and a selected delegation to earn an invitation."}
                  </p>
                )}
                {e.details?.reference && (
                  <a
                    href={e.details.reference.url}
                    rel="noreferrer"
                    target="_blank"
                    className="mt-3 inline-block text-xs text-gold-300 underline"
                  >
                    FIDE reference · listed {e.details.reference.startDate} ·
                    checked {e.details.reference.observedAt}
                  </a>
                )}
                {e.details?.historicalSchedule && (
                  <a
                    href={e.details.historicalSchedule.source}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs text-gold-400 underline"
                  >
                    Historical date / format source · FIDE
                  </a>
                )}
                <Entrants event={e} /></details>
                <p className="mt-3 text-xs text-ink-muted">
                  {issues.length
                    ? `Missing: ${issues.join(" · ")}`
                    : "Entry requirements met"}
                </p>
                <Button
                  className="mt-3"
                  data-testid="register"
                  disabled={
                    registrationIssue(save, e, npcs) !== null ||
                    full ||
                    (invitation !== null && !invitation.invited) ||
                    registered ||
                    played ||
                    closed ||
                    issues.length > 0 ||
                    !afford ||
                    conflict
                  }
                  onClick={() =>
                    result(invitation ? acceptInvitation(e) : register(e))
                  }
                >
                  {registered
                    ? "Registered"
                    : played
                      ? "Already played"
                      : notOpen
                        ? "Not open yet"
                        : closed
                          ? "Deadline passed"
                          : conflict
                            ? "Schedule conflict"
                            : issues.length
                              ? "Not eligible"
                              : !afford
                                ? "Cannot afford"
                                : invitation
                                  ? invitation.invited
                                    ? "Accept invitation"
                                    : "Invitation only"
                                  : full
                                    ? "Full"
                                    : "Register"}
                </Button>
              </li>
            );
          })}
        </ul>
        {!filtered.length && (
          <p className="text-sm text-ink-muted">
            No matching events in the next 52 weeks.
          </p>
        )}
        {filtered.length > limit && (
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => setLimit((n) => n + 6)}
          >
            Show more tournaments ({filtered.length - limit})
          </Button>
        )}
      </Card>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <CareerTools/>

    </div>
  );
}
