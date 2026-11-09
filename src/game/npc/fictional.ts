import { culturalName } from "./identity";
import {
  COUNTRY_WEIGHTS,
  DEFAULT_COUNTRY_WEIGHT,
  eraMultiplier,
} from "@/data/world/countryWeights";
import { cultureFor } from "@/data/world/cultures";
import { OPENINGS } from "@/data/chess/openings";
import {
  EVENT_FIELD_SIZE,
  EVENT_PATTERNS,
  type EventLevel,
} from "@/data/chess/tournaments";
import { PERSONALITIES, PLAY_STYLES, STYLE_PROFILE } from "@/data/chess/traits";
import { ADULT_AGE, eloCapForAge, minAgeForElo } from "@/data/chess/ages";
import {
  TIERS,
  eraEloCeiling,
  getTier,
  higherTitle,
  tierForElo,
  titleForPeak,
  type TierDefinition,
} from "@/data/chess/tiers";
import type {
  Gender,
  Npc,
  PlayStyle,
  SkillKey,
  SkillTier,
  TournamentResult,
  TrainingIntensity,
} from "@/types";
import { createRng, mixSeed, type Rng } from "../rng";
import type { GenCountry, WorldGenContext } from "./types";

const SKILL_KEYS: SkillKey[] = [
  "opening",
  "middlegame",
  "endgame",
  "tactics",
  "calculation",
  "strategy",
  "timeManagement",
  "psychology",
];
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const pad = (n: number, width: number) => String(n).padStart(width, "0");

function assignTiers(seed: number, count: number, year: number): SkillTier[] {
  const era = clamp(0.3 + (0.7 * (year - 1950)) / 76, 0.3, 1);
  const counts = TIERS.map((t) => ({
    id: t.id,
    n:
      year < t.minYear
        ? 0
        : Math.floor(t.share * count * (t.scalesWithEra ? era : 1)),
  }));
  const assigned = counts.reduce((sum, c) => sum + c.n, 0);
  counts.find((c) => c.id === "club")!.n += count - assigned;
  const list = counts.flatMap((c) => Array<SkillTier>(c.n).fill(c.id));
  return createRng(mixSeed(seed, 7)).shuffle(list);
}

function pickCountry(
  rng: Rng,
  countries: GenCountry[],
  def: TierDefinition,
  year: number,
): GenCountry {
  return rng.weighted(
    countries,
    (c) =>
      ((COUNTRY_WEIGHTS[c.code] ?? DEFAULT_COUNTRY_WEIGHT) *
        eraMultiplier(c.code, year)) **
      def.countryBias,
  );
}

function pickOpenings(rng: Rng, style: PlayStyle): string[] {
  const choose = (side: "white" | "black", n: number) => {
    const pool = OPENINGS.filter((o) => o.side === side);
    const picked: string[] = [];
    for (let i = 0; i < n; i++) {
      const left = pool.filter((o) => !picked.includes(o.id));
      picked.push(
        rng.weighted(left, (o) => (o.styles.includes(style) ? 4 : 1)).id,
      );
    }
    return picked;
  };
  return [...choose("white", rng.int(1, 2)), ...choose("black", 2)];
}

function pickTraits(rng: Rng, style: PlayStyle) {
  const profile = STYLE_PROFILE[style];
  const strengths: SkillKey[] = [];
  const count = rng.int(2, 3);
  while (strengths.length < count) {
    const skill = rng.chance(0.75)
      ? rng.pick(profile.strengths)
      : rng.pick(SKILL_KEYS);
    if (!strengths.includes(skill)) strengths.push(skill);
  }
  const weaknesses: SkillKey[] = [];
  const weakCount = rng.int(1, 2);
  let guard = 0;
  while (weaknesses.length < weakCount && guard++ < 40) {
    const skill = rng.chance(0.75)
      ? rng.pick(profile.weaknesses)
      : rng.pick(SKILL_KEYS);
    if (!strengths.includes(skill) && !weaknesses.includes(skill))
      weaknesses.push(skill);
  }
  return { strengths, weaknesses };
}

function intensityFor(hours: number): TrainingIntensity {
  if (hours < 3) return "minimal";
  if (hours < 8) return "casual";
  if (hours < 18) return "regular";
  if (hours < 32) return "intense";
  return "obsessive";
}

