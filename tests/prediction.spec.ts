import { test, expect, type Page, type Locator } from "@playwright/test";
import { createCareer } from "./helpers";
import type { GameSave } from "../src/types";

async function stored(
  page: Page,
  advanceRegistration = false,
): Promise<GameSave> {
  return page.evaluate(async (advance) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      const tx = db.transaction("keyval", advance ? "readwrite" : "readonly"),
        table = tx.objectStore("keyval");
      const raw = await new Promise<string>((resolve, reject) => {
        const r = table.get("chess-career-mode-save-slot-1");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const value = JSON.parse(raw) as { state: { save: GameSave } };
      if (advance) {
        const s = value.state.save,
          r = s.registrations[0];
        s.world.date = { year: r.year, week: r.week };
        s.world.day = r.details?.agenda?.exactStart
          ? r.details.agenda.startDay
          : 1;
        table.put(JSON.stringify(value), "chess-career-mode-save-slot-1");
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return value.state.save;
    } finally {
      db.close();
    }
  }, advanceRegistration);
}
async function odds(panel: Locator) {
  const values = await Promise.all(
    ["win", "draw", "loss"].map(async (o) =>
      Number(
        (await panel.getByTestId(`probability-${o}`).textContent())?.replace(
          "%",
          "",
        ),
      ),
    ),
  );
  expect(
    values.map((x) => Math.round(x * 100)).reduce((s, n) => s + n, 0),
  ).toBe(10000);
  for (const v of values) {
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  }
  return values;
}
async function noHorizontalOverflow(page: Page) {
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
}
test("a real friendly game persists its forecast before move one and scores only once in Career and History", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createCareer(page);
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  await page.getByText("Individual match / free play", { exact: true }).click();
  await page.getByRole("button", { name: "White", exact: true }).click();
  await page.getByRole("button", { name: "Friendly", exact: true }).click();
  await odds(page.getByTestId("match-prediction"));
  await page.getByTestId("start-game").click();
  const viewer = page.getByTestId("match-viewer");
  await expect(viewer).toBeVisible();
  await odds(viewer.getByTestId("match-prediction"));
  await expect
    .poll(async () => (await stored(page)).pendingMatch?.setup.prediction?.id)
    .toBeTruthy();
  const pending = (await stored(page)).pendingMatch!;
  expect(pending.ucis).toHaveLength(0);
  expect(pending.setup.prediction?.support.games).toBe(0);
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await expect(
    page.getByTestId("move-list").locator('button[data-ply="2"]'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await expect(page.getByTestId("result-banner")).toBeVisible();
  await expect(viewer.getByTestId("prediction-actual")).toContainText("LOSS");
  const finished = await stored(page),
    frozen = pending.setup.prediction!;
  expect(finished.matches[0].setup.prediction).toEqual(frozen);
  expect(finished.prediction?.metrics.career.adjusted.games).toBe(1);
  const brier =
    frozen.adjusted.win ** 2 +
    frozen.adjusted.draw ** 2 +
    (frozen.adjusted.loss - 1) ** 2;
  expect(finished.prediction?.metrics.career.adjusted.brier).toBeCloseTo(
    brier,
    10,
  );
  expect(finished.prediction?.metrics.career.adjusted.logLoss).toBeCloseTo(
    -Math.log(frozen.adjusted.loss),
    10,
  );
  await page.getByRole("link", { name: "Career", exact: true }).click();
  await page
    .getByRole("tab", { name: "Match predictions", exact: true })
    .click();
  await expect(page.getByTestId("prediction-statistics")).toContainText(
    "1 completed predictions",
  );
  await expect(page.getByTestId("prediction-metrics")).toContainText(
    "Context + history",
  );
  await page.getByLabel("Reliability outcome").selectOption("loss");
  await noHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/prediction-career-dashboard.png",
    fullPage: false,
  });
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(page.getByTestId("prediction-summary")).toContainText(
    "Actual: loss",
  );
  await page.reload();
  expect((await stored(page)).prediction?.metrics.career.adjusted.games).toBe(
    1,
  );
  expect((await stored(page)).matches[0].setup.prediction).toEqual(frozen);
  expect(errors).toEqual([]);
});
test("Swiss, Home and Prepare show forecasts; completed NPC boards populate calibration without rewriting their original forecasts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createCareer(page);
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  await page.getByRole("tab", { name: "Swiss", exact: true }).click();
  await page.locator('button[data-testid="register"]:enabled').first().click();
  await expect(
    page.getByTestId("registrations").locator(":scope > li"),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: "Prepare", exact: true }).click();
  await odds(page.getByTestId("match-prediction"));
  await page.getByLabel("Prediction preview colour").selectOption("white");
  const before = await odds(page.getByTestId("match-prediction"));
  await page.getByLabel("Prediction preview colour").selectOption("black");
  expect((await odds(page.getByTestId("match-prediction")))[0]).toBeLessThan(
    before[0],
  );
  await page.getByRole("tab", { name: "Scout Opponent", exact: true }).click();
  await expect(page.getByTestId("match-prediction")).toBeVisible();
  await page.getByRole("button", { name: /Investigate opponent/ }).click();
  await expect(
    page.getByText("Report available", { exact: true }),
  ).toBeVisible();
  await stored(page, true);
  await page.reload();
  await page.getByTestId("start-event").click();
  await expect(page.getByTestId("standings")).toBeVisible();
  const initial = await stored(page),
    pairings = initial.tournament!.pairings[0];
  expect(
    pairings
      .filter((p) => p.black !== "bye")
      .every((p) => p.prediction && p.result === null),
  ).toBe(true);
  await expect(page.getByTestId("prediction-summary").first()).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("match-prediction")).toBeVisible();
  await odds(page.getByTestId("match-prediction"));
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Simulate (take control any time)",
      exact: true,
    })
    .click();
  await expect(
    page.getByTestId("move-list").locator('button[data-ply="2"]'),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Take control of my side", exact: true })
    .click();
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await expect(page.getByTestId("result-banner")).toBeVisible();
  const after = await stored(page);
  expect(after.prediction?.metrics.npc.adjusted.games).toBeGreaterThan(0);
  expect(after.prediction?.learned).toBeGreaterThan(0);
  expect(after.tournament!.pairings[0].map((p) => p.prediction)).toEqual(
    pairings.map((p) => p.prediction),
  );
  expect(
    after
      .tournament!.pairings[1].filter((p) => p.black !== "bye")
      .every((p) => p.prediction && p.result === null),
  ).toBe(true);
  await page.getByRole("link", { name: "Career", exact: true }).click();
  await page
    .getByRole("tab", { name: "Match predictions", exact: true })
    .click();
  await page.getByLabel("Prediction game sample").selectOption("npc");
  await expect(page.getByTestId("prediction-statistics")).toContainText(
    "abstract",
  );
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
});
test("practice reload preserves the pre-game snapshot, records one loss and excludes interruption from draw learning", async ({
  page,
}) => {
  await createCareer(page);
  await page.getByRole("tab", { name: "Games", exact: true }).click();
  await page.getByRole("button", { name: /^Training Game/ }).click();
  await page.getByRole("radio", { name: "White", exact: true }).click();
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect(page.getByTestId("match-prediction")).toBeVisible();
  await expect
    .poll(async () => (await stored(page)).practice.pendingGame?.prediction?.id)
    .toBeTruthy();
  const initial = (await stored(page)).practice.pendingGame!.prediction!;
  expect((await stored(page)).practice.pendingGame!.moves).toHaveLength(0);
  await page.getByRole("gridcell", { name: /^e2, white pawn$/ }).click();
  await page.getByRole("gridcell", { name: /^e4,.*move available/ }).click();
  await expect
    .poll(
      async () => (await stored(page)).practice.pendingGame?.moves.length ?? 0,
    )
    .toBeGreaterThanOrEqual(2);
  await page.reload();
  await expect
    .poll(
      async () =>
        (await stored(page)).prediction?.metrics.practice.adjusted.games,
    )
    .toBe(1);
  const s = await stored(page);
  expect(s.practice.games).toHaveLength(1);
  expect(s.practice.games[0].prediction).toEqual(initial);
  expect(s.prediction?.metrics.practice.adjusted.games).toBe(1);
  expect(s.prediction?.learned).toBe(0);
  await page.reload();
  expect((await stored(page)).prediction?.metrics.practice.adjusted.games).toBe(
    1,
  );
});
test("model settings persist, all career statistics start empty, and upset panels remain readable on small phones", async ({
  page,
}) => {
  await createCareer(page);
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  await page.getByRole("tab", { name: "Prepare", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tournament preparation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Coach contracts", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Career", exact: true }).click();
  await page
    .getByRole("tab", { name: "Match predictions", exact: true })
    .click();
  const stats = page.getByTestId("prediction-statistics");
  await expect(stats).toContainText("0 completed predictions");
  await stats.getByRole("tab", { name: "Model settings", exact: true }).click();
  await page.getByLabel("Maximum context adjustment (Elo)").fill("60");
  await expect
    .poll(async () => (await stored(page)).prediction?.config.maxAdjustment)
    .toBe(60);
  await page.reload();
  await stats.getByRole("tab", { name: "Model settings", exact: true }).click();
  await expect(page.getByLabel("Maximum context adjustment (Elo)")).toHaveValue(
    "60",
  );
  await page.getByText("Advanced model parameters", { exact: true }).click();
  await page.getByLabel("classical White advantage").fill("15");
  await expect
    .poll(
      async () => (await stored(page)).prediction?.config.whiteElo.classical,
    )
    .toBe(15);
  await noHorizontalOverflow(page);
  await page
    .getByRole("button", { name: "Reset prediction settings", exact: true })
    .click();
  expect((await stored(page)).prediction?.config.maxAdjustment).toBe(100);
  await stats.getByRole("tab", { name: "Upsets", exact: true }).click();
  await expect(stats).toContainText("Biggest career upset");
  await expect(
    stats.getByRole("tab", { name: "Elo calculator", exact: true }),
  ).toHaveCount(0);
  await noHorizontalOverflow(page);
});
