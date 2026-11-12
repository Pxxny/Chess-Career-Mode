export const PERF_SESSION_KEY = "chess-career-performance";
export const METRIC_LABELS = {
  "city.load": "City list ready",
  "city.download": "City file download",
  "city.parse": "City JSON and validation",
  "city.filter": "City search and options",
  "engine.load": "Engine startup",
  "engine.search": "Engine search",
  "match.auto-move": "Automatic move",
  "calendar.day": "End day",
  "calendar.events": "Calendar NPC events",
  "calendar.circuit": "Weekly World Circuit",
  "calendar.advance": "Simulate until tournament",
  "storage.read": "Database read",
  "storage.write": "Database write",
  "career.create": "Create career and NPC world",
  "ui.long-task": "Main thread long task",
} as const;
export type MetricId = keyof typeof METRIC_LABELS;
export interface MetricTags {
  country?: string;
  source?: string;
  engine?: string;
  budgetMs?: number;
  depth?: number;
  book?: boolean;
  speed?: string;
  items?: number;
  matches?: number;
  days?: number;
  newWeek?: boolean;
  status?: string;
  stores?: string;
  npcs?: number;
}
export interface TimingEntry {
  id: MetricId;
  ms: number;
  atMs: number;
  tags: MetricTags;
}
interface Bucket {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  last: TimingEntry;
  samples: number[];
}
export const monotonicNow = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();
const allowedTags = new Set([
  "country",
  "source",
  "engine",
  "budgetMs",
  "depth",
  "book",
  "speed",
  "items",
  "matches",
  "days",
  "newWeek",
  "status",
  "stores",
  "npcs",
]);
function safeTags(tags: MetricTags): MetricTags {
  const safe: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(tags)) {
    if (!allowedTags.has(k)) continue;
    if (typeof v === "string") safe[k] = v.slice(0, 80);
    else if (
      typeof v === "boolean" ||
      (typeof v === "number" && Number.isFinite(v))
    )
      safe[k] = v;
  }
  return safe;
}
/** Read-only timings, bounded in memory. There is no save, network, or database dependency. */
export function createPerformanceRecorder(clock = monotonicNow) {
  let enabled = false,
    generation = 0,
    started = clock();
  const buckets = new Map<MetricId, Bucket>(),
    recent: TimingEntry[] = [];
  const record = (id: MetricId, ms: number, tags: MetricTags = {}) => {
    if (
      !enabled ||
      !Object.hasOwn(METRIC_LABELS, id) ||
      !Number.isFinite(ms) ||
      ms < 0
    )
      return;
    const entry: TimingEntry = {
      id,
      ms,
      atMs: Math.max(0, clock() - started),
      tags: safeTags(tags),
    };
    let b = buckets.get(id);
    if (!b) {
      b = {
        count: 0,
        totalMs: 0,
        minMs: ms,
        maxMs: ms,
        last: entry,
        samples: [],
      };
      buckets.set(id, b);
    }
    b.count++;
    b.totalMs += ms;
    b.minMs = Math.min(b.minMs, ms);
    b.maxMs = Math.max(b.maxMs, ms);
    b.last = entry;
    b.samples.push(ms);
    if (b.samples.length > 100) b.samples.shift();
    recent.push(entry);
    if (recent.length > 200) recent.shift();
  };
  return {
    isEnabled: () => enabled,
    setEnabled: (value: boolean) => {
      if (value !== enabled) generation++;
      enabled = value;
    },
    clear: () => {
      generation++;
      buckets.clear();
      recent.length = 0;
      started = clock();
    },
    record,
    begin: (id: MetricId) => {
      if (!enabled) return (_tags?: MetricTags) => undefined;
      const at = clock(),
        token = generation;
      let finished = false;
      return (tags: MetricTags = {}) => {
        if (finished) return;
        finished = true;
        if (enabled && token === generation)
          record(id, Math.max(0, clock() - at), tags);
      };
    },
    snapshot: () => ({
      recording: enabled,
      sessionMs: Math.max(0, clock() - started),
      metrics: [...buckets].map(([id, b]) => {
        const sorted = [...b.samples].sort((a, b) => a - b);
        return {
          id,
          count: b.count,
          meanMs: b.totalMs / b.count,
          minMs: b.minMs,
          maxMs: b.maxMs,
          last: structuredClone(b.last),
          p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)],
          sampleCount: sorted.length,
        };
      }),
      recent: structuredClone(recent),
    }),
  };
}
function initiallyEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return (
      new URLSearchParams(window.location.search).get("perf") === "1" ||
      window.sessionStorage.getItem(PERF_SESSION_KEY) === "1"
    );
  } catch {
    return false;
  }
}
export const performanceRecorder = createPerformanceRecorder();
performanceRecorder.setEnabled(initiallyEnabled());
export const beginMeasurement = performanceRecorder.begin;