function eventLevel(tier: SkillTier, rng: Rng): EventLevel {
  const roll = rng.next();
  switch (tier) {
    case "beginner":
      return "local";
    case "amateur":
      return roll < 0.8 ? "local" : "national";
    case "club":
      return roll < 0.55 ? "local" : "national";
    case "professional":
      return roll < 0.3 ? "local" : roll < 0.8 ? "national" : "international";
    case "international-master":
      return roll < 0.5 ? "national" : "international";
    case "grandmaster":
      return roll < 0.2 ? "national" : roll < 0.75 ? "international" : "elite";
    default:
      return roll < 0.5 ? "international" : "elite";
  }
}

function buildHistory(
  rng: Rng,
  ctx: WorldGenContext,
  def: TierDefinition,
  homeCity: string,
  country: GenCountry,
  elo: number,
  careerStart: number,
): TournamentResult[] {
  const results: TournamentResult[] = [];
  const firstYear = Math.max(careerStart + 1, ctx.startYear - 7);
  const eventsPerYear = clamp(Math.round(def.weeklyHours[1] / 14), 1, 3);
  for (let year = firstYear; year < ctx.startYear; year++) {
    const events = rng.int(0, eventsPerYear);
    for (let e = 0; e < events; e++) {
      const level = eventLevel(def.id, rng);
      const host =
        level === "local" || rng.chance(0.4)
          ? country
          : rng.pick(ctx.countries);
      const cities = ctx.seedCities(host.code);
      const city =
        host === country && rng.chance(0.6)
          ? homeCity
          : cities.length
            ? rng.pick(cities)
            : (host.capital ?? host.name);
      const real = ctx.eventsForYear(year).filter((ev) => ev.level === level);
      const event =
        real.length > 0 && rng.chance(0.4)
          ? rng.pick(real).name
          : rng
              .pick(EVENT_PATTERNS[level])
              .replace("{city}", city)
              .replace("{demonym}", host.demonym)
              .replace("{continent}", host.continent);
      const [minField, maxField] = EVENT_FIELD_SIZE[level];
      const fieldSize = rng.int(minField, maxField);
      const games =
        level === "elite"
          ? clamp(fieldSize - 1, 7, 13)
          : level === "local"
            ? rng.int(5, 7)
            : 9;
      const fieldMean = elo + rng.int(-180, 120);
      const expected = clamp(0.5 + (elo - fieldMean) / 900, 0.1, 0.9);
      const points = clamp(
        Math.round((games * expected + rng.normal(0, 1)) * 2) / 2,
        0,
        games,
      );
      const share = 1 - points / games;
      const rank = clamp(
        Math.round(share * fieldSize * rng.float(0.5, 1.2)) + 1,
        1,
        fieldSize,
      );
      results.push({ year, event, rank, fieldSize, points, games });
    }
  }
  return results.slice(-8);
}

/**
 * Adults follow a bell curve around the tier's typical age. A small share of each tier is under 18:
 * mostly teenagers, with the occasional child prodigy, and never younger than the tier's rating allows.
 */
export function sampleAge(rng: Rng, def: TierDefinition): number {
  const [minAge, maxAge] = def.age;
  if (rng.chance(def.youthShare)) {
    const youthMin = Math.max(minAge, minAgeForElo(def.minElo));
    if (youthMin < ADULT_AGE)
      return Math.min(
        ADULT_AGE - 1,
        youthMin + Math.floor((ADULT_AGE - youthMin) * Math.sqrt(rng.next())),
      );
  }
  const adultMin = Math.max(ADULT_AGE, minAge);
  for (let attempt = 0; attempt < 40; attempt++) {
    const age = Math.round(rng.normal(def.ageMean, def.ageSd));
    if (age >= adultMin && age <= maxAge) return age;
  }
  return clamp(Math.round(def.ageMean), adultMin, maxAge);
}

