import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createCareer } from "./helpers";
const capture = {
  style: "header.sticky, nav.fixed { visibility:hidden !important; }",
};
async function start(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("chess-career-install-hidden", "yes"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const save = await new Promise<any>((resolve) => {
      const r = db
        .transaction("keyval")
        .objectStore("keyval")
        .get("chess-career-mode-save-slot-1");
      r.onsuccess = () => resolve(JSON.parse(r.result).state.save);
    });
    db.close();
    return save;
  });
}
test("annual calendar is a real tab, shows the complete current year and filters regular vs national team events, without future years", async ({
  page,
}) => {
  await start(page);
  const category = page.getByLabel("Tournament category", { exact: true });
  await expect(category.locator("option")).toHaveText([
    "All categories",
    "Regular tournaments",
    "National teams",
  ]);
  await category.selectOption("national");
  await expect(
    page.getByTestId("open-events").locator('[data-event-kind="regular"]'),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Annual calendar", exact: true }).click();
  const calendar = page.getByTestId("annual-calendar");
  await expect(
    calendar.getByLabel("Tournament year").locator("option"),
  ).toHaveText(["2025", "2026"]);
  await calendar
    .getByLabel("Annual tournament category")
    .selectOption("national");
  await expect(calendar.locator('[data-event-kind="regular"]')).toHaveCount(0);
  await calendar.getByLabel("Search annual tournaments").fill("African Games");
  const event = calendar.locator(
    '[data-annual-event="career-african-games-2026"]',
  );
  await expect(event).toContainText("National teams");
  await event
    .getByRole("button", { name: "View tournament", exact: true })
    .click();
  const detail = page.getByRole("dialog", {
    name: "African Games (Mixed Team) 2026",
    exact: true,
  });
  await expect(detail.getByTestId("event-host")).toHaveText("Cairo, Egypt");
  await expect(detail.getByTestId("registration-window")).toContainText(
    "2025-",
  );
  await detail.screenshot({
    path: "artifacts/annual-event-details-en.png",
    ...capture,
  });
  await detail
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await calendar
    .getByLabel("Annual tournament category")
    .selectOption("regular");
  await calendar
    .getByLabel("Search annual tournaments")
    .fill("Seven Days Masters");
  await expect(calendar.locator('[data-event-kind="national"]')).toHaveCount(0);
  await expect(calendar).toContainText("24 players");
  await calendar.screenshot({
    path: "artifacts/annual-calendar-en.png",
    ...capture,
  });
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await expect(calendar).toContainText("ปฏิทินทัวร์นาเมนต์ประจำปี");
  await calendar.screenshot({
    path: "artifacts/annual-calendar-th.png",
    ...capture,
  });
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("en");
  await page
    .getByRole("tab", { name: "Tournament history", exact: true })
    .click();
  const history = page.getByTestId("annual-history");
  await history.getByLabel("Tournament year").selectOption("2025");
  await expect(history).toContainText(
    "No tournament results recorded for this year.",
  );
  await expect(
    history.getByLabel("Tournament year").locator("option"),
  ).not.toContainText(["2027"]);
});
test("NPC live board plays real moves, pauses and reloads without spending player resources; world history persists separately and travels in backups", async ({
  page,
}) => {
  await start(page);
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
  const registration = page
    .getByTestId("registrations")
    .locator(":scope > li")
    .first();
  await registration
    .getByRole("button", { name: "Simulate until tournament", exact: true })
    .click();
  const plan = page.getByRole("dialog", { name: /Plan the days before/ });
  for (const checkbox of await plan.getByRole("checkbox").all())
    await checkbox.uncheck();
  await plan
    .getByRole("button", { name: "Confirm & simulate", exact: true })
    .click();
  await expect(
    registration.getByRole("button", { name: "Date reached", exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await page.getByTestId("start-event").click();
  const before = await stored(page);
  await page.getByTestId("open-current-tournament").click();
  const dialog = page.getByRole("dialog", { name: /Open Board Rotation/ });
  await dialog
    .getByRole("tab", { name: "Pairings & live boards", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Watch live board", exact: true })
    .first()
    .click();
  const live = dialog.getByTestId("live-broadcast");
  await expect(live).toBeVisible();
  await expect
    .poll(async () => Number(await live.getAttribute("data-broadcast-ply")))
    .toBeGreaterThan(1);
  await live
    .getByRole("button", { name: "Pause broadcast", exact: true })
    .click();
  const during = await stored(page);
  const savedBoard = during.tournament.pairings[0].find(
    (b: any) => b.broadcast?.ucis.length,
  );
  expect(savedBoard.broadcast.ucis.length).toBeGreaterThan(1);
  expect(during.player.rating).toBe(before.player.rating);
  expect(during.player.ap).toEqual(before.player.ap);
  expect(during.player.money).toBe(before.player.money);
  expect(during.world.date).toEqual(before.world.date);
  expect(during.history.games.length).toBe(before.history.games.length);
  expect(during.pendingMatch).toBeNull();
  await page.setViewportSize({ width: 390, height: 1200 });
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await dialog.screenshot({
    path: "artifacts/tournament-live-board-en.png",
    ...capture,
  });
  await dialog
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await expect(live).toContainText("พักการถ่ายทอด");
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await dialog.screenshot({
    path: "artifacts/tournament-live-board-th.png",
    ...capture,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("en");
  const after = await stored(page);
  const resumedBoard = after.tournament.pairings[0].find(
    (b: any) => b.white === savedBoard.white && b.black === savedBoard.black,
  );
  expect(
    resumedBoard.broadcast.ucis.slice(0, savedBoard.broadcast.ucis.length),
  ).toEqual(savedBoard.broadcast.ucis);
  await page.getByTestId("open-current-tournament").click();
  await page
    .getByRole("dialog")
    .getByRole("tab", { name: "Pairings & live boards", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Watch live board", exact: true })
    .first()
    .click();
  await expect
    .poll(async () =>
      Number(
        await page
          .getByTestId("live-broadcast")
          .getAttribute("data-broadcast-ply"),
      ),
    )
    .toBeGreaterThan(savedBoard.broadcast.ucis.length);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  const missing = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open("chess-career-mode");
      q.onsuccess = () => r(q.result);
    });
    const row = await new Promise<any>((resolve) => {
      const tx = db.transaction("tournamentArchive", "readwrite"),
        store = tx.objectStore("tournamentArchive"),
        q = store.getAll();
      let row: any;
      q.onsuccess = () => {
        row = q.result.find((r: any) => r.event.source === "world-circuit");
        store.delete(row.key);
      };
      tx.oncomplete = () => resolve(row);
    });
    db.close();
    return row;
  });
  await page
    .getByRole("tab", { name: "Tournament history", exact: true })
    .click();
  const history = page.getByTestId("annual-history");
  await expect(history.locator("[data-annual-event]")).not.toHaveCount(0);
  await expect
    .poll(async () =>
      page.evaluate(async (key) => {
        const db = await new Promise<IDBDatabase>((r) => {
          const q = indexedDB.open("chess-career-mode");
          q.onsuccess = () => r(q.result);
        });
        const row = await new Promise<any>((r) => {
          const q = db
            .transaction("tournamentArchive")
            .objectStore("tournamentArchive")
            .get(key);
          q.onsuccess = () => r(q.result);
        });
        db.close();
        return row?.event?.players?.length ?? 0;
      }, missing.key),
    )
    .toBeGreaterThan(0);
  await page.evaluate(async (row) => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open("chess-career-mode");
      q.onsuccess = () => r(q.result);
    });
    await new Promise<void>((r) => {
      const tx = db.transaction("tournamentArchive", "readwrite");
      tx.objectStore("tournamentArchive").put(row);
      tx.oncomplete = () => r();
    });
    db.close();
  }, missing);
  await history.getByLabel("Tournament year").selectOption("2025");
  await history.getByLabel("Tournament year").selectOption("2026");
  const first = history.locator("[data-annual-event]").first();
  await first
    .getByRole("button", { name: "View tournament", exact: true })
    .click();
  const archive = page.getByRole("dialog");
  await archive.getByRole("tab", { name: "Standings", exact: true }).click();
  await expect(archive.locator("tbody tr")).not.toHaveCount(0);
  await archive.screenshot({
    path: "artifacts/tournament-history-result-en.png",
    ...capture,
  });
  await archive
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await history.screenshot({
    path: "artifacts/tournament-history-year-en.png",
    ...capture,
  });
  await page.getByRole("link", { name: "Career", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const download = await downloadEvent;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.payload.tournamentArchive.length).toBeGreaterThan(0);
  const original = backup.payload.save.career.id;
  await page
    .getByTestId("backup-panel")
    .getByRole("button", { name: "Your characters", exact: true })
    .click();
  await page
    .getByLabel("Backup file", { exact: true })
    .setInputFiles((await download.path())!);
  const restore = page.getByRole("dialog", {
    name: "Restore this career?",
    exact: true,
  });
  await restore
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await expect(restore).not.toBeVisible();
  const copied = await page.evaluate(async (original) => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open("chess-career-mode");
      q.onsuccess = () => r(q.result);
    });
    const rows = await new Promise<any[]>((r) => {
      const q = db
        .transaction("tournamentArchive")
        .objectStore("tournamentArchive")
        .getAll();
      q.onsuccess = () => r(q.result);
    });
    db.close();
    return {
      original: rows.filter((e) => e.key.startsWith(original + "|")).length,
      copies: rows.filter((e) => !e.key.startsWith(original + "|")).length,
    };
  }, original);
  expect(copied.original).toBeGreaterThan(0);
  expect(copied.copies).toBe(copied.original);
});
