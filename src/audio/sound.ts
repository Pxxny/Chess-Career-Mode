import { useSyncExternalStore } from "react";

/** Synthesised board sounds (Web Audio): no audio files to download or cache. */
export type SoundKind = "move" | "capture" | "lowtime";
const KEY = "chess-career-sound";
const listeners = new Set<() => void>();
let enabled = true;
try {
  enabled = localStorage.getItem(KEY) !== "off";
} catch {
  /* storage can be blocked; the choice then lasts for this session only */
}
let ctx: AudioContext | null = null;

export const soundEnabled = (): boolean => enabled;
export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
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
  if (ctx) return ctx;
  const Ctor =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext);
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/** Browsers only start audio after a touch or click; unlock it on the first one. */
if (typeof window !== "undefined") {
  const unlock = () => {
    void context()?.resume();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

function thump(c: AudioContext, at: number, freq: number, volume: number) {
  const osc = c.createOscillator(),
    gain = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, at + 0.07);
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + 0.1);
  // A short noise burst gives the wooden "click".
  const length = Math.floor(c.sampleRate * 0.025),
    buffer = c.createBuffer(1, length, c.sampleRate),
    data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const noise = c.createBufferSource(),
    noiseGain = c.createGain();
  noise.buffer = buffer;
  noiseGain.gain.value = volume * 0.5;
  noise.connect(noiseGain).connect(c.destination);
  noise.start(at);
}

export function playSound(kind: SoundKind): void {
  if (!enabled) return;
  const c = context();
  if (!c || c.state === "suspended") {
    void c?.resume();
    if (!c || c.state !== "running") return;
  }
  const now = c.currentTime;
  if (kind === "move") thump(c, now, 220, 0.35);
  else if (kind === "capture") {
    thump(c, now, 170, 0.5);
    thump(c, now + 0.055, 120, 0.4);
  } else {
    const osc = c.createOscillator(),
      gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }
}
