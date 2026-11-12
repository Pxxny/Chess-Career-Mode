import { useRef, useState } from "react";
import { Button, Modal } from "@/components/ui";
import {
  BACKUP_LIMIT,
  parseBackup,
  restoreBackup,
  type CareerBackup,
} from "@/store/backup";
import { slotManager } from "@/store/saveSlots";
export function ImportBackup({
  onImported,
}: {
  onImported: () => Promise<void>;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<CareerBackup | null>(null),
    [target, setTarget] = useState(0);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function inspect(selected: File) {
    setBusy(true);
    setError("");
    try {
      if (selected.size > BACKUP_LIMIT)
        throw new Error("This backup is too large. Maximum size is 64 MB.");
      const parsed = await parseBackup(await selected.text());
      const free = await slotManager.firstFreeSlot();
      if (free === null)
        throw new Error(
          "No empty slots. Export a backup before deleting any character.",
        );
      setTarget(free);
      setBackup(parsed);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The backup could not be restored.",
      );
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  async function restore() {
    if (!backup) return;
    setBusy(true);
    setError("");
    try {
      await restoreBackup(backup, target);
      setBackup(null);
      await onImported();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The backup could not be restored.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mb-5 rounded-xl border border-white/10 p-4">
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        aria-label="Backup file"
        className="sr-only"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) void inspect(selected);
        }}
      />
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => file.current?.click()}
      >
        {busy ? "Reading backup…" : "Import backup"}
      </Button>
      <p className="mt-2 text-xs text-ink-muted">
        Restore a backup into an empty slot. Existing characters are kept.
      </p>
      {error && (
        <p className="mt-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      <Modal
        open={backup !== null}
        title="Restore this career?"
        onClose={() => {
          if (!busy) setBackup(null);
        }}
      >
        {backup && (
          <>
            <p translate="no" className="font-semibold">
              {backup.payload.save.player.name}
            </p>
            <p className="mt-2 text-sm">
              Elo {backup.payload.save.player.rating} ·{" "}
              {backup.payload.npcs.length} NPCs · Slot {target}
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              This creates an independent copy with the same progress and NPC
              results.
            </p>
            <div className="mt-4 flex gap-2">
              <Button onClick={restore} disabled={busy}>
                Restore backup
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setBackup(null)}
              >
                Cancel
              </Button>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-red-300">
                {error}
              </p>
            )}
          </>
        )}
      </Modal>
    </section>
  );
}
