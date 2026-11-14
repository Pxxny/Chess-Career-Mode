import { useMemo } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { npcAppearance } from "@/game/appearance/npcAppearance";
import type { Npc } from "@/types";

interface Props {
  npc: Pick<Npc, "id" | "name" | "gender"> & Partial<Pick<Npc, "realProfile"|"age"|"nationality"|"birthPlace">>;
  size?: "sm" | "md" | "lg";
  /** A portrait next to the same visible name should not repeat the button's name. */
  decorative?: boolean;
}

export function NpcAvatar({ npc, size = "sm", decorative = false }: Props) {
  const appearance = useMemo(
    () => npcAppearance(npc),
    [npc.id, npc.gender, npc.realProfile?.portraitId,npc.age,npc.nationality,npc.birthPlace?.countryCode],
  );
  return (
    <span
      data-npc-portrait={npc.id}
      aria-hidden={decorative ? true : undefined}
      className="shrink-0"
    >
      <Avatar
        name={npc.name}
        seed={npc.id}
        appearance={appearance}
        age={npc.age} gender={npc.gender}
        size={size}
      />
    </span>
  );
}
