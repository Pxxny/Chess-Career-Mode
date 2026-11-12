import { useEffect, useState } from "react";

export type ScreenWakeStatus = "active" | "idle" | "unavailable";

/** Keep an open career awake; release on background/exit and recover on return. */
export function useScreenWakeLock() {
  const [status, setStatus] = useState<ScreenWakeStatus>("idle");
  useEffect(() => {
    if (!navigator.wakeLock?.request || !window.isSecureContext) {
      setStatus("unavailable");
      return;
    }
    let sentinel: WakeLockSentinel | null = null;
    let pending = false;
    let disposed = false;
    const release = () => {
      const current = sentinel;
      sentinel = null;
      if (current && !current.released) void current.release().catch(() => {});
    };
    const acquire = async () => {
      if (disposed || pending || document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      pending = true;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (disposed || document.visibilityState !== "visible") {
          await lock.release();
          return;
        }
        sentinel = lock;
        setStatus("active");
        lock.addEventListener("release", () => {
          if (sentinel !== lock) return;
          sentinel = null;
          if (!disposed) setStatus("idle");
        });
      } catch {
        if (!disposed) setStatus("idle");
      } finally {
        pending = false;
      }
    };
    const visibility = () => {
      if (document.visibilityState === "visible") void acquire();
      else { release(); setStatus("idle"); }
    };
    void acquire();
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pointerdown", acquire);
    document.addEventListener("keydown", acquire);
    return () => {
      disposed = true;
      release();
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerdown", acquire);
      document.removeEventListener("keydown", acquire);
    };
  }, []);
  return status;
}
