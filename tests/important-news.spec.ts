import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { openSectionTab, openCareerManagement } from "./navigation";
const OUT = "artifacts/important-news";
test.beforeAll(async () => {
  execFileSync(process.execPath, ["--experimental-strip-types", "--import", "./scripts/register-alias.mjs", "scripts/verify-important-news.ts"]);
  await mkdir(OUT, { recursive: true });
});
async function importCareer(page: Page, file: string) {
  await page.addInitScript(() => {
    localStorage.setItem("chess-career-install-hidden", "yes");
    localStorage.setItem("chess-career-tour-dismissed", "yes");
  });
  await page.goto("/");
  await page.getByLabel("Backup file").setInputFiles(file);
  await page.getByRole("button", { name: "Restore backup", exact: true }).click();
  await page.getByLabel("Character slot 1").getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator(".app-shell").waitFor();
  if (!await page.getByTestId("career-news-article").count())
    await page.getByRole("link", { name: "Home", exact: true }).click();
}
async function save(page: Page): Promise<any> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => { const r = indexedDB.open("chess-career-mode"); r.onsuccess = () => resolve(r.result); });
    try { return await new Promise((resolve) => { const r = db.transaction("keyval").objectStore("keyval").get("chess-career-mode-save-slot-1"); r.onsuccess = () => resolve(JSON.parse(r.result).state.save); }); } finally { db.close(); }
  });
}
async function fit(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }

