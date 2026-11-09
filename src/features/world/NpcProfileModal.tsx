import { Badge, Modal, ProgressBar } from "@/components/ui";
import { getLegendCareerStage } from "@/game/npc/legends";
import { useGameStore } from "@/store/gameStore";
import { getOpening } from "@/data/chess/openings";
import { getCountry } from "@/data/world/countries";
import type { Npc } from "@/types";
import {
  capitalize,
  leagueName,
  skillLabel,
  STATUS_LABELS,
  tierLabel,
} from "./npcLabels";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

export function NpcProfileModal({
  npc,
  onClose,
}: {
  npc: Npc | null;
  onClose: () => void;
}) {
  const world = useGameStore((s) => s.save?.world);
  if (!npc) return null;
  const country = getCountry(npc.nationality);
  const h = npc.historical;
  const openings = npc.preferredOpenings
    .map((id) => getOpening(id)?.name ?? id)
    .join(", ");

  return (
    <Modal open title={npc.name} onClose={onClose} size="lg">
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="gold">{tierLabel(npc.tier)}</Badge>
        {npc.title !== "none" && <Badge tone="gold">{npc.title}</Badge>}
        <Badge>{STATUS_LABELS[npc.careerStatus]}</Badge>
        {npc.kind === "legend" && <Badge>Historical legend</Badge>}
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Fact
          label="Nationality"
          value={`${country?.flag ?? ""} ${country?.nationality ?? npc.nationality}`}
        />
        <Fact label="City" value={npc.city} />
        <Fact
          label="Birth place"
          value={
            npc.birthPlace
              ? `${npc.birthPlace.city}, ${getCountry(npc.birthPlace.countryCode)?.name ?? npc.birthPlace.countryCode}`
              : "Not recorded"
          }
        />
        <Fact label="Gender" value={capitalize(npc.gender)} />
        <Fact label="Date of birth" value={npc.dateOfBirth} />
        <Fact label="Age" value={String(npc.age)} />
        <Fact
          label="World ranking"
          value={npc.worldRank ? `#${npc.worldRank}` : "Unranked"}
        />
        <Fact label="Current Elo" value={String(npc.currentElo)} />
        <Fact label="Peak Elo" value={String(npc.peakElo)} />
        <Fact label="Potential" value={String(npc.potentialRating)} />
        <Fact label="League" value={leagueName(npc.league)} />
        <Fact label="Playing style" value={capitalize(npc.style)} />
        <Fact label="Personality" value={capitalize(npc.personality)} />
        <Fact label="Career start" value={String(npc.careerStartYear)} />
      </dl>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-sm text-ink-muted">Strengths</p>
          <p className="text-sm font-semibold text-ink">
            {npc.strengths.map(skillLabel).join(", ")}
          </p>
        </div>
        <div>
          <p className="mb-1 text-sm text-ink-muted">Weaknesses</p>
          <p className="text-sm font-semibold text-ink">
            {npc.weaknesses.map(skillLabel).join(", ")}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm text-ink-muted">Preferred openings</p>
          <p className="text-sm font-semibold text-ink">{openings}</p>
        </div>
        <div>
          <p className="mb-1.5 text-sm text-ink-muted">Morale {npc.morale}</p>
          <ProgressBar value={npc.morale} label="Morale" />
        </div>
        <div>
          <p className="mb-1.5 text-sm text-ink-muted">Form {npc.form}</p>
          <ProgressBar value={npc.form} label="Form" />
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm text-ink-muted">Training habits</p>
          <p className="text-sm font-semibold text-ink">
            {capitalize(npc.training.intensity)}, {npc.training.weeklyHours}{" "}
            hours a week, focus on{" "}
            {skillLabel(npc.training.focus).toLowerCase()}
            {npc.training.hasCoach ? ", works with a coach" : ""}
            {npc.training.usesEngine ? ", trains with an engine" : ""}
          </p>
        </div>
      </div>

      {h && (
        <div className="mt-5 rounded-lg bg-navy-900 p-4 text-sm">
          <p className="font-semibold text-ink">
            {h.birthYear}–{h.deathYear ?? "present"} · active {h.activeFrom}–
            {h.activeTo ?? "present"}
          </p>
          {world && (
            <p className="mt-1 font-semibold text-gold-300">
              {getLegendCareerStage(
                npc,
                world.date.year,
                world.alternateHistory,
              )}
            </p>
          )}
          <p className="mt-1 text-ink-muted">{h.historicalTitles.join("; ")}</p>
          <p className="mt-1 text-xs text-ink-faint">
            Peak {npc.peakElo} in {h.peakYear}.{" "}
            {h.eloSource === "estimate"
              ? "Elo values are retrospective estimates."
              : "Elo values are FIDE-era figures, rounded."}
          </p>
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-sm text-ink-muted">Tournament history</p>
        {npc.tournamentHistory.length === 0 ? (
          <p className="text-sm text-ink-faint">No recorded results.</p>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {[...npc.tournamentHistory].reverse().map((t, i) => (
              <li
                key={`${t.year}-${i}`}
                className="flex justify-between gap-3 py-2"
              >
                <span className="min-w-0 truncate text-ink">
                  {t.year} · {t.event}
                </span>
                <span className="shrink-0 tabular-nums text-ink-muted">
                  {t.fieldSize === 2
                    ? t.rank === 1
                      ? "Won"
                      : "Lost"
                    : `${t.rank} of ${t.fieldSize}`}
                  {t.points !== undefined && t.games
                    ? ` · ${t.points}/${t.games}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
