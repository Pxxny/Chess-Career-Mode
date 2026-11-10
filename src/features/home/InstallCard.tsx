import { useEffect, useState } from "react";
import { Button, Card, CardTitle } from "@/components/ui";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const standalone = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;
const apple = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Installs the game on the device (home screen / desktop) so it also runs offline. */
export function InstallCard() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(standalone());
    const before = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  if (installed) return null;
  return (
    <Card className="mt-4">
      <CardTitle>Install on this device</CardTitle>
      <p className="mb-3 text-sm text-ink-muted">
        Install Chess Career Mode like an app. It opens full screen and keeps
        working without internet after the first load. Your saves stay on this
        device.
      </p>
      {prompt ? (
        <Button
          onClick={async () => {
            await prompt.prompt();
            const choice = await prompt.userChoice;
            if (choice.outcome === "accepted") setInstalled(true);
            setPrompt(null);
          }}
        >
          Install app
        </Button>
      ) : apple() ? (
        <p className="text-sm text-ink">
          In Safari, tap the Share button, then “Add to Home Screen”.
        </p>
      ) : (
        <p className="text-sm text-ink">
          Open your browser menu and choose “Install app” or “Add to Home
          screen”.
        </p>
      )}
    </Card>
  );
}