test("registered national starting roster pauses simulation before play; read state persists and resume plays the cup once", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  await importCareer(page, "/tmp/chess-news-national-backup.json");
  const before = await save(page);
  await page.getByTestId("simulate-season-panel").getByRole("button", { name: "Simulate Season", exact: true }).click();
  await page.getByRole("button", { name: "Start season simulation", exact: true }).click();
  const news = page.getByTestId("career-news-article");
  await expect(news).toContainText("selected for the national team");
  await expect(page.getByTestId("season-progress")).toBeHidden();
  const stopped = await save(page);
  expect(stopped.world).toEqual(before.world);
  expect(stopped.expansion.cups).toHaveLength(0);
  await expect(news.locator("img")).toBeVisible();
  await page.screenshot({ animations: "disabled", path: `${OUT}/01-national-callup-desktop.png` });
  await page.reload();
  await expect(news).toContainText("selected for the national team");
  expect((await save(page)).highlights.items).toHaveLength(1);
  await news.getByRole("button", { name: "Read and stay paused", exact: true }).click();
  await expect(news).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("simulate-season-panel")).toBeVisible();
  await expect(news).toHaveCount(0);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByTestId("career-newsroom").getByRole("button", { name: /selected for the national team/ }).click();
  await expect(news).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(news).toHaveCount(0);
  await page.getByRole("button", { name: "Resume season simulation", exact: true }).click();
  await page.getByRole("button", { name: "Resume simulation", exact: true }).click();
  await expect.poll(async () => (await save(page)).expansion.cups.length).toBe(1);
  if (await page.getByRole("button", { name: "Pause simulation", exact: true }).isVisible()) await page.getByRole("button", { name: "Pause simulation", exact: true }).click();
  await expect(page.getByTestId("season-progress")).toBeHidden();
  const done = await save(page);
  expect(done.highlights.items.filter((a: any) => a.id.startsWith("national-selected:"))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("victory news has a cover, headline and body; mobile uses a drawer, Thai translation and archive remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  await importCareer(page, "/tmp/chess-news-victory-backup.json");
  const news = page.getByTestId("career-news-article");
  await expect(news).toContainText("wins Bangkok Open");
  await expect(news.locator("img")).toHaveAttribute("src", "/news/trophy.svg");
  expect(await news.locator("img").evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await page.screenshot({ animations: "disabled", path: `${OUT}/02-victory-mobile-en.png` });
  await news.getByRole("button", { name: "Read and stay paused", exact: true }).click();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("combobox", { name: "Language / ภาษา" }).selectOption("th");
  const newsroom = page.getByTestId("career-newsroom");
  await newsroom.getByRole("textbox", { name: "ค้นหาข่าวอาชีพ" }).fill("Bangkok");
  await newsroom.getByRole("button", { name: /คว้าแชมป์ Bangkok Open/ }).click();
  await expect(news).toContainText("จบอันดับหนึ่ง");
  await page.screenshot({ animations: "disabled", path: `${OUT}/03-victory-mobile-th.png` });
  await fit(page);
  await news.getByRole("button", { name: "ปิดข่าว", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 740 });
  await fit(page);
  await page.screenshot({ animations: "disabled", path: `${OUT}/04-newsroom-small-mobile-th.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("FullCalendar shows annual events and opens existing tournament details; Sonner confirms backup export", async ({ page }) => {
  await importCareer(page, "/tmp/chess-news-national-backup.json");
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await openSectionTab(page, "Annual calendar");
  await page.getByRole("button", { name: "Calendar view", exact: true }).click();
  const calendar = page.getByTestId("season-month-calendar");
  await expect(calendar.locator(".fc-event").first()).toBeVisible();
  await page.screenshot({ animations: "disabled", path: `${OUT}/05-fullcalendar-desktop.png` });
  await calendar.locator(".fc-event").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await calendar.scrollIntoViewIfNeeded();
  await fit(page);
  await page.screenshot({ animations: "disabled", path: `${OUT}/06-fullcalendar-mobile.png` });
  await page.getByRole("link", { name: "Career", exact: true }).click();
  await openCareerManagement(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup", exact: true }).click();
  await download;
  await expect(page.getByText("Career backup prepared", { exact: true })).toBeVisible();
  await page.screenshot({ animations: "disabled", path: `${OUT}/07-backup-toast.png` });
});

async function createTourCareer(page: Page) {
  await page.addInitScript(() => localStorage.setItem("chess-career-install-hidden", "yes"));
  await page.goto("/");
  await page.getByRole("button", { name: "New character", exact: true }).first().click();
  await page.getByLabel("Full name").fill("Tour Player");
  await page.getByText("Prefer not to say", { exact: true }).click();
  await page.getByRole("combobox", { name: "Nationality", exact: true }).fill("Thailand");
  await page.getByRole("option", { name: /Thailand/ }).click();
  await page.getByRole("combobox", { name: "City", exact: true }).fill("Bangkok");
  await page.getByRole("option", { name: /^Bangkok/ }).first().click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("radio", { name: "Small", exact: true }).check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create career", exact: true }).click();
  await page.getByRole("link", { name: "Home", exact: true }).click();
}
for (const action of ["skip", "close"] as const) test(`Joyride ${action} is permanent across reload and a second character`, async ({ page }) => {
  await createTourCareer(page);
  await expect(page.getByText("Welcome to your chess career", { exact: true })).toBeVisible();
  await page.screenshot({ animations: "disabled", path: `${OUT}/08-first-run-tour-${action}.png` });
  await page.getByRole("button", { name: action === "skip" ? "Do not show again" : "Close tour", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("chess-career-tour-dismissed"))).toBe("yes");
  await page.reload();
  await expect(page.getByTestId("simulate-season-panel")).toBeVisible();
  await page.waitForTimeout(1400);
  await expect(page.getByText("Welcome to your chess career", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Career", exact: true }).click();
  await openCareerManagement(page);
  await page.getByRole("button", { name: "Your characters", exact: true }).click();
  await createTourCareer(page);
  await page.waitForTimeout(1400);
  await expect(page.getByText("Welcome to your chess career", { exact: true })).toHaveCount(0);
});

test("important news takes priority over year review and completed seasons do not restart", async ({ page }) => {
  await importCareer(page, "/tmp/chess-news-yearend-backup.json");
  const news = page.getByTestId("career-news-article");
  await expect(news).toBeVisible();
  await expect(page.getByRole("dialog", { name: "2026 · Year in review", exact: true })).toHaveCount(0);
  await expect(news.getByRole("button", { name: "Continue season", exact: true })).toHaveCount(0);
  await news.getByRole("button", { name: "Close news", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "2026 · Year in review", exact: true })).toBeVisible();
  expect((await save(page)).seasonSimulation.status).toBe("completed");
});
