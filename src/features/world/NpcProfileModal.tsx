import { WonderkidTags } from "./WonderkidTags";
import { EloChart } from "@/features/profile/EloChart";
import { SharedMemories } from "./SharedMemories";
import { Badge, Modal, ProgressBar } from "@/components/ui";
import { NpcAvatar } from "@/components/game/NpcAvatar";
import { getLegendCareerStage } from "@/game/npc/legends";
import { useGameStore } from "@/store/gameStore";
import { useNpcStore } from "@/store/npcStore";
import { getOpening } from "@/data/chess/openings";
import { getCountry } from "@/data/world/countries";
import type { Npc } from "@/types";
import type { ReactNode } from "react";
import { NpcSocialPanel } from "./NpcSocialPanel";
import {
  playerDirectoryEntry,
  npcDirectoryRank,
} from "@/game/social/directory";
import {
  capitalize,
  leagueName,
  skillLabel,
  STATUS_LABELS,
  tierLabel,
} from "./npcLabels";

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd
        translate={
          label === "City" &&
          value !== "National circuit" &&
          value !== "Not recorded"
            ? "no"
            : undefined
        }
        className="text-sm font-semibold text-ink"
      >
        {value}
      </dd>
    </div>
  );
}

export function NpcProfileModal({
  npc: selectedNpc,
  onClose,
}: {
  npc: Npc | null;
  onClose: () => void;
}) {
  const save = useGameStore((s) => s.save);
  const world = save?.world;
  const npcs = useNpcStore((s) => s.npcs);
  const currentNpc = useNpcStore((s) =>
    selectedNpc ? s.npcs.find((n) => n.id === selectedNpc.id) : undefined,
  );
  const npc = currentNpc ?? selectedNpc;
  if (!npc) return null;
  const country = getCountry(npc.nationality);
  const h = npc.historical;
  const openings = npc.preferredOpenings
    .map((id) => getOpening(id)?.name ?? id)
    .join(", ");
  const rank = save
    ? npcDirectoryRank(npc, playerDirectoryEntry(save, npcs).worldRank)
    : npc.worldRank;

  return (
    <Modal
      open
      title={npc.name}
      translateTitle={false}
      onClose={onClose}
      size="lg"
    >
      <div className="mb-4 flex items-center gap-3">
        <NpcAvatar npc={npc} size="lg" />
        <div className="flex min-w-0 flex-wrap gap-2">
          <Badge tone="gold">{tierLabel(npc.tier)}</Badge>
          {(npc.realProfile?.officialTitle || npc.title !== "none") && (
            <Badge tone="gold">
              {npc.realProfile?.officialTitle || npc.title}
            </Badge>
          )}
          <Badge>{STATUS_LABELS[npc.careerStatus]}</Badge>
          <WonderkidTags id={npc.id}/>
          {npc.kind === "legend" && <Badge>Historical legend</Badge>}
          {npc.kind === "real" && <Badge>FIDE player</Badge>}
        </div>
      </div>

      <NpcSocialPanel npc={npc} onPlayAccepted={onClose} />
      {npc.realProfile && (
        <p className="mb-4 text-xs text-ink-muted">
          FIDE snapshot: {npc.realProfile.snapshotDate}. Name, federation, title
          and starting rating come from the source. Styles, skills and training
          are game estimates. Results after career creation are simulated.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Fact
          label={npc.realProfile ? "Federation" : "Nationality"}
          value={`${country?.flag ?? ""} ${(npc.realProfile ? country?.name : country?.nationality) ?? npc.nationality}`}
        />
        <Fact label="City" value={npc.city} />
        <Fact
          label="Birth place"
          value={
            npc.birthPlace ? (
              <>
                <span translate="no">{npc.birthPlace.city}</span>,{" "}
                <span>
                  {getCountry(npc.birthPlace.countryCode)?.name ??
                    npc.birthPlace.countryCode}
                </span>
              </>
            ) : (
              "Not recorded"
            )
          }
        />
        <Fact label="Gender" value={capitalize(npc.gender)} />
        <Fact
          label="Date of birth"
          value={
            npc.realProfile
              ? `${npc.realProfile.birthYear} · Year only`
              : npc.dateOfBirth
          }
        />
        <Fact
          label="Age"
          value={npc.realProfile ? `≈ ${npc.age}` : String(npc.age)}
        />
        <Fact label="World ranking" value={rank ? `#${rank}` : "Unranked"} />
        <Fact label="Current Elo" value={String(npc.currentElo)} />
        <Fact
          label={npc.realProfile ? "Peak Elo in this save" : "Peak Elo"}
          value={String(npc.peakElo)}
        />
        <Fact label="Potential" value={String(npc.potentialRating)} />
        <Fact label="League" value={leagueName(npc.league)} />
        <Fact label="Playing style" value={capitalize(npc.style)} />
        <Fact label="Personality" value={capitalize(npc.personality)} />
        <Fact
          label="Career start"
          value={npc.realProfile ? "Not recorded" : String(npc.careerStartYear)}
        />
      </dl>

      <div className="mt-5"><EloChart npc={npc}/></div>
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
            Historical peak year: {h.peakYear}. Current career Elo includes
            simulated competition results.{" "}
            {h.eloSource === "estimate"
              ? "Elo values are retrospective estimates."
              : "Elo values are FIDE-era figures, rounded."}
          </p>
        </div>
      )}

      {save && <SharedMemories save={save} npcId={npc.id} />}
      <div className="mt-5">
        <p className="mb-2 text-sm text-ink-muted">Tournament history</p>
        {npc.competitionStats && (
          <p className="mb-3 text-xs text-ink-muted">
            Career rated games: {npc.competitionStats.games} ·{" "}
            {npc.competitionStats.wins}W {npc.competitionStats.draws}D{" "}
            {npc.competitionStats.losses}L
          </p>
        )}
        {npc.tournamentHistory.length === 0 ? (
          <p className="text-sm text-ink-faint">
            No recorded results. World Circuit events run as career weeks
            advance.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {[...npc.tournamentHistory].reverse().map((t, i) => (
              <li
                key={`${t.year}-${i}`}
                className="flex justify-between gap-3 py-2"
              >
                <span className="min-w-0 truncate text-ink">
                  {t.year}
                  {t.week ? ` / W${t.week}` : ""} · {t.event}
                  {t.source && (
                    <span className="block text-xs text-ink-faint">
                      {t.source === "career"
                        ? "Career tournament"
                        : t.source === "calendar"
                          ? "Calendar tournament"
                          : t.source === "esports"
                            ? "Esports team event"
                            : "Simulated world circuit"}
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-ink-muted">
                  {t.fieldSize === 2
                    ? t.rank === 1
                      ? "Won"
                      : "Lost"
                    : `${t.rank} of ${t.fieldSize}`}
                  {t.points !== undefined && t.games
                    ? ` · ${t.points}/${t.rounds ?? t.games}`
                    : ""}
                  {t.draws !== undefined && (
                    <span className="block text-xs">
                      {t.wins}W {t.draws}D {t.losses}L
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
