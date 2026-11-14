import type { ReactNode } from "react";
import { CharacterPortrait } from "@/components/game/CharacterPortrait";
import { Badge } from "@/components/ui";
import { describeAppearance } from "@/data/appearance";
import { getArchetype } from "@/data/archetypes";
import { getTier, tierForElo } from "@/data/chess/tiers";
import { GAME_CONFIG } from "@/data/config";
import { getEra } from "@/data/eras";
import { SKILL_DEFINITIONS } from "@/data/skills";
import { ageAtStart, MONTH_NAMES } from "@/game/player/birth";
import { createStartingSkills } from "@/game/player/createPlayer";
import { formatMoney } from "@/utils/format";
import type { CharacterDraft } from "../useCharacterDraft";
import { genderLabel } from "./IdentityStep";
import { databaseChoice } from "@/game/npc/playerDatabase";
import { initialPlayerCount, creationEstimate } from "../databaseEstimate";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-white/5 py-2.5 sm:flex-row sm:gap-4">
      <dt className="w-36 shrink-0 text-sm text-ink-muted">{label}</dt>
      <dd className="text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

export function ConfirmStep({ draft }: { draft: CharacterDraft }) {
  const { country, city } = draft;
  const archetype = getArchetype(draft.archetype);
  const skills = createStartingSkills(archetype.id);
  const p = GAME_CONFIG.player;
  const league = getTier(tierForElo(p.startingRating)).leagueName;
  const start = [
    ["Starting Elo", String(p.startingRating)],
    ["Peak Elo", String(p.startingRating)],
    ["Rated games", String(p.startingRatedGames)],
    ["League", league],
    ["Money", formatMoney(p.startingMoney)],
    ["Action points", `${p.startingActionPoints}/${p.maxActionPoints}`],
    ["Morale", String(p.startingMorale)],
    ["Age", String(ageAtStart(draft.birthDate, draft.startYear))],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <CharacterPortrait
          appearance={draft.appearance} age={ageAtStart(draft.birthDate,draft.startYear)} gender={draft.gender}
          label={`${draft.name} portrait`}
          className="h-36 w-36 shrink-0 border-2 border-gold-500/70"
        />
        <dl className="w-full">
          <Row label="Name">
            <span translate="no">{draft.name.trim()}</span>
          </Row>
          <Row label="Gender">{genderLabel(draft.gender)}</Row>
          <Row label="Date of birth">
            {draft.birthDate.day} {MONTH_NAMES[draft.birthDate.month - 1]}{" "}
            {draft.birthDate.year}
          </Row>
          <Row label="Nationality">
            <span aria-hidden>{country?.flag}</span> {country?.nationality} (
            {country?.name})
          </Row>
          <Row label="City">
            <span translate="no">{city?.name}</span>{" "}
            {city?.custom && <Badge>Custom city</Badge>}
          </Row>
          <Row label="Birth place">
            <span translate="no">
              {draft.separateBirthPlace ? draft.birthCity.trim() : city?.name}
            </span>
            ,{" "}
            <span>
              {draft.separateBirthPlace
                ? draft.birthCountry?.name
                : country?.name}
            </span>
          </Row>
          <Row label="Federation">
            {country
              ? `${country.federation.name} (${country.federation.code})`
              : "–"}
          </Row>
          <Row label="Player archetype">{archetype.label}</Row>
          <Row label="Appearance">
            <span className="font-medium text-ink-muted">
              {describeAppearance(draft.appearance)}
            </span>
          </Row>
          <Row label="Career start year">
            {draft.startYear}{" "}
            <span className="font-medium text-ink-muted">
              · {getEra(draft.startYear).name}
            </span>
          </Row>
          <Row label="Alternate history">
            {draft.alternateHistory ? "On" : "Off"}
          </Row>
          <Row label="Player Database">
            <span translate="no">
              {databaseChoice(draft.playerDatabase).label}
            </span>{" "}
            ·{" "}
            {initialPlayerCount(
              draft.playerDatabase,
              draft.startYear,
            ).toLocaleString("en-US")}{" "}
            profiles
          </Row>
          <Row label="Estimated creation time">
            {creationEstimate(draft.playerDatabase, draft.startYear).lower}–
            {creationEstimate(draft.playerDatabase, draft.startYear).upper} s
          </Row>
        </dl>
      </div>

      <div>
        <h3 className="mb-3 font-display text-lg font-bold text-ink">
          Starting values
        </h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {start.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-navy-900 p-3">
              <dt className="text-xs text-ink-faint">{label}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          {SKILL_DEFINITIONS.map(({ key, label }) => (
            <li
              key={key}
              className="flex justify-between border-b border-white/5 py-1"
            >
              <span className="text-ink-muted">{label}</span>
              <span className="font-semibold tabular-nums text-ink">
                {skills[key]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="rounded-lg border border-gold-500/30 bg-gold-500/5 p-3 text-sm text-ink">
        Your birth place and career start year become permanent. You may apply
        to change federation later. Your NPC world is built for{" "}
        {draft.startYear} and saved with this career.
      </p>
    </div>
  );
}
