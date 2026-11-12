import { useState } from "react";
import { Button, Card, CardTitle } from "@/components/ui";
import { useGameStore } from "@/store/gameStore";
import { useNpcStore } from "@/store/npcStore";
import { createBackup, downloadBackup } from "@/store/backup";
import { matchRunning } from "@/store/matchLocks";
export function BackupPanel() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = useGameStore((s) => s.save)!;
  const progress = useGameStore((s) => s.calendarProgress);
  const npcStatus = useNpcStore((s) => s.status);
  async function exportFile() {
    if (progress || matchRunning(save.career.id)) {
      setError("Finish the running activity first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const current = useGameStore.getState().save,
        world = useNpcStore.getState();
      if (
        !current ||
        current.career.id !== world.careerId ||
        world.status !== "ready"
      )
        throw new Error("Wait for the NPC world to finish loading.");
      downloadBackup(await createBackup(current, world.npcs));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The backup could not be exported.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mb-4" data-testid="backup-panel">
      <CardTitle>Career backup</CardTitle>
      <p className="mb-3 text-sm text-ink-muted">
        Download your character, progress and complete NPC world as a file.
        Restore it into an empty slot on the character screen.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !!progress || npcStatus !== "ready"}
          onClick={exportFile}
        >
          {busy ? "Exporting…" : "Export backup"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => useGameStore.getState().leaveSave()}
          disabled={busy || !!progress || !!save.pendingMatch}
        >
          Your characters
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
