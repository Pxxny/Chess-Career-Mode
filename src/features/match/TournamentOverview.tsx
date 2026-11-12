import { getCountry } from "@/data/world/countries";
import { useSave } from "@/hooks/useGame";
import { dayLabel } from "@/game/competition/agenda";
import { registrationWindow } from "@/game/competition/registrationWindow";
import type { ScheduledEvent } from "@/game/world/schedule";
import { teamSpec } from "@/data/chess/nationalTeamEvents";

const descriptions = {
  swiss:
    "Swiss: play opponents on similar scores each round; you do not meet everyone.",
  "round-robin": "Round robin: play every other entrant once.",
  "double-round-robin":
    "Double round robin: play every other entrant twice, once with each colour.",
  "round-robin-bo3":
    "BO3 round robin: play a best-of-three series against every opponent; a tied series needs a decider.",
  knockout: "Knockout: advance by winning each match; a loss eliminates you.",
  match: "Championship match: two players contest a 14-game match.",
  team: "National teams compete across several boards. Team standings use match points and board points.",
};

const purpose: Record<string, string> = {
  "National Championships":
    "National title event. A top-three finish earns a continental qualification in this career.",
  "Continental Championships":
    "Continental title event. A top-three finish earns World Cup and Grand Swiss qualifications.",
  "World Cup":
    "International knockout cup. The top two qualify for the Candidates Tournament.",
  "Grand Swiss":
    "Elite Swiss event. The top two qualify for the Candidates Tournament.",
  "Candidates Tournament":
    "The winner earns qualification for the World Chess Championship match.",
  "World Chess Championship":
    "The final title match on the career championship path.",
  "Classical Super Tournaments":
    "An elite classical field requiring a title, league level or invitation qualification.",
  "Rapid Championships": "A championship played at rapid time controls.",
  "Blitz Championships": "A championship played at blitz time controls.",
  "Rotating Round Robin":
    "A recurring multi-day event. Selected months have larger fields and more games; other months keep shorter editions.",
};

export function TournamentOverview({ event }: { event: ScheduledEvent }) {
  const save = useSave();
  const window = registrationWindow(save, event),
    d = event.details;
  const info = d?.teamEvent,
    spec = info ? teamSpec(info.key) : undefined;
  return (
    <section
      data-testid="tournament-overview"
      className="mt-3 space-y-3 rounded-lg border border-gold-500/25 bg-gold-500/5 p-3 text-sm"
    >
      <h4 className="font-semibold text-gold-300">Tournament guide</h4>
      <p translate="no" className="text-xs text-ink-muted">
        {event.name}
      </p>
      {d && purpose[d.category] && (
        <p className="text-xs text-ink-muted">{purpose[d.category]}</p>
      )}
      <p>
        {d?.showcase
          ? "Invitation showmatch: the organizer selects rising stars to represent their countries."
          : descriptions[d?.format ?? "swiss"]}
      </p>
      {spec && (
        <p className="text-xs text-ink-muted">
          {spec.scope === "world" ||
          (spec.scope === "youth" && !spec.continents)
            ? "National teams from around the world."
            : "Regional national teams only; your federation must belong to this event’s eligible region."}{" "}
          {spec.gender
            ? "Women only."
            : spec.slots
              ? "Team selection must also satisfy the required board composition."
              : "Selection is based on eligible national-team players."}
        </p>
      )}
      {d?.maxAge !== undefined && (
        <p className="text-xs text-ink-muted">
          Junior event: age {d.maxAge} and under.
        </p>
      )}
      <dl className="grid gap-2 text-xs">
        <div>
          <dt className="text-ink-muted">Location</dt>
          <dd className="mt-1" data-testid="event-host">
            {d?.host?.mode === "online"
              ? "Online"
              : `${d?.location ?? "Local venue"}, ${getCountry(d?.country ?? "")?.name ?? d?.country ?? "Home country"}`}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Registration window</dt>
          <dd className="mt-1 tabular-nums" data-testid="registration-window">
            {dayLabel(window.open)} – {dayLabel(window.close)}{" "}
            <span>
              (
              <span>
                {window.status === "upcoming"
                  ? "Not open yet"
                  : window.status === "closed"
                    ? "Registration closed"
                    : "Registration open"}
              </span>
              )
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Capacity</dt>
          <dd className="mt-1">
            {info ? (
              <>
                {info.teams} national teams · {info.boards} starters +{" "}
                {info.reserves} reserves per team
              </>
            ) : (
              <>{event.fieldSize} players including you</>
            )}
          </dd>
        </div>
      </dl>
      {info && (
        <p className="text-xs text-ink-muted">
          National-team selection is required; this is not an individual open
          entry.
        </p>
      )}
      {d?.host?.mode === "rotation" && (
        <p className="text-xs text-ink-muted">
          Host rotates within the eligible region in this career calendar.
        </p>
      )}
      {d?.host?.mode === "online" && (
        <p className="text-xs text-ink-muted">
          Online event: no host-country travel is required.
        </p>
      )}
      {d?.host?.relocationReason && (
        <p className="text-xs text-ink-muted">{d.host.relocationReason}</p>
      )}
    </section>
  );
}
