import { useSyncExternalStore } from "react";

/** Real board recordings are bundled locally. The low-clock alert stays a short tone. */
export type SoundKind = "move" | "capture" | "lowtime";
export const BOARD_SOUND_FILES = [
  "/audio/chess/move-1.wav",
  "/audio/chess/move-2.wav",
  "/audio/chess/move-3.wav",
  "/audio/chess/capture.wav",
] as const;
const KEY = "chess-career-sound";
const listeners = new Set<() => void>();
let enabled = true;
try {
  enabled = localStorage.getItem(KEY) !== "off";
} catch {
  /* storage can be blocked; the choice then lasts for this session only */
}
let ctx: AudioContext | null = null;
let generation = 0;
let moveIndex = 0;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const active = new Set<AudioScheduledSourceNode>();

export const soundEnabled = (): boolean => enabled;
export function setSoundEnabled(on: boolean): void {
  enabled = on;
  // Cancel sounds still loading, including when the user immediately turns sound back on.
  generation++;
  if (!on) {
    for (const source of active) {
      try {
        source.stop();
      } catch {
        /* already ended */
      }
    }
    active.clear();
  }
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
  if (on) void prepareSounds();
}
export const useSoundEnabled = (): boolean =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    soundEnabled,
    () => true,
  );

function context(): AudioContext | null {
  if (ctx && ctx.state !== "closed") return ctx;
  const Ctor =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext);
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    buffers.clear();
  } catch {
    return null;
  }
  return ctx;
}
async function resume(c: AudioContext): Promise<boolean> {
  try {
    // Includes suspended/interrupted audio after a mobile app returns from the background.
    if (c.state !== "running") await c.resume();
    return c.state === "running";
  } catch {
    return false;
  }
}
function sample(c: AudioContext, url: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(url);
  if (cached) return cached;
  const loading = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Audio unavailable");
      return await c.decodeAudioData(await response.arrayBuffer());
    } catch {
      // A network/decoder failure must not interrupt the game. Allow a later retry.
      buffers.delete(url);
      return null;
    }
  })();
  buffers.set(url, loading);
  return loading;
}

/** Warm the small recording cache during a user gesture, before the first game move. */
export async function prepareSounds(): Promise<void> {
  if (!enabled) return;
  const c = context();
  if (!c) return;
  await Promise.all([
    resume(c),
    ...BOARD_SOUND_FILES.map((url) => sample(c, url)),
  ]);
}

if (typeof window !== "undefined") {
  const unlock = () => {
    if (!enabled) return;
    void prepareSounds().then(() => {
      if (ctx?.state === "running") {
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      }
    });
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

function connect(
  c: AudioContext,
  source: AudioScheduledSourceNode,
  gain: GainNode,
): void {
  // Bound overlapping playback when rapidly stepping through a replay.
  if (active.size >= 4) {
    const oldest = active.values().next().value;
    try {
      oldest?.stop();
    } catch {
      /* already ended */
    }
    if (oldest) active.delete(oldest);
  }
  source.connect(gain).connect(c.destination);
  active.add(source);
  source.onended = () => {
    active.delete(source);
    source.disconnect();
    gain.disconnect();
  };
}
function lowTime(c: AudioContext): void {
  const osc = c.createOscillator(),
    gain = c.createGain(),
    now = c.currentTime;
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  connect(c, osc, gain);
  osc.start(now);
  osc.stop(now + 0.13);
}

export function playSound(kind: SoundKind): void {
  if (!enabled) return;
  const c = context();
  if (!c) return;
  const requestGeneration = generation,
    requestedAt = Date.now();
  const current = () =>
    enabled &&
    generation === requestGeneration &&
    ctx === c &&
    c.state === "running" &&
    Date.now() - requestedAt < 1000;
  if (kind === "lowtime") {
    void resume(c)
      .then((ready) => {
        if (ready && current()) lowTime(c);
      })
      .catch(() => {});
    return;
  }
  const url =
    kind === "capture"
      ? BOARD_SOUND_FILES[3]
      : BOARD_SOUND_FILES[moveIndex++ % 3];
  void Promise.all([resume(c), sample(c, url)])
    .then(([ready, buffer]) => {
      if (!ready || !buffer || !current()) return;
      const source = c.createBufferSource(),
        gain = c.createGain();
      source.buffer = buffer;
      // Original recording, at its original speed and pitch; no synthetic layer.
      gain.gain.value = 1;
      connect(c, source, gain);
      source.start(c.currentTime);
    })
    .catch(() => {
      /* Audio is optional; keep legal moves and clocks working. */
    });
}
