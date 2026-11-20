/**
 * Resumable game computations. A step function is a generator that pauses (`yield`) at points where
 * a caller may hand the main thread back to the browser; it never reads clocks or schedules work
 * itself, so its result is the same whether it is drained in one go or resumed across tasks.
 */
export type Steps<T> = Generator<void, T, void>;

/** Runs every step synchronously and returns the result (the original, blocking behaviour). */
export function drainSteps<T>(steps: Steps<T>): T {
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
  }
}

/** Hands the main thread back so the browser can paint and handle input, then continues. */
export function yieldToBrowser(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof MessageChannel === "undefined") {
      setTimeout(resolve, 0);
      return;
    }
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

export interface SliceOptions {
  /** Longest stretch of steps between two yields to the browser, in ms (default 8). */
  budgetMs?: number;
  /** Runs around every synchronous stretch (used to mark the calendar as owned by the runner). */
  around?: <R>(run: () => R) => R;
  yieldTo?: () => Promise<void>;
  now?: () => number;
  /** Diagnostics: called once per yield with the length of the stretch that preceded it. */
  onSlice?: (ms: number) => void;
}

/** Drives steps across tasks: runs until the time budget is used, yields, and repeats. */
export async function runStepsSliced<T>(
  steps: Steps<T>,
  options: SliceOptions = {},
): Promise<T> {
  const budget = options.budgetMs ?? 8,
    now = options.now ?? (() => performance.now()),
    yieldTo = options.yieldTo ?? yieldToBrowser,
    around = options.around ?? (<R,>(run: () => R) => run());
  let started = now();
  for (;;) {
    const r = around(() => steps.next());
    if (r.done) return r.value;
    const elapsed = now() - started;
    if (elapsed >= budget) {
      options.onSlice?.(elapsed);
      await yieldTo();
      started = now();
    }
  }
}
