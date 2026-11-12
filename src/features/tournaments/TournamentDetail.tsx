import { useMatchRunning } from "@/store/matchLocks";
import { useMemo, useState } from "react";
import { useNpcs } from "@/hooks/useNpcs";
import { calendarField } from "@/game/competition/worldCalendar";
import { previewEntrants } from "@/game/match/registration";
import { buildEventTeams } from "@/game/competition/teamEvents";
import { teamInfoOf } from "@/data/chess/nationalTeamEvents";
import { Button, Modal, Tabs } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { getCountry } from "@/data/world/countries";
import {
  dayLabel,
  bookedStart,
  bookedEnd,
  maximumPlayerGames,
  tournamentReady,
  tournamentSlot,
  gameDay,
} from "@/game/competition/agenda";
import { registrationWindow } from "@/game/competition/registrationWindow";
import { standings } from "@/game/match/tournament";
import { eventKind, type ArchivedEvent } from "@/game/competition/archive";
import type { ActiveTournament } from "@/types";
import type { ScheduledEvent } from "@/game/world/schedule";
import { BroadcastBoard, RecordedBoard } from "./BroadcastBoard";
export function TournamentDetail({
  event,
  record,
  tournament,
  onClose,
}: {
  event?: ScheduledEvent;
  record?: ArchivedEvent;
  tournament?: ActiveTournament;
  onClose: () => void;
}) {
  const save = useSave(),
    npcs = useNpcs(),
    running = useMatchRunning(save.career.id),
    id = tournament?.eventId ?? record?.id ?? event!.id;
  const t =
    save.tournament?.eventId === id
      ? save.tournament
      : (tournament ??
        save.calendarTournaments?.active.find((t) => t.eventId === id));
  const teamEntry = save.calendarTournaments?.national.find(
    (n) => n.event.id === id,
  );
  const [tab, setTab] = useState<"details" | "pairings" | "standings">(
      "details",
    ),
    [round, setRound] = useState(
      (t?.round ?? record?.pairings.length ?? 1) - 1,
    ),
    [watch, setWatch] = useState<number | null>(null);
  const preview = useMemo<ArchivedEvent["players"]>(() => {
    if (!event || t || record || gameDay(save) > bookedEnd(event)) return [];
    const reg = save.registrations.find((r) => r.eventId === id);
    if (event.details?.format === "team") {
      const teams =
        teamEntry?.teams ??
        buildEventTeams(save, npcs, teamInfoOf(event.details), !!reg);
      return teams.map((team) => ({
        id: team.country,
        name: getCountry(team.country)?.name ?? team.country,
        countryCode: team.country,
        elo: 0,
        title: "none",
        rank: 0,
        points: 0,
        members: [...team.players, ...(team.reserves ?? [])],
      }));
    }
    const field = reg
      ? previewEntrants(save, event, npcs)
      : calendarField(save, event, npcs);
    return [
      ...(reg
        ? [
            {
              id: "player",
              name: save.player.name,
              elo: save.player.rating,
              title: "none" as const,
              countryCode: save.player.country,
              points: 0,
              rank: 0,
            },
          ]
        : []),
      ...field.map((n) => ({
        id: n.id,
        name: n.name,
        elo: n.currentElo,
        title: n.title,
        countryCode: n.nationality,
        points: 0,
        rank: 0,
      })),
    ];
  }, [event, t, record, save, npcs, id, teamEntry]);
  const players = t?.players ?? record?.players ?? preview,
    pairings = t?.pairings ?? record?.pairings ?? [];
  const pairs = pairings[round] ?? [];
  const start =
      record?.startDay ??
      (event
        ? bookedStart(event)
        : (t?.startedOnDay ?? (t!.year * 52 + t!.week - 1) * 7)),
    end =
      record?.endDay ??
      (event ? bookedEnd(event) : start + (t?.details?.agenda?.days ?? 1) - 1);
  const d = t?.details ?? event?.details,
    window = event ? registrationWindow(save, event) : null;
  const rows: Array<[string, string | number]> = [
    [
      "Event type",
      (record?.kind ?? eventKind({ details: d })) === "national"
        ? "National teams"
        : "Regular tournaments",
    ],
    [
      "Location",
      `${record?.location ?? d?.location ?? "Not recorded"}${(record?.country ?? d?.country) ? `, ${getCountry(record?.country ?? d?.country ?? "")?.name ?? record?.country ?? d?.country}` : ""}`,
    ],
    [
      "Start",
      record?.datePrecision === "week"
        ? `Year ${record.year}, week ${record.week}`
        : dayLabel(start).slice(0, 10),
    ],
    [
      "End",
      record?.datePrecision === "week"
        ? "Exact day not recorded"
        : dayLabel(end).slice(0, 10),
    ],
    [
      "Participant limit",
      record?.fieldSize ?? t?.players.length ?? event!.fieldSize,
    ],
    ["Rounds", t?.rounds ?? record?.rounds ?? d?.rounds ?? "Not recorded"],
    [
      "Max games per player",
      record
        ? (record.gamesPerEntrant ?? record.rounds) || "Not recorded"
        : maximumPlayerGames({
            details: d,
            fieldSize: t?.players.length ?? event!.fieldSize,
          }),
    ],
    ["Format", record?.format ?? d?.format ?? "Not recorded"],
    [
      "Time control",
      record?.timeControl ?? d?.timeControl.label ?? "Not recorded",
    ],
    ...(window
      ? [
          [
            "Registration window",
            `${dayLabel(window.open).slice(0, 10)} – ${dayLabel(window.close).slice(0, 10)}`,
          ] as [string, string],
        ]
      : []),
  ];
  const selected = watch === null ? null : pairs[watch];
  const boardReady =
    t &&
    t.status === "playing" &&
    round === t.round - 1 &&
    (save.tournament?.eventId === t.eventId
      ? tournamentReady(save)
      : tournamentSlot(t).absoluteDay === gameDay(save)) &&
    !save.pendingMatch &&
    !running;
  return (
    <Modal
      open
      title={record?.name ?? t?.name ?? event!.name}
      translateTitle={false}
      onClose={onClose}
      size="game"
    >
      <div data-testid="tournament-detail">
        {selected && t && selected.result === null && boardReady ? (
          <BroadcastBoard
            key={`${id}-${round}-${watch}`}
            t={t}
            context={{
              careerId: save.career.id,
              eventId: id,
              round: round + 1,
              board: watch!,
              white: selected.white,
              black: selected.black,
            }}
            onBack={() => setWatch(null)}
          />
        ) : selected?.broadcast ? (
          <RecordedBoard
            broadcast={selected.broadcast}
            onBack={() => setWatch(null)}
          />
        ) : (
          <Tabs
            label="Event details sections"
            tabs={[
              { id: "details", label: "Event details" },
              { id: "pairings", label: "Pairings & live boards" },
              { id: "standings", label: "Standings" },
            ]}
            active={tab}
            onChange={setTab}
          >
            {tab === "details" && (
              <>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {rows.map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-ink-muted">{label}</dt>
                      <dd
                        className="mt-1 font-semibold"
                        data-testid={
                          label === "Location"
                            ? "event-host"
                            : label === "Registration window"
                              ? "registration-window"
                              : undefined
                        }
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {event && (
                  <p className="mt-4 text-xs text-ink-muted">
                    Calendar entries describe the career schedule. Results
                    appear in tournament history only after they have actually
                    been recorded in this save.
                  </p>
                )}
                {record && !pairings.length && (
                  <p className="mt-4 text-sm text-ink-muted">
                    Only a retained result summary is available for this older
                    event. No moves or pairings were invented.
                  </p>
                )}
              </>
            )}
            {tab === "pairings" && (
              <div className="space-y-3">
                <p className="text-xs text-ink-muted">
                  Watch NPC boards in the current playable round. Your own board
                  is played from the tournament screen. Unwatched games use the
                  existing round simulation.
                </p>
                {record?.teamBoards?.length ? (
                  <>
                    <p>Recorded team boards</p>
                    <ul className="divide-y divide-white/10">
                      {record.teamBoards.map((b, i) => (
                        <li key={i} className="py-2 text-sm">
                          <p translate="no">
                            {b.white} — {b.black}
                          </p>
                          <p>
                            #{b.round} ·{" "}
                            {b.score === 1
                              ? "1–0"
                              : b.score === 0
                                ? "0–1"
                                : "½–½"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : pairings.length > 0 ? (
                  <>
                    <label className="block text-sm">
                      Round
                      <select
                        aria-label="Spectator round"
                        className="ml-3 rounded-lg bg-navy-900 p-3"
                        value={round}
                        onChange={(e) => {
                          setRound(Number(e.target.value));
                          setWatch(null);
                        }}
                      >
                        {pairings.map((_, i) => (
                          <option key={i} value={i}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                    <ul className="divide-y divide-white/10">
                      {pairs.map((p, i) => {
                        const w = players.find((n) => n.id === p.white),
                          b = players.find((n) => n.id === p.black),
                          canLive =
                            boardReady &&
                            p.result === null &&
                            p.white !== "player" &&
                            p.black !== "player" &&
                            p.black !== "bye";
                        return (
                          <li
                            key={`${p.white}-${p.black}`}
                            className="py-3 text-sm"
                            data-testid="spectator-pair"
                          >
                            <p translate="no" className="font-semibold">
                              {w?.name ?? p.white} — {b?.name ?? p.black}
                            </p>
                            <p className="mt-1 text-xs text-ink-muted">
                              {p.result === null
                                ? "Waiting / in progress"
                                : p.result === 1
                                  ? "1–0"
                                  : p.result === 0
                                    ? "0–1"
                                    : "½–½"}
                            </p>
                            {canLive ? (
                              <Button
                                className="mt-2"
                                onClick={() => setWatch(i)}
                              >
                                Watch live board
                              </Button>
                            ) : p.broadcast?.ucis.length ? (
                              <Button
                                className="mt-2"
                                variant="secondary"
                                onClick={() => setWatch(i)}
                              >
                                Replay recorded board
                              </Button>
                            ) : (
                              <p className="mt-1 text-xs text-ink-muted">
                                {p.white === "player" || p.black === "player"
                                  ? "Your board"
                                  : p.result === null
                                    ? "This round is not playable yet."
                                    : "No move recording for this result."}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p>No pairings recorded for this event.</p>
                )}
              </div>
            )}
            {tab === "standings" && (
              <>
                <p className="mb-3 text-xs text-ink-muted">
                  {t || record
                    ? "Standings after completed rounds."
                    : teamEntry
                      ? "National event in progress. Final team totals appear when it finishes."
                      : event?.details?.format === "team"
                        ? "Projected national squads · selections may change before the event starts."
                        : "Announced entrants · rankings and points appear after games are played."}
                </p>
                {players.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Player / team</th>
                          <th>Points</th>
                          <th>Elo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(t
                          ? standings(t).map((r) => ({
                              ...r.player,
                              rank: r.rank,
                            }))
                          : (record?.players ?? preview)
                        ).map((p) => (
                          <tr key={p.id} data-testid="standing-participant">
                            <td className="py-2 align-top">
                              {t || record ? p.rank : "—"}
                            </td>
                            <td className="py-2 pr-3">
                              <span translate="no">{p.name}</span>
                              <p
                                className="text-xs text-ink-muted"
                                translate="no"
                              >
                                {getCountry(p.countryCode)?.flag}{" "}
                                {getCountry(p.countryCode)?.name ??
                                  p.countryCode}
                              </p>
                              {"members" in p &&
                                Array.isArray(p.members) &&
                                p.members.length > 0 && (
                                  <details className="mt-2 text-xs">
                                    <summary>Team roster</summary>
                                    <ul className="mt-2 space-y-1">
                                      {p.members.map((m) => (
                                        <li key={m.id} translate="no">
                                          {m.name} · {m.elo}
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                )}
                            </td>
                            <td className="py-2 align-top">
                              {t || record ? p.points : "—"}
                            </td>
                            <td className="py-2 align-top">
                              {p.elo > 0 ? p.elo : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>
                    {event && gameDay(save) <= bookedEnd(event)
                      ? "No entrants announced yet. Names appear as registration opens and eligible NPCs enter."
                      : "No participant list was saved for this older event. Current NPCs are not substituted for historical entrants."}
                  </p>
                )}
              </>
            )}
          </Tabs>
        )}
      </div>
    </Modal>
  );
}
