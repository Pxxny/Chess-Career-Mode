import { continueSeasonUntil } from "./seasonNews";
import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const OUT = "artifacts/ui-learning-elo";
test.beforeAll(async () => { await mkdir(OUT, { recursive: true }); await mkdir("verification/ui-learning-elo", { recursive: true }); });

async function createSmallCareer(page: Page) {
  await page.addInitScript(() => localStorage.setItem("chess-career-install-hidden", "yes"));
  await page.addInitScript(() => localStorage.setItem("chess-career-tour-dismissed", "yes"));
  await page.goto("/");
  await page.getByRole("button", { name: "New character", exact: true }).first().click();
  await page.getByLabel("Full name").fill("Narin Chaiwat");
  await page.getByText("Prefer not to say", { exact: true }).click();
  await page.getByRole("combobox", { name: "Nationality", exact: true }).fill("Thailand");
  await page.getByRole("option", { name: /Thailand/ }).click();
  await page.getByRole("combobox", { name: "City", exact: true }).fill("Bangkok");
  await page.getByRole("option", { name: /^Bangkok/ }).first().click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("radio", { name: "Small", exact: true }).check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create career", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Main", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
}
async function state(page: Page): Promise<any> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("chess-career-mode"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try { return await new Promise<any>((resolve, reject) => { const r = db.transaction("keyval").objectStore("keyval").get("chess-career-mode-save-slot-1"); r.onsuccess = () => resolve(JSON.parse(r.result).state.save); r.onerror = () => reject(r.error); }); }
    finally { db.close(); }
  });
}
async function noOverflow(page: Page) {
  const layout = await page.evaluate(() => ({ fits: document.documentElement.scrollWidth <= window.innerWidth + 1,
    viewport: innerWidth, width: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("main *")].filter((el) => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map((el) => ({ tag: el.tagName, text: el.textContent?.slice(0, 100), classes: el.className })) }));
  expect(layout, JSON.stringify(layout)).toMatchObject({ fits: true });
}
async function language(page: Page, lang: "en" | "th") {
  await page.getByRole("combobox", { name: "Language / ภาษา", exact: true }).first().selectOption(lang);
}
async function screenshot(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
}

// Deliberately mock only the OS-facing API: a browser test cannot control a physical display.
async function mockWakeLock(page: Page, mode: "ok" | "reject" | "unsupported" = "ok") {
  await page.addInitScript((mode) => {
    const api = { requests: 0, releases: 0, locks: [] as any[], visibility: "visible", fail: mode === "reject" };
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => api.visibility });
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: mode === "unsupported" ? undefined : { request: async (type: string) => {
      api.requests++;
      if (api.fail) throw new DOMException("Not allowed", "NotAllowedError");
      if (type !== "screen") throw new Error("Wrong lock type");
      const lock = new EventTarget() as any;
      lock.released = false;
      lock.release = async () => { if (lock.released) return; lock.released = true; api.releases++; lock.dispatchEvent(new Event("release")); };
      api.locks.push(lock);
      return lock;
    } } });
    (window as any).__wakeTest = api;
  }, mode);
}

