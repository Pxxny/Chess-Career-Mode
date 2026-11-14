import { randomAppearance,appearanceFor } from "@/data/appearance";
import { LEGEND_APPEARANCES } from "@/data/chess/legendAppearances";
import { createRng } from "@/game/rng";
import { hashString } from "@/utils/format";
import type { Appearance, Npc } from "@/types";

/** Stable base identity with age and origin styling; independent of rank and Elo. */
export function npcAppearance(
  npc: Pick<Npc, "id" | "gender"> & Partial<Pick<Npc, "realProfile"|"age"|"nationality"|"birthPlace">>,
): Appearance {
  const likeness = LEGEND_APPEARANCES[npc.realProfile?.portraitId ?? npc.id];
  if (likeness) return appearanceFor(likeness,npc.gender,npc.age);
  const a=randomAppearance(
    createRng(hashString(`npc-portrait-v1:${npc.id}`)).next,
    npc.gender,
  );
  const rng=createRng(hashString(`npc-face-family:${npc.id}`));
  const code=npc.birthPlace?.countryCode??npc.nationality;
  const pool=['RU','UA','BY','PL','CZ','SK','RS','BG'].includes(code??'')?['slavic-soft','slavic-defined']:['CN','JP','KR','TW','MN'].includes(code??'')?['east-asian-soft','east-asian-defined']:null;
  if(pool&&rng.next()<.75){a.facePreset=pool[Math.floor(rng.next()*pool.length)];const east=pool[0].startsWith('east-asian');const skin=east?['fair','light','tan','olive','brown']:['porcelain','fair','light','tan'];a.skinTone=skin[Math.floor(rng.next()*skin.length)];const hair=east?['black','black','darkbrown']:['black','darkbrown','brown','blond','auburn'];a.hairColor=hair[Math.floor(rng.next()*hair.length)];const eyes=east?['darkbrown','brown']:['brown','blue','grey','green'];a.eyeColor=eyes[Math.floor(rng.next()*eyes.length)];}
  return appearanceFor(a,npc.gender,npc.age);
}
