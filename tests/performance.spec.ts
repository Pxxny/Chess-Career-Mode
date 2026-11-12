import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createCareer } from "./helpers";
async function openMenu(page: Page) {
  await page
    .getByRole("button", { name: "Open performance menu", exact: true })
    .click();
  return page.getByRole("dialog", {
    name: "Performance diagnostics",
    exact: true,
  });
}
async function report(page: Page) {
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download performance report", exact: true })
    .click();
  const file = await download;
  return JSON.parse(await readFile((await file.path())!, "utf8"));
}
async function save(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open("chess-career-mode");
      q.onsuccess = () => r(q.result);
    });
    const result = await new Promise<any>((r) => {
      const q = db
        .transaction("keyval")
        .objectStore("keyval")
        .get("chess-career-mode-save-slot-1");
      q.onsuccess = () => r(q.result);
    });
    db.close();
    return result;
  });
}
const capture = {
  style: "header.sticky, nav.fixed { visibility:hidden !important; }",
};
test("secret gesture, keyboard and URL entry; real city download/cache/filter metrics, pause, clear, report and hide", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("chess-career-install-hidden", "yes"),
  );
  await page.goto("/");
  await expect(page.getByTestId("performance-menu")).toHaveCount(0);
  const brand = page.locator("[data-performance-trigger]").first();
  for (let i = 0; i < 6; i++) await brand.click();
  await expect(page.getByTestId("performance-menu")).toHaveCount(0);
  await brand.click();
  let menu = page.getByRole("dialog", {
    name: "Performance diagnostics",
    exact: true,
  });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "New character", exact: true })
    .first()
    .click();
  await page.getByLabel("Full name").fill("Perf QA Secret Name");
  await page.getByText("Prefer not to say", { exact: true }).click();
  const nationality = page.getByRole("combobox", {
      name: "Nationality",
      exact: true,
    }),
    city = page.getByRole("combobox", { name: "City", exact: true });
  await nationality.fill("Russia");
  await page
    .getByRole("option", { name: /Russia/ })
    .first()
    .click();
  await city.click();
  await expect(
    page.getByRole("listbox", { name: "City", exact: true }),
  ).toHaveAttribute("data-total-options", "4301");
  await city.fill("a");
  await expect(
    page.getByRole("listbox", { name: "City", exact: true }),
  ).toHaveAttribute("data-total-options", "2687");
  menu = await openMenu(page);
  await menu.getByRole("tab", { name: "Timings", exact: true }).click();
  await expect(menu.locator('[data-metric="city.load"]')).toBeVisible();
  await expect(menu.locator('[data-metric="city.parse"]')).toBeVisible();
  const before = await report(page);
  expect(before.format).toBe("chess-career-performance");
  expect(JSON.stringify(before)).not.toContain("Perf QA Secret Name");
  expect(
    before.metrics.find((m: any) => m.id === "city.load").last.tags.items,
  ).toBe(4301);
  await menu
    .getByRole("button", { name: "Pause measurements", exact: true })
    .click();
  const paused = await report(page);
  await menu.getByRole("button", { name: "Close dialog", exact: true }).click();
  await city.fill("Moscow");
  menu = await openMenu(page);
  const still = await report(page);
  expect(still.metrics).toEqual(paused.metrics);
  await menu
    .getByRole("button", { name: "Resume measurements", exact: true })
    .click();
  await menu.getByRole("button", { name: "Close dialog", exact: true }).click();
  await nationality.fill("Thailand");
  await page
    .getByRole("option", { name: /Thailand/ })
    .first()
    .click();
  await city.click();
  await expect(
    page.getByRole("listbox", { name: "City", exact: true }),
  ).toHaveAttribute("data-total-options", "955");
  await nationality.fill("Russia");
  await page
    .getByRole("option", { name: /Russia/ })
    .first()
    .click();
  await city.click();
  await expect(
    page.getByRole("listbox", { name: "City", exact: true }),
  ).toHaveAttribute("data-total-options", "4301");
  menu = await openMenu(page);
  const cached = await report(page);
  expect(
    cached.metrics.find((m: any) => m.id === "city.load").last.tags.source,
  ).toBe("memory");
  await menu.getByRole("tab", { name: "Timings", exact: true }).click();
  await menu.screenshot({
    path: "artifacts/performance-city-timings-en.png",
    ...capture,
  });
  await menu
    .getByRole("button", { name: "Clear measurements", exact: true })
    .click();
  expect(
    (await report(page)).metrics.some((m: any) => m.id === "city.load"),
  ).toBe(false);
  await menu
    .getByRole("button", { name: "Hide diagnostics", exact: true })
    .click();
  await expect(page.getByTestId("performance-menu")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open performance menu", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("chess-career-performance"),
    ),
  ).toBeNull();
  await page.keyboard.press("Control+Shift+D");
  await expect(page.getByTestId("performance-menu")).toBeVisible();
  await page.goto("/?perf=1");
  await expect(page.getByTestId("performance-menu")).toBeVisible();
  await page
    .getByRole("button", { name: "Hide diagnostics", exact: true })
    .click();
  await expect(page).not.toHaveURL(/perf=1/);
});
test("mobile real career: AP gesture leaves save unchanged; calendar fast-forward and NPC engine moves appear in downloadable report", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("chess-career-install-hidden", "yes"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
  const original = await save(page);
  for (let i = 0; i < 7; i++)
    await page.locator("header [data-performance-trigger]").click();
  let menu = page.getByRole("dialog", {
    name: "Performance diagnostics",
    exact: true,
  });
  await expect(menu).toBeVisible();
  expect(await save(page)).toBe(original);
  await menu.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect
    .poll(async () => (await report(page)).runtime.fps)
    .not.toBeNull();
  await menu.screenshot({
    path: "artifacts/performance-overview-en.png",
    ...capture,
  });
  await menu.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await page
    .getByRole("button", { name: "Find suitable tournaments", exact: true })
    .click();
  const finder = page.getByRole("dialog", {
    name: "Find a suitable tournament",
    exact: true,
  });
  await finder.getByLabel("Starts within (weeks)").fill("52");
  await finder.getByLabel("Minimum entry Elo up to").fill("3500");
  await finder.getByLabel("Tournament pairing").selectOption("rotation");
  await finder.getByLabel("Only events I can enter now").uncheck();
  await finder
    .getByRole("button", { name: "Find tournaments", exact: true })
    .click();
  await page
    .getByLabel("Search tournaments", { exact: true })
    .fill("Open Board Rotation · 2026/2");
  await page
    .locator('[data-event-id="rotation-2026-2-0"]')
    .getByTestId("register")
    .click();
  const reg = page.getByTestId("registrations").locator(":scope > li").first();
  await reg
    .getByRole("button", { name: "Simulate until tournament", exact: true })
    .click();
  const plan = page.getByRole("dialog", { name: /Plan the days before/ });
  for (const c of await plan.getByRole("checkbox").all()) await c.uncheck();
  await plan
    .getByRole("button", { name: "Confirm & simulate", exact: true })
    .click();
  await expect(
    reg.getByRole("button", { name: "Date reached", exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await page.getByTestId("start-event").click();
  await page.getByTestId("open-current-tournament").click();
  const tournament = page.getByRole("dialog", { name: /Open Board Rotation/ });
  await tournament
    .getByRole("tab", { name: "Pairings & live boards", exact: true })
    .click();
  await tournament
    .getByRole("button", { name: "Watch live board", exact: true })
    .first()
    .click();
  const live = page.getByTestId("live-broadcast");
  await live.getByLabel("Broadcast speed").selectOption("max");
  await expect
    .poll(async () => Number(await live.getAttribute("data-broadcast-ply")))
    .toBeGreaterThan(12);
  await live
    .getByRole("button", { name: "Pause broadcast", exact: true })
    .click();
  // Diagnostics must be reachable over another modal on mobile.
  menu = await openMenu(page);
  const data = await report(page);
  await writeFile(
    "verification/performance/game-browser-report.json",
    JSON.stringify(data, null, 2) + "\n",
  );
  for (const id of [
    "calendar.day",
    "calendar.events",
    "calendar.circuit",
    "calendar.advance",
    "engine.search",
    "match.auto-move",
    "storage.write",
  ])
    expect(data.metrics.some((m: any) => m.id === id)).toBe(true);
  expect(
    data.metrics.find((m: any) => m.id === "calendar.advance").last.tags.days,
  ).toBeGreaterThan(0);
  expect(
    data.recent.some(
      (e: any) => e.id === "match.auto-move" && e.tags.speed === "max",
    ),
  ).toBe(true);
  expect(
    data.metrics.find((m: any) => m.id === "engine.search").last.tags.budgetMs,
  ).toBeGreaterThan(0);
  await menu.getByRole("tab", { name: "Timings", exact: true }).click();
  await menu.screenshot({
    path: "artifacts/performance-game-timings-en.png",
    ...capture,
  });
  await menu
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  menu = page.getByRole("dialog", { name: "ตรวจประสิทธิภาพ", exact: true });
  await expect(menu).toContainText("เฉลี่ย");
  const horizontal = menu.getByTestId("performance-timing-scroll");
  expect(await horizontal.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(
    true,
  );
  await menu.screenshot({
    path: "artifacts/performance-game-timings-th.png",
    ...capture,
  });
  // A wide capture lets the exported Playtest show every numeric column too.
  await page.setViewportSize({ width: 1100, height: 1000 });
  await menu.screenshot({
    path: "artifacts/performance-game-timings-wide-th.png",
    ...capture,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await menu.getByRole("tab", { name: "ตัวอย่างล่าสุด", exact: true }).click();
  await menu.screenshot({
    path: "artifacts/performance-recent-th.png",
    ...capture,
  });
  const saved = await save(page);
  await menu.getByRole("button", { name: "ซ่อนเมนูลับ", exact: true }).click();
  expect(await save(page)).toBe(saved);
  await page.reload();
  await expect(page.getByTestId("performance-menu")).toHaveCount(0);
});
