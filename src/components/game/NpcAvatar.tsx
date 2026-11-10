import { useMemo } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { npcAppearance } from "@/game/appearance/npcAppearance";
import type { Npc } from "@/types";

interface Props {
  npc: Pick<Npc, "id" | "name" | "gender">;
  size?: "sm" | "md" | "lg";
  /** A portrait next to the same visible name should not repeat the button's name. */
  decorative?: boolean;
}

export function NpcAvatar({ npc, size = "sm", decorative = false }: Props) {
  const appearance = useMemo(() => npcAppearance(npc), [npc.id, npc.gender]);
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
        size={size}
      />
    </span>
  );
}
