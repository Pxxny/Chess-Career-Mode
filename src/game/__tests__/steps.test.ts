import { describe, expect, it } from "vitest";
import { drainSteps, runStepsSliced, type Steps } from "@/game/steps";

function* counting(log: string[], n: number): Steps<number> {
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += i;
    log.push(`step ${i}`);
    yield;
  }
  return total;
}

describe("resumable steps", () => {
  it("drain and sliced runs execute the same steps and return the same value", async () => {
    const a: string[] = [], b: string[] = [];
    const drained = drainSteps(counting(a, 50));
    let yields = 0;
    const sliced = await runStepsSliced(counting(b, 50), {
      budgetMs: 0,
      yieldTo: async () => {
        yields++;
        await new Promise((r) => setTimeout(r, 0));
      },
    });
    expect(sliced).toBe(drained);
    expect(b).toEqual(a);
    expect(yields).toBe(50);
  });
  it("yields only when the time budget is used up", async () => {
    let clock = 0, yields = 0;
    function* work(): Steps<string> {
      for (let i = 0; i < 10; i++) {
        clock += 3; // each step "takes" 3 ms
        yield;
      }
      return "done";
    }
    const out = await runStepsSliced(work(), {
      budgetMs: 8,
      now: () => clock,
      yieldTo: async () => {
        yields++;
      },
    });
    expect(out).toBe("done");
    expect(yields).toBe(3); // after 9, 18 and 27 ms of steps
  });
  it("wraps every synchronous stretch and propagates errors", async () => {
    let inside = 0, depth = 0;
    function* failing(): Steps<void> {
      expect(depth).toBe(1);
      yield;
      expect(depth).toBe(1);
      throw new Error("boom");
    }
    await expect(
      runStepsSliced(failing(), {
        budgetMs: 0,
        yieldTo: async () => expect(depth).toBe(0),
        around: (run) => {
          inside++;
          depth++;
          try {
            return run();
          } finally {
            depth--;
          }
        },
      }),
    ).rejects.toThrow("boom");
    expect(inside).toBe(2);
  });
});
