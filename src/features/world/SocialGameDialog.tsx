import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { useGameStore } from "@/store/gameStore";
import { useNpcStore } from "@/store/npcStore";
import { useOpeningDb } from "@/store/openingStore";
import { FRIENDLY_CONTROLS } from "@/game/social/friendly";
import { MatchViewer } from "@/features/match/MatchViewer";
import type { MatchSetup } from "@/game/match/session";
import type { PieceColor } from "@/types";

export function SocialGameDialog() {
  const pending = useGameStore((s) => s.save?.social?.pending),
    careerId = useGameStore((s) => s.save?.career.id);
  const begin = useGameStore((s) => s.beginFriendly),
    cancel = useGameStore((s) => s.cancelFriendly),
    db = useOpeningDb();
  const npc = useNpcStore((s) => s.npcs.find((n) => n.id === pending?.npcId));
  const [setup, setSetup] = useState<MatchSetup | null>(null),
    [error, setError] = useState("");
  const [color, setColor] = useState<PieceColor>("white"),
    [timeControlId, setTimeControlId] = useState(FRIENDLY_CONTROLS[1].id);
  if (setup && setup.social?.careerId === careerId)
    return (
      <Modal
        open
        title={`Friendly game · ${setup.white.isPlayer ? setup.black.name : setup.white.name}`}
        size="game"
        onClose={() => {
          if (
            pending?.started &&
            !window.confirm(
              "Leave this friendly game? An unfinished session gives no friendship reward.",
            )
          )
            return;
          setSetup(null);
          cancel();
        }}
      >
        <MatchViewer
          setup={setup}
          onExit={() => {
            setSetup(null);
            cancel();
          }}
        />
      </Modal>
    );
  if (!pending || pending.started) return null;
  const start = () => {
    const result = begin({ color, timeControlId, speed: "brisk" }, db);
    if (result.ok) {
      setError("");
      setSetup(result.setup);
    } else setError(result.error);
  };
  return (
    <Modal
      open
      title={`Friendly invitation · ${npc?.name ?? "Player"}`}
      onClose={cancel}
    >
      <p className="text-sm text-ink-muted">
        Your invitation was accepted. Starting uses 1 AP and 1 training hour.
        This game does not change either player's career Elo.
      </p>
      <label className="mt-4 block text-sm text-ink">
        Your colour
        <select
          aria-label="Friendly game colour"
          className="mt-1 w-full rounded-lg bg-navy-900 p-3"
          value={color}
          onChange={(e) => setColor(e.target.value as PieceColor)}
        >
          <option value="white">White</option>
          <option value="black">Black</option>
        </select>
      </label>
      <label className="mt-3 block text-sm text-ink">
        Time control
        <select
          aria-label="Friendly time control"
          className="mt-1 w-full rounded-lg bg-navy-900 p-3"
          value={timeControlId}
          onChange={(e) => setTimeControlId(e.target.value)}
        >
          {FRIENDLY_CONTROLS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-3 text-xs text-ink-faint">
        Closeness grows after a meaningful game you participate in. Cancelling,
        abandoning or only simulating a game gives no friendship reward.
      </p>
      {error && (
        <p role="status" className="mt-3 text-sm text-gold-300">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={start}>Start friendly game</Button>
        <Button variant="secondary" onClick={cancel}>
          Cancel invitation
        </Button>
      </div>
    </Modal>
  );
}
