import { test, expect, type Locator } from "@playwright/test";
import { createCareer } from "./helpers";

async function expectEightEvenRows(grid: Locator) {
  const geometry = await grid.evaluate((el) => {
    const board = el.getBoundingClientRect();
    const cells = [...el.querySelectorAll('[role="gridcell"]')].map((cell) =>
      cell.getBoundingClientRect(),
    );
    return {
      width: board.width,
      height: board.height,
      rows: new Set(cells.map((cell) => Math.round(cell.top))).size,
      cells: cells.length,
      shortest: Math.min(...cells.map((cell) => cell.height)),
      tallest: Math.max(...cells.map((cell) => cell.height)),
      explicitRows: el.classList.contains("grid-rows-8"),
    };
  });
  expect(geometry.cells).toBe(64);
  expect(geometry.rows).toBe(8);
  expect(geometry.explicitRows).toBe(true);
  expect(Math.abs(geometry.height - geometry.width)).toBeLessThanOrEqual(1);
  expect(geometry.tallest - geometry.shortest).toBeLessThanOrEqual(1);
}

test("Complete clocks update independently and live/review boards keep eight rows on phones", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const target = window as typeof window & { __matchIntervals?: Set<number> };
    target.__matchIntervals = new Set();
    const start = window.setInterval.bind(window);
    const stop = window.clearInterval.bind(window);
    window.setInterval = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      const id = start(handler, timeout, ...args);
      if (timeout === 100) target.__matchIntervals!.add(id);
      return id;
    }) as typeof window.setInterval;
    window.clearInterval = ((id?: number) => {
      target.__matchIntervals!.delete(id!);
      stop(id);
    }) as typeof window.clearInterval;
  });
  await createCareer(page);
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  await page.getByText("Individual match / free play", { exact: true }).click();
  await page.getByRole("button", { name: "White", exact: true }).click();
  await page.getByRole("button", { name: "Friendly", exact: true }).click();
  await page.getByTestId("custom-minutes").fill("1");
  await page.getByTestId("custom-increment").fill("0");
  await page.getByTestId("start-game").click();
  await expect(page.getByTestId("match-viewer")).toBeVisible();
  const whiteClock = page.getByTestId("clock-white");
  const blackBefore = await page.getByTestId("clock-black").textContent();
  const whiteBefore = await whiteClock.textContent();
  await expect.poll(() => whiteClock.textContent()).not.toBe(whiteBefore);
  expect(await page.getByTestId("clock-black").textContent()).toBe(blackBefore);

  const grid = page
    .getByTestId("match-board")
    .getByRole("grid", { name: "Chess board" });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expectEightEvenRows(grid);
  }
  await page.locator('[data-square="e2"]').click();
  await expect(page.locator('[data-square="e4"]')).toHaveAttribute(
    "data-target",
    "true",
  );
  await page.locator('[data-square="e4"]').click();
  await expect(
    page.getByTestId("move-list").locator('button[data-ply="2"]'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await expect(page.getByTestId("result-banner")).toBeVisible();
  const finished = await whiteClock.textContent();
  await page.waitForTimeout(250);
  expect(await whiteClock.textContent()).toBe(finished);
  await expect(page.getByTestId("review-report")).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole("button", { name: "Start", exact: true }).click();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expectEightEvenRows(grid);
  }
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByTestId("match-viewer")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __matchIntervals: Set<number> })
          .__matchIntervals.size,
    ),
  ).toBe(0);
  expect(errors).toEqual([]);
});
