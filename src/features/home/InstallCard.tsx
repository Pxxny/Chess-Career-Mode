import { useState } from "react";
import { Button, Card, CardTitle } from "@/components/ui";
import { useInstall } from "@/features/install/InstallProvider";
import { InstallInstructions } from "@/features/install/InstallSuggestion";

/** Always available after dismissing the suggestion; shares the early install event. */
export function InstallCard() {
  const { installed, available, busy, install } = useInstall();
  const [guide, setGuide] = useState(false);
  if (installed) return null;
  return (
    <Card className="mt-4">
      <CardTitle>Install on this device</CardTitle>
      <p className="mb-3 text-sm text-ink-muted">
        Add the game to your home screen for quick access and a separate app
        window.
      </p>
      <p className="mb-3 text-sm text-ink-muted">
        Loaded game files can be used offline. Your saves stay on this device.
      </p>
      {available || busy ? (
        <Button
          disabled={busy}
          onClick={async () => {
            if ((await install()) === "manual") setGuide(true);
          }}
        >
          {busy ? "Opening installer…" : "Install app"}
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setGuide(!guide)}>
          How to install
        </Button>
      )}
      {guide && (
        <div className="mt-3">
          <InstallInstructions />
        </div>
      )}
    </Card>
  );
}
