import { LEGENDS, type LegendSeed } from "@/data/chess/legends";
import { tierForElo } from "@/data/chess/tiers";
import type { CareerStatus, Npc, RatingPoint } from "@/types";
import { ageOn, yearOf } from "@/utils/dates";

export function interpolateElo(points: RatingPoint[], year: number): number {
  if (year <= points[0].year) return points[0].elo;
  const last = points[points.length - 1];
  if (year >= last.year) return last.elo;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (year <= b.year)
      return Math.round(
        a.elo + ((b.elo - a.elo) * (year - a.year)) / (b.year - a.year),
      );
  }
  return last.elo;
}

function toNpc(seed: LegendSeed): Npc {
  const birthYear = yearOf(seed.dob);
  return {
    id: `legend-${seed.slug}`,
    kind: "legend",
    name: seed.name,
    nationality: seed.country,
    city: seed.city,
    gender: seed.gender ?? "male",
    dateOfBirth: seed.dob,
    age: 0,
    currentElo: seed.peakElo,
    peakElo: seed.peakElo,
    worldRank: null,
    league: tierForElo(seed.peakElo),
    tier: "legendary",
    title: seed.title ?? "GM",
    style: seed.style,
    personality: seed.personality,
    strengths: seed.strengths,
    weaknesses: seed.weaknesses,
    preferredOpenings: seed.openings,
    careerStartYear: seed.activeFrom,
    careerStatus: "retired",
    potentialRating: seed.peakElo,
    morale: 80,
    form: 80,
    training: {
      intensity: "obsessive",
      weeklyHours: 50,
      focus: seed.strengths[0],
      hasCoach: true,
      usesEngine: false,
    },
    tournamentHistory: seed.events.map(([year, event, rank, fieldSize]) => ({
      year,
      event,
      rank,
      fieldSize,
    })),
    historical: {
      birthYear,
      deathYear: seed.deathDate ? yearOf(seed.deathDate) : null,
      activeFrom: seed.activeFrom,
      activeTo: seed.activeTo,
      peakYear: seed.peakYear,
      ratingHistory: seed.ratings.map(([year, elo]) => ({ year, elo })),
      eloSource: seed.eloSource,
      historicalTitles: seed.titles,
    },
  };
}

export const buildLegendNpcs = (): Npc[] => LEGENDS.map(toNpc);

/** Where a legend is in their life and career for a given game year. */
export function resolveLegend(
  npc: Npc,
  year: number,
  week: number,
  alternateHistory: boolean,
) {
  const h = npc.historical!;
  if (alternateHistory) {
    return {
      currentElo: npc.simulationPeakBase ?? npc.peakElo,
      age: h.peakYear - h.birthYear,
      careerStatus: "active" as CareerStatus,
    };
  }
  const first = h.ratingHistory[0].elo;
  const last = h.ratingHistory[h.ratingHistory.length - 1].elo;
  const deathYear = h.deathYear;
  const ageNow = ageOn(
    npc.dateOfBirth,
    deathYear !== null ? Math.min(year, deathYear) : year,
    week,
  );

  if (year < h.activeFrom)
    return {
      currentElo: first,
      age: year < h.birthYear ? 0 : ageNow,
      careerStatus: "not-yet-active" as CareerStatus,
    };
  if (deathYear !== null && year > deathYear)
    return {
      currentElo: last,
      age: ageNow,
      careerStatus: "deceased" as CareerStatus,
    };
  if (h.activeTo !== null && year > h.activeTo)
    return {
      currentElo: last,
      age: ageNow,
      careerStatus: "retired" as CareerStatus,
    };
  return {
    currentElo: interpolateElo(h.ratingHistory, year),
    age: ageNow,
    careerStatus: "active" as CareerStatus,
  };
}

/** Describes where a legend is in their career in a given year. */
export function getLegendCareerStage(
  npc: Npc,
  year: number,
  alternateHistory: boolean,
): string {
  const h = npc.historical;
  if (!h) return "";
  if (alternateHistory) return "In their prime";
  if (h.deathYear !== null && year > h.deathYear) return "Deceased";
  if (year < h.activeFrom)
    return year < h.birthYear ? "Not yet born" : "Not yet competing";
  if (h.activeTo !== null && year > h.activeTo) return "Retired";
  const age = year - h.birthYear;
  if (year < h.peakYear - 6) return age < 22 ? "Rising prodigy" : "Rising star";
  if (year <= h.peakYear + 4) return "In their prime";
  if (h.activeTo !== null && year >= h.activeTo - 5) return "Late career";
  return "Established veteran";
}

export interface LegendPreview {
  id: string;
  name: string;
  nationality: string;
  age: number;
  elo: number;
  stage: string;
}

/** Legends the player can meet at the start of a career in `year`, strongest first. */
export function previewLegends(
  year: number,
  alternateHistory: boolean,
): LegendPreview[] {
  return buildLegendNpcs()
    .map((npc) => ({
      npc,
      state: resolveLegend(npc, year, 1, alternateHistory),
    }))
    .filter(({ state }) => state.careerStatus === "active")
    .map(({ npc, state }) => ({
      id: npc.id,
      name: npc.name,
      nationality: npc.nationality,
      age: state.age,
      elo: state.currentElo,
      stage: getLegendCareerStage(npc, year, alternateHistory),
    }))
    .sort((a, b) => b.elo - a.elo);
}
