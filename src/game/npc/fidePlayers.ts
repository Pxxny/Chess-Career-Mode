import { LEGENDS } from "@/data/chess/legends";
import { OPENINGS } from "@/data/chess/openings";
import { PERSONALITIES, PLAY_STYLES, STYLE_PROFILE } from "@/data/chess/traits";
import { tierForElo } from "@/data/chess/tiers";
import { createRng } from "@/game/rng";
import type { ChessTitle, Npc } from "@/types";
export const FIDE_SNAPSHOT_YEAR = 2026;
export const FIDE_SNAPSHOT_DATE = "2026-11-11";
export const FIDE_PLAYER_COUNT = 20000;
export type FideRow = [number, string, string, string, string, number, number];
export interface FideDataset {
  schema: number;
  snapshotYear: number;
  snapshotDate: string;
  rows: FideRow[];
  count: number;
}
const normalize = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .sort()
    .join(" ");
const likeness = new Map(
  LEGENDS.map((l) => [normalize(l.name), `legend-${l.slug}`]),
);
/** Identity/rating/title/year are factual snapshot fields; all chess/personality traits are game estimates. */
export function fideNpcs(
  data: FideDataset,
  onProgress?: (done: number, total: number) => void,
): Npc[] {
  if (
    data.schema !== 1 ||
    data.snapshotYear !== FIDE_SNAPSHOT_YEAR ||
    !Array.isArray(data.rows) ||
    data.rows.length !== data.count
  )
    throw new Error("Invalid FIDE player snapshot.");
  return data.rows.map(
    ([id, name, country, sex, officialTitle, rating, birthYear], i) => {
      const rng = createRng(id),
        style = rng.pick(PLAY_STYLES),
        traits = STYLE_PROFILE[style];
      const title: ChessTitle = (
        ["CM", "FM", "IM", "GM"].includes(officialTitle)
          ? officialTitle
          : "none"
      ) as ChessTitle;
      const npc: Npc = {
        id: `fide-${id}`,
        kind: "real",
        name,
        nationality: country,
        city: "Not recorded",
        gender: sex === "F" ? "female" : "male",
        dateOfBirth: `${birthYear}-01-01`,
        age: data.snapshotYear - birthYear,
        currentElo: rating,
        peakElo: rating,
        worldRank: null,
        league: tierForElo(rating),
        tier: tierForElo(rating),
        title,
        style,
        personality: rng.pick(PERSONALITIES),
        strengths: [...traits.strengths],
        weaknesses: [...traits.weaknesses],
        preferredOpenings: [
          rng.pick(OPENINGS.filter((o) => o.side === "white")).id,
          rng.pick(OPENINGS.filter((o) => o.side === "black")).id,
        ],
        careerStartYear: data.snapshotYear,
        careerStatus: "active",
        potentialRating: rating,
        morale: 70,
        form: 70,
        training: {
          intensity: "regular",
          weeklyHours: 12,
          focus: traits.strengths[0],
          hasCoach: false,
          usesEngine: true,
        },
        tournamentHistory: [],
        realProfile: {
          fideId: id,
          snapshotDate: data.snapshotDate,
          snapshotYear: data.snapshotYear,
          birthYear,
          officialTitle,
          portraitId: likeness.get(normalize(name)),
        },
      };
      if ((i + 1) % 250 === 0 || i + 1 === data.rows.length)
        onProgress?.(i + 1, data.rows.length);
      return npc;
    },
  );
}