function generateOne(
  ctx: WorldGenContext,
  index: number,
  tier: SkillTier,
  taken: Set<string>,
): Npc {
  const rng = createRng(mixSeed(ctx.seed, index + 1000));
  const def = getTier(tier);

  const country = pickCountry(rng, ctx.countries, def, ctx.startYear);
  const culture = cultureFor(country.code, country.continent);
  const gender: Gender = rng.chance(def.femaleShare) ? "female" : "male";
  const name = culturalName(rng, culture, gender, taken);
  const cities = ctx.seedCities(country.code);
  const city = cities.length
    ? rng.pick(cities)
    : (country.capital ?? country.name);

  const age = sampleAge(rng, def);
  const birthYear = ctx.startYear - age - 1;
  const dateOfBirth = `${birthYear}-${pad(rng.int(2, 12), 2)}-${pad(rng.int(1, 28), 2)}`;

  const spread = (rng.next() + rng.next()) / 2;
  const ceiling = eraEloCeiling(ctx.startYear);
  let currentElo = def.minElo + Math.round((def.maxElo - def.minElo) * spread);
  if (currentElo > ceiling) currentElo = ceiling - rng.int(0, 30);
  // A young player can be far above their tier's average but never above what their age allows.
  const ageCap = eloCapForAge(age);
  if (currentElo > ageCap)
    currentElo = Math.max(def.minElo, ageCap - rng.int(0, 30));

  let peakElo = currentElo;
  if (age >= 33)
    peakElo += Math.round(
      rng.int(0, 60) * clamp((age - 30) / 20, 0.2, 1.2) * def.peakFactor,
    );
  else if (age >= 24) peakElo += Math.round(rng.int(0, 25) * def.peakFactor);

  peakElo = Math.max(currentElo, Math.min(peakElo, ceiling));
  const talent = 0.3 + rng.next() * 1.2;
  const growthYears = Math.max(0, 27 - age);
  const potentialRating = Math.max(
    peakElo,
    Math.min(
      ceiling + 40,
      peakElo +
        Math.round((growthYears * (4 + talent * 10) * def.growthFactor) / 2),
    ),
  );

  const style = rng.pick(PLAY_STYLES);
  const { strengths, weaknesses } = pickTraits(rng, style);

  const startAge = Math.min(
    age,
    rng.int(
      def.startAge[0],
      Math.max(def.startAge[0], Math.min(def.startAge[1], age)),
    ),
  );
  const careerStartYear = birthYear + startAge;

  const weeklyHours = rng.int(def.weeklyHours[0], def.weeklyHours[1]);
  const tierIndex = TIERS.findIndex((t) => t.id === tier);

  let careerStatus: Npc["careerStatus"] = "active";
  if (age >= 62) careerStatus = rng.chance(0.75) ? "retired" : "semi-retired";
  else if (age >= 55 && tierIndex >= 3 && rng.chance(0.35))
    careerStatus = "semi-retired";
  else if (rng.chance(0.03)) careerStatus = "inactive";

  return {
    id: `npc-${pad(index + 1, 4)}`,
    kind: "fictional",
    name,
    nameVersion: 1,
    birthPlace: { countryCode: country.code, city, source: "generated" },
    nationality: country.code,
    city,
    gender,
    dateOfBirth,
    age,
    currentElo,
    peakElo,
    worldRank: null,
    league: tierForElo(currentElo),
    tier,
    title: titleForPeak(peakElo),
    style,
    personality: rng.pick(PERSONALITIES),
    strengths,
    weaknesses,
    preferredOpenings: pickOpenings(rng, style),
    careerStartYear,
    careerStatus,
    potentialRating,
    morale: clamp(Math.round(rng.normal(60, 14)), 15, 95),
    form: clamp(Math.round(rng.normal(55, 15)), 10, 95),
    training: {
      intensity: intensityFor(weeklyHours),
      weeklyHours,
      focus: rng.chance(0.55) ? rng.pick(weaknesses) : rng.pick(strengths),
      hasCoach: rng.chance(def.coachChance),
      usesEngine: rng.chance(def.engineChance),
    },
    tournamentHistory: buildHistory(
      rng,
      ctx,
      def,
      city,
      country,
      currentElo,
      careerStartYear,
    ),
  };
}

/** Deterministic: the same context always produces the same NPCs with the same IDs. */
export function generateFictionalNpcs(ctx: WorldGenContext): Npc[] {
  const tiers = assignTiers(ctx.seed, ctx.fictionalCount, ctx.startYear);
  const taken = new Set<string>();
  return tiers.map((tier, index) => generateOne(ctx, index, tier, taken));
}

export { higherTitle };
