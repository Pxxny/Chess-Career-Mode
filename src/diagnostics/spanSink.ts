/** Optional timings. Production leaves the sink unset, so the only cost is a null check. */
export type SpanSink = (id: string, ms: number) => void;
let sink: SpanSink | null = null;
export function setSpanSink(next: SpanSink | null): void {
  sink = next;
}
export function span<T>(id: string, fn: () => T): T {
  if (!sink) return fn();
  const at = performance.now();
  try {
    return fn();
  } finally {
    sink(id, Math.max(0, performance.now() - at));
  }
}
