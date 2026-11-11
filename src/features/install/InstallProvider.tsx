import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
const SNOOZE = "chess-career-install-after";
const HIDDEN = "chess-career-install-hidden";
let sessionDismissed = false;
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const isApple = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const Context = createContext<{
  installed: boolean;
  available: boolean;
  busy: boolean;
  install: () => Promise<"accepted" | "dismissed" | "manual">;
}>({
  installed: false,
  available: false,
  busy: false,
  install: async () => "manual",
});

/** Listen before a career is opened, so early browser install events are retained. */
export function InstallProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(isStandalone);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const before = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
      dismissSuggestion(false);
    };
    const display = () => setInstalled(isStandalone());
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", done);
    media.addEventListener?.("change", display);
    return () => {
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", done);
      media.removeEventListener?.("change", display);
    };
  }, []);
  const install = async (): Promise<"accepted" | "dismissed" | "manual"> => {
    if (!prompt || busy) return "manual";
    setBusy(true);
    setPrompt(null);
    try {
      await prompt.prompt(); // Called directly by the user's button, preserving activation.
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      dismissSuggestion(false);
      return outcome;
    } catch {
      return "manual";
    } finally {
      setBusy(false);
    }
  };
  return (
    <Context.Provider value={{ installed, available: !!prompt, busy, install }}>
      {children}
    </Context.Provider>
  );
}
export const useInstall = () => useContext(Context);
export function shouldSuggest(): boolean {
  if (sessionDismissed || isStandalone()) return false;
  try {
    return (
      localStorage.getItem(HIDDEN) !== "yes" &&
      Date.now() >= Number(localStorage.getItem(SNOOZE) || 0)
    );
  } catch {
    return true;
  }
}
export function dismissSuggestion(permanent: boolean): void {
  sessionDismissed = true;
  try {
    localStorage.setItem(
      permanent ? HIDDEN : SNOOZE,
      permanent ? "yes" : String(Date.now() + 7 * 86400000),
    );
  } catch {
    /* Still suppressed for this session. */
  }
}
