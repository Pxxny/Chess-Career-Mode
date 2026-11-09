import { sanitizeAppearance } from "@/data/appearance";
import { getArchetype } from "@/data/archetypes";
import { tierForElo } from "@/data/chess/tiers";
import { GAME_CONFIG } from "@/data/config";
import { SKILL_DEFINITIONS } from "@/data/skills";
import { createStartingAttributes } from "@/game/training/state";
import { ageAtStart, resolveBirthDate, toIsoDate } from "./birth";
import type { NewCareerOptions, Player, SkillKey, Skills } from "@/types";

/** Base skill plus the archetype's bonuses. Nothing is locked: every skill stays trainable. */
export function createStartingSkills(
  archetypeId: NewCareerOptions["archetype"],
): Skills {
  const { startingSkill, minSkill, maxSkill } = GAME_CONFIG.player;
  const archetype = getArchetype(archetypeId);
  return Object.fromEntries(
    SKILL_DEFINITIONS.map(({ key }) => {
      const value = startingSkill + (archetype.skillBonuses[key] ?? 0);
      return [key, Math.min(maxSkill, Math.max(minSkill, value))];
    }),
  ) as Record<SkillKey, number>;
}

export function createPlayer(
  options: NewCareerOptions,
  startYear: number,
): Player {
  const { player: p } = GAME_CONFIG;
  const archetype = getArchetype(options.archetype);
  const name =
    options.name.trim().slice(0, GAME_CONFIG.maxNameLength) ||
    GAME_CONFIG.defaultPlayerName;
  const birth = resolveBirthDate(options.dateOfBirth, startYear);
  return {
    id: "player",
    name,
    avatarSeed: `${name}-${Date.now()}`,
    gender: options.gender,
    archetype: archetype.id,
    appearance: sanitizeAppearance(options.appearance),
    tendencies: { ...archetype.tendencies },
    dateOfBirth: toIsoDate(birth),
    birthPlace: options.birthPlace
      ? {
          ...options.birthPlace,
          city: options.birthPlace.city.trim().slice(0, 100),
          source: "chosen",
        }
      : {
          countryCode: options.countryCode,
          city: options.city.name,
          source: "chosen",
        },
    age: ageAtStart(birth, startYear),
    country: options.countryCode,
    city: options.city,
    careerStartYear: startYear,
    rating: p.startingRating,
    peakRating: p.startingRating,
    ratedGames: p.startingRatedGames,
    league: tierForElo(p.startingRating),
    morale: p.startingMorale,
    reputation: p.startingReputation,
    ap: { current: p.startingActionPoints, max: p.maxActionPoints },
    money: p.startingMoney,
    skills: createStartingSkills(archetype.id),
    attributes: createStartingAttributes(createStartingSkills(archetype.id)),
    createdAt: Date.now(),
  };
}
