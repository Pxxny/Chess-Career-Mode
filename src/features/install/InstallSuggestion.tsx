import { useEffect, useState } from "react";
import { Button, Modal } from "@/components/ui";
import {
  dismissSuggestion,
  isApple,
  shouldSuggest,
  useInstall,
} from "./InstallProvider";

export function InstallInstructions() {
  return (
    <div className="rounded-lg border border-white/10 bg-navy-900 p-3 text-sm text-ink">
      {isApple() ? (
        <>
          <p className="font-semibold">On iPhone or iPad</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>Open this game in Safari.</li>
            <li>
              Tap Share, then Add to Home Screen. If needed, open the More menu
              first.
            </li>
            <li>Confirm Add, then open the game icon from your home screen.</li>
          </ol>
        </>
      ) : (
        <>
          <p className="font-semibold">Install from your browser</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>
              Open this game in Chrome, Edge or another browser that supports
              installed web apps.
            </li>
            <li>
              Open the browser menu and choose Install app or Add to Home
              screen.
            </li>
            <li>
              If no install option is shown, keep playing in this browser.
            </li>
          </ol>
        </>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        This installs the web app. It does not download an APK or require an app
        store.
      </p>
    </div>
  );
}

/** Mounted only on the slots/Home screens; never interrupts creation or a live game. */
export function InstallSuggestion() {
  const { installed, available, busy, install } = useInstall();
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState(false);
  useEffect(() => {
    if (installed || !shouldSuggest()) return;
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      if (
        document.visibilityState !== "visible" ||
        document.querySelector('[role="dialog"]')
      ) {
        timer = setTimeout(show, 1000);
        return;
      }
      if (shouldSuggest()) setOpen(true);
    };
    timer = setTimeout(show, 4500);
    return () => clearTimeout(timer);
  }, [installed]);
  const close = (permanent = false) => {
    dismissSuggestion(permanent);
    setOpen(false);
  };
  if (installed) return null;
  return (
    <Modal
      open={open}
      title="Install Chess Career Mode"
      onClose={() => {
        if (!busy) close();
      }}
    >
      <img
        src="/icon-192.png"
        alt="Chess Career Mode"
        className="mb-3 h-16 w-16 rounded-2xl"
      />
      <p className="text-sm text-ink">
        Add the game to your home screen for quick access and a separate app
        window.
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        Loaded game files can be used offline. Your saves stay on this device.
      </p>
      {(guide || isApple()) && (
        <div className="mt-4">
          <InstallInstructions />
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {available || busy ? (
          <Button
            disabled={busy}
            onClick={async () => {
              const result = await install();
              if (result === "manual") setGuide(true);
              else setOpen(false);
            }}
          >
            {busy ? "Opening installer…" : "Install app"}
          </Button>
        ) : (
          !guide &&
          !isApple() && (
            <Button onClick={() => setGuide(true)}>How to install</Button>
          )
        )}
        <Button variant="secondary" disabled={busy} onClick={() => close()}>
          Not now
        </Button>
        <button
          className="min-h-11 px-2 text-xs text-ink-muted underline underline-offset-4"
          disabled={busy}
          onClick={() => close(true)}
        >
          Do not show again
        </button>
      </div>
    </Modal>
  );
}
