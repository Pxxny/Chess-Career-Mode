import { describe, it } from "vitest";
import { profileAdvances } from "./advanceProfile";

describe.skipIf(process.env.PROFILE_SPLIT !== "1")("calendar split", () => {
  it(
    "prints calendar subsystems for 30 days",
    async () => {
      const report = await profileAdvances((line) => console.log(line), {
        season: false,
        monthDays: 30,
      });
      for (const scenario of report.scenarios) {
        console.log(`\n# ${scenario.label} ${scenario.wallMs} ms`);
        for (const system of scenario.systems.filter((row) =>
          row.id.startsWith("calendar."),
        ))
          console.log(
            `${system.id}\t${system.count}\t${system.totalMs}\t${system.maxMs}`,
          );
      }
    },
    10 * 60 * 1000,
  );
});
