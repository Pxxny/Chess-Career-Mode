import { useState } from "react";
import { Button } from "@/components/ui";
import { useGameStore } from "@/store/gameStore";
export function ResetSaveButton() {
  const clearSave = useGameStore((s) => s.clearSave);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <Button
        variant="danger"
        disabled={busy}
        onClick={async () => {
          if (
            !window.confirm(
              "Delete only the current character and its NPC world? This cannot be undone.",
            )
          )
            return;
          setBusy(true);
          try {
            await clearSave();
          } catch {
            setError("Deletion failed. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Delete current character
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export default ResetSaveButton;
