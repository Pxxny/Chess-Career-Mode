import {
  cultureFor,
  formatCultureName,
  type NameCulture,
} from "@/data/world/cultures";
import { getCountry } from "@/data/world/countries";
import { createRng, type Rng } from "@/game/rng";
import { hashString } from "@/utils/format";
import type { Gender, Npc } from "@/types";

export const NPC_NAME_VERSION = 1;
const usage = new WeakMap<Set<string>, Map<string, number>>();
/** Balance given/family names rather than repeatedly drawing from a small pool. */
export function culturalName(
  rng: Rng,
  culture: NameCulture,
  gender: Gender,
  taken: Set<string>,
): string {
  let counts = usage.get(taken);
  if (!counts) {
    counts = new Map();
    usage.set(taken, counts);
  }
  const given = gender === "female" ? culture.female : culture.male;
  const score = (g: string, s: string) =>
    (counts!.get(`g:${g}`) ?? 0) + (counts!.get(`s:${s}`) ?? 0);
  let best: { g: string; s: string; score: number } | undefined;
  for (let i = 0; i < 64; i++) {
    const g = rng.pick(given),
      s = rng.pick(culture.surnames);
    if (taken.has(formatCultureName(culture, g, s, gender))) continue;
    const value = score(g, s);
    if (!best || value < best.score) best = { g, s, score: value };
    if (value === 0) break;
  }
  if (!best) {
    for (const g of given) {
      const s = culture.surnames.find(
        (family) => !taken.has(formatCultureName(culture, g, family, gender)),
      );
      if (s) {
        best = { g, s, score: 0 };
        break;
      }
    }
  }
  // A second real given name expands an exhausted finite pool without fake initials or Jr. suffixes.
  if (!best) {
    outer: for (const g of given)
      for (const middle of given) {
        if (g === middle) continue;
        const compound = `${g} ${middle}`;
        const s = culture.surnames.find(
          (family) =>
            !taken.has(formatCultureName(culture, compound, family, gender)),
        );
        if (s) {
          best = { g: compound, s, score: 0 };
          break outer;
        }
      }
  }
  if (!best)
    throw new Error("Fictional name pool exhausted. Add more cultural names.");
  counts.set(`g:${best.g}`, (counts.get(`g:${best.g}`) ?? 0) + 1);
  counts.set(`s:${best.s}`, (counts.get(`s:${best.s}`) ?? 0) + 1);
  const name = formatCultureName(culture, best.g, best.s, gender);
  taken.add(name);
  return name;
}

/** Additive, idempotent NPC upgrade: never resets ratings, ages, IDs or results; real legends retain their names. */
export function upgradeNpcIdentities(npcs: Npc[]): Npc[] {
  const taken = new Set(
    npcs.filter((n) => n.kind === "legend").map((n) => n.name),
  );
  const keep = new Set<string>();
  for (const n of npcs)
    if (
      n.kind === "fictional" &&
      n.nameVersion === NPC_NAME_VERSION &&
      !taken.has(n.name)
    ) {
      taken.add(n.name);
      keep.add(n.id);
    }
  let changed = false;
  const next = npcs.map((n) => {
    if (n.kind === "legend") return n;
    const country = getCountry(n.nationality);
    const name = keep.has(n.id)
      ? n.name
      : culturalName(
          createRng(hashString(`${n.id}:${n.nationality}:names-v1`)),
          cultureFor(n.nationality, country?.continent ?? "Europe"),
          n.gender,
          taken,
        );
    if (name === n.name && n.nameVersion === NPC_NAME_VERSION && n.birthPlace)
      return n;
    changed = true;
    return {
      ...n,
      name,
      nameVersion: NPC_NAME_VERSION,
      birthPlace: n.birthPlace ?? {
        countryCode: n.nationality,
        city: n.city,
        source: "generated" as const,
      },
    };
  });
  return changed ? next : npcs;
}
