import { Avatar, Badge, Modal, ProgressBar } from "@/components/ui";
import { getCountry } from "@/data/world/countries";
import { getArchetype } from "@/data/archetypes";
import { skillLabel, capitalize, leagueName, tierLabel } from "./npcLabels";
import { useSave } from "@/hooks/useGame";
import { useNpcs } from "@/hooks/useNpcs";
import { useOpeningDb } from "@/store/openingStore";
import { playerDirectoryEntry } from "@/game/social/directory";
import { playerActor } from "@/game/prediction/adapters";
import { activeCoach } from "@/game/career/expansion";
import { relationshipAt, relationshipLabel } from "@/game/social/relationships";
import type { SkillKey } from "@/types";

export function ProfileFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="break-words text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}
export function PlayerProfileModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const save = useSave(),
    npcs = useNpcs(),
    db = useOpeningDb();
  if (!open) return null;
  const p = save.player,
    entry = playerDirectoryEntry(save, npcs),
    country = getCountry(p.country),
    archetype = getArchetype(p.archetype);
  const ordered = Object.entries(p.skills).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const skills = (rows: [string, number][]) =>
    rows
      .map(([key, value]) => `${skillLabel(key as SkillKey)} ${value}`)
      .join(", ");
  const recent = save.history.games.slice(-10);
  const form = recent.length
    ? Math.round(
        (recent.reduce(
          (s, g) =>
            s + (g.outcome === "win" ? 1 : g.outcome === "draw" ? 0.5 : 0),
          0,
        ) /
          recent.length) *
          100,
      )
    : null;
  const openings = [
    ...new Set([
      ...save.repertoire.preferences.white,
      ...save.repertoire.preferences.black,
    ]),
  ].map((id) => db.byId.get(id)?.name ?? id);
  const sessions = save.history.sessions.filter(
    (s) =>
      (save.world.date.year - s.year) * 52 + save.world.date.week - s.week < 8,
  );
  const coachName = activeCoach(save)?.name;
  const relationships = Object.values(save.social?.relationships ?? {})
    .map((r) => relationshipAt(save, r.npcId))
    .filter((r) => r.closeness >= 10)
    .sort((a, b) => b.closeness - a.closeness)
    .slice(0, 5);
  const facts: [string, string][] = [
    [
      "Nationality",
      `${country?.flag ?? ""} ${country?.nationality ?? p.country}`,
    ],
    ["City", p.city.name],
    [
      "Birth place",
      p.birthPlace
        ? `${p.birthPlace.city}, ${getCountry(p.birthPlace.countryCode)?.name ?? p.birthPlace.countryCode}`
        : "Not recorded",
    ],
    ["Gender", capitalize(p.gender)],
    ["Date of birth", p.dateOfBirth],
    ["Age", String(p.age)],
    ["World ranking", `#${entry.worldRank}`],
    ["Current Elo", String(p.rating)],
    ["Peak Elo", String(p.peakRating)],
    ["Potential", "No fixed Elo ceiling"],
    ["League", leagueName(p.league)],
    [
      "Playing style",
      capitalize(playerActor(save).style ?? archetype.playStyle),
    ],
    ["Archetype", archetype.label],
    ["Career start", String(p.careerStartYear)],
    ["Rated games", String(p.ratedGames)],
  ];
  return (
    <Modal open title={p.name} onClose={onClose} size="lg">
      <div className="mb-4 flex items-center gap-3">
        <Avatar
          name={p.name}
          seed={p.avatarSeed}
          appearance={p.appearance}
          size="lg"
        />
        <div className="flex flex-wrap gap-2">
          <Badge tone="gold">You</Badge>
          <Badge>{tierLabel(p.league)}</Badge>
          <Badge>Active</Badge>
          {entry.title !== "none" && <Badge tone="gold">{entry.title}</Badge>}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <ProfileFact key={label} label={label} value={value} />
        ))}
      </dl>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <ProfileFact
          label="Strengths · highest current skills"
          value={skills(ordered.slice(0, 2))}
        />
        <ProfileFact
          label="Areas to improve · lowest current skills"
          value={skills(ordered.slice(-2))}
        />
        <div className="sm:col-span-2">
          <ProfileFact
            label="Archetype traits"
            value={archetype.traits.join("; ")}
          />
        </div>
        <div className="sm:col-span-2">
          <ProfileFact
            label="Preferred openings"
            value={
              openings.slice(0, 12).join(", ") ||
              "No repertoire preferences selected yet."
            }
          />
        </div>
        <div>
          <p className="mb-1.5 text-sm text-ink-muted">Morale {p.morale}</p>
          <ProgressBar value={p.morale} label="Morale" />
        </div>
        <div>
          <p className="mb-1.5 text-sm text-ink-muted">
            Recent form {form ?? "–"}
          </p>
          {form === null ? (
            <p className="text-sm text-ink-faint">No rated games yet.</p>
          ) : (
            <>
              <ProgressBar value={form} label="Recent form" />
              <p className="mt-1 text-xs text-ink-faint">
                Score percentage over the last {recent.length} retained rated
                games.
              </p>
            </>
          )}
        </div>
        <div className="sm:col-span-2">
          <ProfileFact
            label="Training habits"
            value={`${sessions.length} retained training sessions in the last 8 weeks${coachName ? `; coached by ${coachName}` : "; no active coach"}.`}
          />
        </div>
      </div>
      <div className="mt-5 rounded-lg bg-navy-900 p-4 text-sm">
        <p className="font-semibold text-ink">
          {p.careerStartYear}–present · your career
        </p>
        <p className="mt-1 text-ink-muted">{archetype.tagline}</p>
        <p className="mt-1 text-xs text-ink-faint">
          Details reflect your saved character, current skills and recorded
          results.
        </p>
      </div>
      <div className="mt-5">
        <p className="mb-2 text-sm font-semibold text-ink">
          Tournament history
        </p>
        {!save.history.tournaments.length && !save.esports?.history.length ? (
          <p className="text-sm text-ink-faint">
            No completed tournaments yet.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {[...save.history.tournaments].reverse().map((t) => (
              <li
                key={t.tournamentId}
                className="flex justify-between gap-3 py-2"
              >
                <span className="min-w-0 break-words">
                  {t.year} / W{t.week} · {t.name}
                </span>
                <span className="shrink-0 text-ink-muted">
                  {t.rank} of {t.fieldSize} · {t.points} pts
                </span>
              </li>
            ))}
            {[...(save.esports?.history ?? [])].reverse().map((c) => (
              <li key={c.event.id} className="flex justify-between gap-3 py-2">
                <span>{c.event.name} · Esports</span>
                <span className="shrink-0">
                  {c.rank ?? "–"} of {c.teams.length}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-5">
        <p className="mb-2 text-sm font-semibold text-ink">Relationships</p>
        {relationships.length ? (
          <ul className="space-y-2 text-sm">
            {relationships.map((r) => (
              <li key={r.npcId}>
                {npcs.find((n) => n.id === r.npcId)?.name ?? "Former player"} ·{" "}
                {relationshipLabel(r)} · closeness {r.closeness}/100
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-faint">
            Get to know players through conversations, shared study and casual
            games.
          </p>
        )}
      </div>
    </Modal>
  );
}
