import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { profileAdvances } from "./advanceProfile";

const enabled = process.env.PROFILE_ADVANCE === "1";

describe.skipIf(!enabled)("advance profile", () => {
  it(
    "records fast-forward and season baselines",
    async () => {
      const report = await profileAdvances((line) => console.log(line));
      const out =
        process.env.PROFILE_OUT ??
        "/workspace/artifacts/advance-profile.json";
      writeFileSync(out, JSON.stringify(report, null, 2));
      expect(report.scenarios.map((s) => s.id)).toEqual([
        "fast-forward-1",
        "fast-forward-30",
        "season",
      ]);
      expect(report.career.npcs).toBeGreaterThan(1000);
      for (const scenario of report.scenarios)
        expect(scenario.writes.saveTransactions).toBeGreaterThan(0);
    },
    30 * 60 * 1000,
  );
});
