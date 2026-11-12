import { useState } from "react";
import { Button, Card, CardTitle } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { useNpcs } from "@/hooks/useNpcs";
import { rivalryLabel } from "@/game/social/memories";
import { relationshipLabel } from "@/game/social/relationships";
import { NpcProfileModal } from "@/features/world/NpcProfileModal";
import type { Npc } from "@/types";
export function PeopleStories() {
  const save = useSave(),
    npcs = useNpcs(),
    [selected, setSelected] = useState<Npc | null>(null);
  const people = Object.values(save.social?.relationships ?? {})
    .sort((a, b) => b.ratedGames - a.ratedGames || b.closeness - a.closeness)
    .slice(0, 12);
  const news = save.history.news
    .filter((n) => n.id.startsWith("world-person-"))
    .slice(-8)
    .reverse();
  return (
    <div className="space-y-4" data-testid="people-stories">
      <Card>
        <CardTitle>People in your career</CardTitle>
        <p className="text-sm text-ink-muted">
          Meet opponents repeatedly to build rivalries. Conversations, study and
          friendly games build friendship separately.
        </p>
        {people.length ? (
          <ul className="mt-3 divide-y divide-white/10">
            {people.map((r) => {
              const npc = npcs.find((n) => n.id === r.npcId);
              return (
                npc && (
                  <li key={r.npcId} className="py-3">
                    <Button
                      variant="secondary"
                      onClick={() => setSelected(npc)}
                    >
                      <span translate="no">{npc.name}</span>
                    </Button>
                    <p className="mt-2 text-sm">
                      {rivalryLabel(save, r.npcId)}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {relationshipLabel(r)} · {r.wins}W {r.draws}D {r.losses}L
                    </p>
                  </li>
                )
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            Play an opponent or spend social time with an NPC to start your
            shared story.
          </p>
        )}
      </Card>
      <Card>
        <CardTitle>News about people you know</CardTitle>
        {news.length ? (
          <ul className="space-y-3 text-sm">
            {news.map((n) => (
              <li key={n.id}>
                <p>{n.headline}</p>
                <p className="text-xs text-ink-muted">{n.detail}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            World results appear here as weeks advance. Friends, rivals and
            elite players receive priority.
          </p>
        )}
      </Card>
      <NpcProfileModal npc={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
