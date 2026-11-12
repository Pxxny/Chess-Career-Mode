import { randomAppearance } from "@/data/appearance";
import { LEGEND_APPEARANCES } from "@/data/chess/legendAppearances";
import { createRng } from "@/game/rng";
import { hashString } from "@/utils/format";
import type { Appearance, Npc } from "@/types";

/** Stable character art for existing and new NPCs; never depends on rank, age or Elo. */
export function npcAppearance(
  npc: Pick<Npc, "id" | "gender"> & Partial<Pick<Npc, "realProfile">>,
): Appearance {
  const likeness = LEGEND_APPEARANCES[npc.realProfile?.portraitId ?? npc.id];
  if (likeness) return { ...likeness };
  return randomAppearance(
    createRng(hashString(`npc-portrait-v1:${npc.id}`)).next,
    npc.gender,
  );
}
