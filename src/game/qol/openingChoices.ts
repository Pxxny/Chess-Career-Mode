import type { OpeningEntry } from "@/game/openings/types";
/** Representative choices across families first, then every remaining variation. Never discard database entries. */
export function diverseOpeningChoices(
  entries: readonly OpeningEntry[],
): OpeningEntry[] {
  const sorted = [...entries].sort(
    (a, b) =>
      b.popularity - a.popularity ||
      Number(b.isMainLine) - Number(a.isMainLine) ||
      a.depth - b.depth ||
      a.name.localeCompare(b.name),
  );
  const seen = new Set<string>(),
    families: OpeningEntry[] = [],
    variants: OpeningEntry[] = [];
  for (const e of sorted) {
    if (seen.has(e.family)) variants.push(e);
    else {
      seen.add(e.family);
      families.push(e);
    }
  }
  return [...families, ...variants];
}
