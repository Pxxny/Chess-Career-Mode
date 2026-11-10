import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const stored = new Map<string, string>();
let blockedStorage = false;
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (blockedStorage) throw new Error("blocked");
      stored.set(key, value);
    },
  },
});
class Node {
  stopped = false;
  onended: (() => void) | null = null;
  buffer: { duration: number } | null = null;
  connect(other: unknown) {
    return other;
  }
  disconnect() {}
  start() {
    FakeContext.played.push(this);
  }
  stop() {
    this.stopped = true;
    this.onended?.();
  }
}
class FakeContext {
  static instances: FakeContext[] = [];
  static played: Node[] = [];
  state = "suspended";
  currentTime = 0;
  destination = {};
  oscillators = 0;
  failDecode = false;
  failResume = false;
  constructor() {
    FakeContext.instances.push(this);
  }
  async resume() {
    if (this.failResume) throw new Error("autoplay denied");
    this.state = "running";
  }
  async decodeAudioData(data: ArrayBuffer) {
    if (this.failDecode) throw new Error("decode failed");
    const view = new DataView(data);
    assert.equal(view.getUint32(0, false), 0x52494646); // Actual bundled RIFF samples.
    return {
      duration: view.getUint32(40, true) / (view.getUint32(24, true) * 2),
    };
  }
  createBufferSource() {
    return new Node();
  }
  createGain() {
    return {
      gain: {
        value: 1,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect: () => this.destination,
      disconnect() {},
    };
  }
  createOscillator() {
    this.oscillators++;
    return Object.assign(new Node(), { frequency: { value: 0 }, type: "" });
  }
}
const events = new Map<string, () => void>();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    AudioContext: FakeContext,
    addEventListener: (name: string, fn: () => void) => events.set(name, fn),
    removeEventListener: (name: string) => events.delete(name),
  },
});
const requests = new Map<string, number>();
let failingUrl = "",
  hold = false;
let release: (() => void) | undefined;
globalThis.fetch = (async (url: string) => {
  requests.set(url, (requests.get(url) ?? 0) + 1);
  if (hold) await new Promise<void>((resolve) => (release = resolve));
  if (url === failingUrl) return new Response("", { status: 503 });
  return new Response(
    readFileSync(new URL("../public" + url, import.meta.url)),
  );
}) as typeof fetch;
const {
  BOARD_SOUND_FILES,
  soundEnabled,
  setSoundEnabled,
  prepareSounds,
  playSound,
} = await import("../src/audio/sound.ts");
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
assert.equal(soundEnabled(), true);
assert.ok(events.has("pointerdown") && events.has("keydown"));
await prepareSounds();
const ctx = FakeContext.instances[0];
assert.equal(ctx.state, "running");
assert.equal(requests.size, 4);
await prepareSounds();
assert.ok(
  [...requests.values()].every((n) => n === 1),
  "Preload/decode cache is shared",
);
for (let i = 0; i < 4; i++) {
  playSound("move");
  await tick();
}
assert.equal(FakeContext.played.length, 4);
assert.notEqual(FakeContext.played[0].buffer, FakeContext.played[1].buffer);
assert.notEqual(FakeContext.played[1].buffer, FakeContext.played[2].buffer);
assert.equal(FakeContext.played[0].buffer, FakeContext.played[3].buffer);
assert.equal(
  ctx.oscillators,
  0,
  "Moves must use recordings, never oscillators",
);
playSound("capture");
await tick();
assert.ok(Math.abs(FakeContext.played.at(-1)!.buffer!.duration - 0.39) < 0.001);
assert.equal(ctx.oscillators, 0, "Captures must use recordings");
assert.equal(
  FakeContext.played[0].stopped,
  true,
  "Overlapping sources are bounded",
);
setSoundEnabled(false);
assert.equal(stored.get("chess-career-sound"), "off");
assert.ok(
  FakeContext.played.every((n) => n.stopped),
  "Mute stops currently playing samples",
);
const count = FakeContext.played.length;
playSound("move");
playSound("capture");
playSound("lowtime");
await tick();
assert.equal(FakeContext.played.length, count);
setSoundEnabled(true);
await tick();
ctx.state = "suspended";
playSound("move");
await tick();
assert.equal(
  FakeContext.played.length,
  count + 1,
  "First move waits for asynchronous audio resume",
);
playSound("lowtime");
await tick();
assert.equal(ctx.oscillators, 1, "Only the existing clock alarm uses a tone");
ctx.failResume = true;
ctx.state = "suspended";
const beforeDenied = FakeContext.played.length;
playSound("move");
await tick();
assert.equal(
  FakeContext.played.length,
  beforeDenied,
  "Autoplay denial is harmless",
);
ctx.failResume = false;
ctx.state = "closed";
failingUrl = BOARD_SOUND_FILES[3];
await prepareSounds();
const next = FakeContext.instances.at(-1)!;
assert.notEqual(next, ctx);
failingUrl = "";
playSound("capture");
await tick();
assert.ok(
  FakeContext.played.length > beforeDenied,
  "Failed sample can be retried",
);
next.state = "closed";
hold = true;
playSound("move");
await tick();
const beforeMutedLoad = FakeContext.played.length;
setSoundEnabled(false);
release!();
hold = false;
await tick();
assert.equal(
  FakeContext.played.length,
  beforeMutedLoad,
  "Delayed download cannot play after mute",
);
blockedStorage = true;
assert.doesNotThrow(() => setSoundEnabled(true));
await tick();
const last = FakeContext.instances.at(-1)!;
last.state = "closed";
(window as any).AudioContext = undefined;
assert.doesNotThrow(() => playSound("move"));
assert.doesNotThrow(() => playSound("lowtime"));

const manifest = JSON.parse(
  readFileSync(
    new URL("../public/audio/chess/sources.json", import.meta.url),
    "utf8",
  ),
);
assert.equal(manifest.license, "CC0-1.0");
const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
for (const url of BOARD_SOUND_FILES) {
  const data = readFileSync(new URL("../public" + url, import.meta.url));
  const meta = manifest.files.find((f: { file: string }) =>
    url.endsWith("/" + f.file),
  );
  assert.equal(createHash("sha256").update(data).digest("hex"), meta.sha256);
  assert.equal(data.toString("ascii", 8, 12), "WAVE");
  assert.ok(
    sw.includes('"' + url + '"'),
    "Each audio file is available in the offline shell",
  );
  assert.ok(data.byteLength < 40_000, "Samples stay small");
}
console.log(
  "Audio checks passed: real recorded WAVs, preload/cache, 3 move variants, distinct capture, resume, mute/cancel, bounded overlap, network retry, autoplay denial, absent audio API, blocked storage, attribution and offline assets.",
);