test("real learning season: select priorities, pause/reload/resume, view Elo in three periods, Thai/mobile and live board", async ({ page }) => {
  test.setTimeout(600000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockWakeLock(page);
  await page.setViewportSize({ width: 1440, height: 1040 });
  await createSmallCareer(page);
  await expect(page.getByTestId("screen-wake-status")).toHaveAttribute("data-status", "active");
  await screenshot(page, "01-home-desktop-en");
  await noOverflow(page);
  await page.getByRole("link", { name: "View stats", exact: true }).click();
  await expect(page.getByTestId("elo-chart")).toContainText("No rating history yet");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByTestId("simulate-season-panel").getByRole("button", { name: "Simulate Season", exact: true }).click();
  let options = page.getByRole("dialog", { name: "Simulate Season", exact: true });
  await options.getByLabel("Season approach").selectOption("learning");
  await options.getByRole("checkbox", { name: "Openings", exact: true }).check();
  await options.getByRole("checkbox", { name: "Endgames", exact: true }).check();
  await options.screenshot({ path: `${OUT}/02-learning-options-en.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await language(page, "th");
  await expect(page.getByText("เลือกด้านที่เน้นฝึก", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(2);
  await screenshot(page, "03-learning-options-mobile-th");
  await noOverflow(page);
  await language(page, "en");
  await page.setViewportSize({ width: 1440, height: 1040 });
  options = page.getByRole("dialog", { name: "Simulate Season", exact: true });
  await options.getByRole("button", { name: "Start season simulation", exact: true }).click();
  await continueSeasonUntil(page, async () => ((await state(page)).seasonSimulation?.days ?? 0) > 12);
  await screenshot(page, "04-season-progress");
  await page.getByRole("button", { name: "Pause simulation", exact: true }).click();
  await expect(page.getByTestId("season-progress")).toBeHidden();
  const checkpoint = await state(page);
  expect(checkpoint.seasonSimulation.learningFocus).toEqual(["opening", "endgame"]);
  const trainingIds = checkpoint.history.sessions.map((r: any) => r.sessionId);
  expect(trainingIds).toContain("opening-study");
  expect(trainingIds).toContain("endgame-practice");
  await page.reload();
  await page.getByRole("button", { name: "Resume season simulation", exact: true }).click();
  options = page.getByRole("dialog", { name: "Resume season simulation", exact: true });
  await expect(options.getByRole("checkbox", { name: "Openings", exact: true })).toBeChecked();
  await expect(options.getByRole("checkbox", { name: "Endgames", exact: true })).toBeDisabled();
  await options.getByRole("button", { name: "Resume simulation", exact: true }).click();
  await continueSeasonUntil(page, async () => (await state(page)).seasonSimulation?.status === "completed");
  await expect(page.getByTestId("season-progress")).toBeHidden();
  const review = page.getByRole("dialog", { name: "2026 · Year in review", exact: true });
  await expect(review).toBeVisible();
  await screenshot(page, "05-year-review");
  await review.getByRole("button", { name: "Continue to 2027", exact: true }).click();
  const saved = await state(page);
  expect(saved.seasonSimulation.status).toBe("completed");
  expect(saved.seasonSimulation.games).toBeGreaterThan(10);
  expect(saved.seasonSimulation.sessions).toBeGreaterThan(100);
  expect(saved.history.games.every((g: any) => g.day >= 1 && g.day <= 7)).toBe(true);
  await page.getByRole("link", { name: "View stats", exact: true }).click();
  const chart = page.getByTestId("elo-chart");
  await expect(chart.locator("canvas")).toBeVisible();
  await chart.getByText("View chart data", { exact: true }).click();
  const monthClosing = new Map<string, number>();
  for (const point of saved.history.ratingHistory) {
    const d = new Date(Date.UTC(point.year, 0, 1 + (point.week - 1) * 7 + (point.day ?? 1) - 1));
    monthClosing.set(`${point.year}-${d.getUTCMonth()}`, point.elo);
  }
  const cells = () => chart.getByTestId("elo-chart-data").locator("tbody td").allTextContents();
  expect((await cells()).map(Number)).toEqual([...monthClosing.values()]);
  await screenshot(page, "06-elo-month-desktop-en");
  await chart.getByRole("button", { name: "Tournament", exact: true }).click();
  const closing = new Map<string, number>();
  for (const g of saved.history.games) if (g.tournamentId) closing.set(`${g.year}:${g.tournamentId}`, g.ratingAfter);
  expect((await cells()).map(Number)).toEqual([...closing.values()]);
  await screenshot(page, "07-elo-tournament-desktop-en");
  await chart.getByRole("button", { name: "Year", exact: true }).click();
  expect((await cells()).map(Number)).toEqual([saved.history.ratingHistory.at(-1).elo]);
  await screenshot(page, "08-elo-year-desktop-en");
  await chart.getByText("View chart data", { exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await language(page, "th");
  await chart.getByRole("button", { name: "เดือน", exact: true }).click();
  await chart.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 118));
  await screenshot(page, "09-elo-month-mobile-th");
  await noOverflow(page);
  // Phone and small-phone layout, then visible primary tabs plus the secondary selector.
  await page.setViewportSize({ width: 320, height: 740 });
  await page.context().storageState({ path: "/tmp/chess-ui-learning-storage.json", indexedDB: true });
  await noOverflow(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await language(page, "en");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await screenshot(page, "10-home-mobile-en", true);
  await page.getByText("Rankings & world players", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rankings", exact: true })).toBeVisible();
  await noOverflow(page);
  await page.getByRole("link", { name: "Career", exact: true }).click();
  await expect(page.getByRole("tablist", { name: "Career sections" }).getByRole("tab")).toHaveCount(2);
  await page.getByLabel("Career sections: more sections").selectOption("years");
  await expect(page.getByRole("tab", { name: "Year in review", exact: true })).toHaveAttribute("aria-selected", "true");
  await screenshot(page, "11-career-more-mobile-en");
  await page.getByRole("link", { name: "Train", exact: true }).click();
  await page.getByLabel("Training sections: more sections").selectOption("effects");
  await expect(page.getByRole("heading", { name: "How training affects play", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Games", exact: true }).click();
  await page.getByRole("button", { name: /^Training Game/ }).click();
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect(page.getByRole("gridcell")).toHaveCount(64);
  await expect(page.getByText("Your move (White).", { exact: true })).toBeVisible();
  await page.getByRole("gridcell", { name: /^e2,/ }).click();
  await page.getByRole("gridcell", { name: /^e4,/ }).click();
  await expect(page.getByText("Your move (White).", { exact: true })).toBeVisible({ timeout: 45000 });
  await language(page, "th");
  await page.locator('[role="grid"]').first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 166));
  await screenshot(page, "12-live-game-mobile-th");
  await noOverflow(page);
  expect(errors).toEqual([]);
  await writeFile("verification/ui-learning-elo/browser-results.json", JSON.stringify({ fullSeason: { days: saved.seasonSimulation.days, games: saved.seasonSimulation.games, trainingSessions: saved.seasonSimulation.sessions, priorities: saved.seasonSimulation.learningFocus }, monthPoints: monthClosing.size, tournamentPoints: closing.size, screenshots: 12, pageErrors: errors, viewports: [1440, 390, 320] }, null, 2));
});

test("wake lock releases on hide/exit, reacquires on return, recovers after system release without duplicates", async ({ page }) => {
  await mockWakeLock(page);
  await createSmallCareer(page);
  const status = page.getByTestId("screen-wake-status");
  await expect(status).toHaveAttribute("data-status", "active");
  const count = (key: string) => page.evaluate((key) => (window as any).__wakeTest[key], key);
  await page.keyboard.press("Shift");
  await page.getByRole("link", { name: "Train", exact: true }).click();
  expect(await count("requests")).toBe(1);
  await page.evaluate(() => { (window as any).__wakeTest.visibility = "hidden"; document.dispatchEvent(new Event("visibilitychange")); });
  await expect(status).toHaveAttribute("data-status", "idle");
  expect(await count("releases")).toBe(1);
  await page.evaluate(() => { (window as any).__wakeTest.visibility = "visible"; document.dispatchEvent(new Event("visibilitychange")); });
  await expect(status).toHaveAttribute("data-status", "active");
  expect(await count("requests")).toBe(2);
  await page.evaluate(() => (window as any).__wakeTest.locks.at(-1).release());
  await expect(status).toHaveAttribute("data-status", "idle");
  await page.keyboard.press("Shift");
  await expect(status).toHaveAttribute("data-status", "active");
  expect(await count("requests")).toBe(3);
  await page.getByRole("link", { name: "Career", exact: true }).click();
  await page.getByText("Save & character management", { exact: true }).click();
  await page.getByRole("button", { name: "Your characters", exact: true }).click();
  await expect(status).toHaveCount(0);
  expect(await count("releases")).toBe(3);
});

for (const mode of ["reject", "unsupported"] as const) test(`wake lock ${mode} does not block play`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockWakeLock(page, mode);
  await createSmallCareer(page);
  await expect(page.getByTestId("screen-wake-status")).toHaveAttribute("data-status", mode === "unsupported" ? "unavailable" : "idle");
  await page.getByRole("link", { name: "Train", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Sessions", exact: true })).toBeVisible();
  if (mode === "reject") {
    await page.evaluate(() => { (window as any).__wakeTest.fail = false; });
    await page.keyboard.press("Shift");
    await expect(page.getByTestId("screen-wake-status")).toHaveAttribute("data-status", "active");
  }
  expect(errors).toEqual([]);
});
