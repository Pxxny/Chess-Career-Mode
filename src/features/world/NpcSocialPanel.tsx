import { useEffect, useState } from "react";
import { Badge, Button, ProgressBar } from "@/components/ui";
import { useGameStore } from "@/store/gameStore";
import { useSave } from "@/hooks/useGame";
import { useMatchRunning } from "@/store/matchLocks";
import { dayLabel, gameDay } from "@/game/competition/agenda";
import {
  relationshipAt,
  relationshipLabel,
  socialActionIssue,
  type SocialAction,
} from "@/game/social/relationships";
import type { Npc } from "@/types";

export function NpcSocialPanel({
  npc,
  onPlayAccepted,
}: {
  npc: Npc;
  onPlayAccepted: () => void;
}) {
  const save = useSave(),
    approach = useGameStore((s) => s.approachNpc),
    calendar = useGameStore((s) => s.calendarProgress);
  const running = useMatchRunning(save.career.id);
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    setOpen(false);
    setMessage("");
  }, [npc.id]);
  const r = relationshipAt(save, npc.id);
  const actions: { id: SocialAction; label: string }[] = [
    { id: "talk", label: "Talk · 1 AP · 30 min" },
    { id: "study", label: "Study together · 1 AP · 1 h" },
    { id: "play", label: "Play friendly · 1 AP · 1 h on start" },
  ];
  const act = (action: SocialAction) => {
    const result = approach(npc.id, action);
    setMessage(result.ok ? result.message : result.error);
    if (result.ok && result.accepted && action === "play") onPlayAccepted();
  };
  return (
    <section
      aria-label="Relationship and NPC actions"
      className="mb-5 rounded-lg border border-white/10 bg-navy-900/70 p-3 sm:p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Your relationship</p>
          <Badge>{relationshipLabel(r)}</Badge>
        </div>
        <Button
          variant="secondary"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          Actions
        </Button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-ink-muted">
            Familiarity {r.familiarity}/100
          </p>
          <ProgressBar value={r.familiarity} label="Familiarity" />
        </div>
        <div>
          <p className="mb-1 text-xs text-ink-muted">
            Closeness {r.closeness}/100
          </p>
          <ProgressBar value={r.closeness} label="Closeness" />
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Shared tournaments: {r.sharedEvents} · Rated meetings: {r.ratedGames} ·
        Casual games together: {r.friendlyGames}
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        Tournament encounters build familiarity. Friendship grows through mutual
        social activities, not through playing rivals repeatedly.
      </p>
      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-ink-muted">
            Talk or study online, or invite this player to a friendly board
            game. They may decline. One approach per player per day; declined
            invitations spend no AP or hours.
          </p>
          {actions.map((action) => {
            const issue =
              calendar || running
                ? "Finish the running activity first."
                : socialActionIssue(save, npc, action.id);
            return (
              <div key={action.id}>
                <Button
                  variant="secondary"
                  className="w-full justify-center whitespace-normal text-center"
                  disabled={!!issue}
                  onClick={() => act(action.id)}
                >
                  {action.label}
                </Button>
                {issue && (
                  <p className="mt-1 text-xs text-ink-faint">{issue}</p>
                )}
              </div>
            );
          })}
          {r.rewardWeek === Math.floor(gameDay(save) / 7) &&
            r.rewardPoints >= 12 && (
              <p className="text-xs text-ink-muted">
                Weekly closeness growth reached (12 points). Shared study still
                gives training experience.
              </p>
            )}
          <p className="text-xs text-ink-faint">
            Closeness fades gradually after long periods without social contact.
          </p>
          <p className="text-xs text-ink-muted">
            Conversations: {r.chats} · Shared study: {r.studies} · Your rated
            record: {r.wins}W {r.draws}D {r.losses}L
          </p>
          <ul className="space-y-1 text-xs text-ink-faint">
            {(save.social?.log ?? [])
              .filter((e) => e.npcId === npc.id)
              .slice(-3)
              .reverse()
              .map((e) => (
                <li key={e.id}>
                  {dayLabel(e.day)} · {e.message}
                </li>
              ))}
          </ul>
        </div>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-gold-300">
          {message}
        </p>
      )}
    </section>
  );
}
