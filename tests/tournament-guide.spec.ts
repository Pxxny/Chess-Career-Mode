import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createCareer } from "./helpers";
async function start(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("chess-career-install-hidden", "yes"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
}
async function finder(page: Page) {
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await page
    .getByRole("button", { name: "Find suitable tournaments", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Find a suitable tournament",
    exact: true,
  });
  await modal.getByLabel("Starts within (weeks)").fill("52");
  await modal.getByLabel("Minimum entry Elo up to").fill("3500");
  await modal.getByLabel("Only events I can enter now").uncheck();
  await modal
    .getByRole("button", { name: "Find tournaments", exact: true })
    .click();
}
test("mobile guides show regional national hosts, real opening windows and selected larger capacities in both languages", async ({
  page,
}) => {
  await start(page);
  await finder(page);
  await page.getByLabel("Search tournaments").fill("African Games");
  const africa = page.locator('[data-event-id="career-african-games-2026"]');
  const guide = africa.getByTestId("tournament-overview");
  await expect(guide.getByTestId("event-host")).toHaveText("Cairo, Egypt");
  await expect(guide).toContainText("national teams");
  await expect(guide).toContainText("4 starters + 0 reserves");
  await expect(guide.getByTestId("registration-window")).toContainText("2025-");
  await guide.screenshot({ path: "artifacts/tournament-guide-africa-en.png" });
  // A late-year tournament is visible now but registration has not opened yet.
  await page
    .getByLabel("Search tournaments")
    .fill("Seven Days Masters · 2026/12");
  const late = page.locator('[data-event-id="rotation-2026-12-1"]');
  await expect(late.getByTestId("tournament-overview")).toContainText(
    "24 players including you",
  );
  await expect(late.getByTestId("tournament-overview")).toContainText(
    "Not open yet",
  );
  await expect(late.getByTestId("register")).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await expect(late.getByTestId("tournament-overview")).toContainText(
    "รับ 24 คน รวมตัวคุณ",
  );
  await expect(late.getByTestId("tournament-overview")).toContainText(
    "ยังไม่เปิดรับสมัคร",
  );
  await late
    .getByTestId("tournament-overview")
    .screenshot({ path: "artifacts/tournament-guide-capacity-th.png" });
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("en");
  await page
    .getByLabel("Search tournaments")
    .fill("FIDE Online Chess Olympiad");
  const online = page.locator('[data-event-id="career-online-olympiad-2026"]');
  await expect(online.getByTestId("event-host")).toHaveText("Online");
  await expect(online).toContainText("no host-country travel");
  await expect(
    online.locator("dt").filter({ hasText: "Travel estimate" }).locator(".."),
  ).toContainText("$0");
});
test("export complete career and NPC world, reject corrupt input and occupied slots, restore independently and reload", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("link", { name: "Career", exact: true }).click();
  const exporting = page.getByRole("button", {
    name: "Export backup",
    exact: true,
  });
  await expect(exporting).toBeEnabled();
  const downloadEvent = page.waitForEvent("download");
  await exporting.click();
  const downloaded = await downloadEvent;
  const raw = await readFile((await downloaded.path())!, "utf8");
  const backup = JSON.parse(raw);
  expect(backup.payload.npcs.length).toBeGreaterThan(4000);
  await page.getByTestId("backup-panel").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/career-backup-export.png" });
  await page
    .getByTestId("backup-panel")
    .getByRole("button", { name: "Your characters", exact: true })
    .click();
  // Corruption must fail without replacing any character.
  const damaged = structuredClone(backup);
  damaged.payload.save.player.money += 1;
  await page
    .getByLabel("Backup file", { exact: true })
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(damaged)),
    });
  await expect(page.getByRole("alert")).toContainText("damaged");
  await expect(page.getByLabel("Character slot 2")).toContainText("Empty slot");
  const input = {
    name: "career.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw),
  };
  await page.getByLabel("Backup file", { exact: true }).setInputFiles(input);
  const modal = page.getByRole("dialog", {
    name: "Restore this career?",
    exact: true,
  });
  await expect(modal).toContainText("Slot 2");
  // Another tab occupies the selected slot after the preview. The transaction must abort.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("keyval", "readwrite");
      const st = tx.objectStore("keyval");
      const r = st.get("chess-career-mode-save-slot-1");
      r.onsuccess = () => st.put(r.result, "chess-career-mode-save-slot-2");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  await modal
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await expect(modal.getByRole("alert")).toContainText("Choose an empty");
  await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("keyval", "readwrite");
      tx.objectStore("keyval").delete("chess-career-mode-save-slot-2");
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.getByLabel("Backup file", { exact: true }).setInputFiles(input);
  await expect(modal).toBeVisible();
  await modal.screenshot({ path: "artifacts/career-backup-import.png" });
  await modal
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await expect(modal).not.toBeVisible();
  const result = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
    });
    const request = <T>(r: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    const tx = db.transaction(["keyval", "careerNpcs"]);
    const st = tx.objectStore("keyval");
    const [one, two, npcs] = await Promise.all([
      request(st.get("chess-career-mode-save-slot-1")),
      request(st.get("chess-career-mode-save-slot-2")),
      request(tx.objectStore("careerNpcs").getAll()),
    ]);
    const source = JSON.parse(one).state.save,
      copy = JSON.parse(two).state.save;
    const copied = npcs
      .filter((n: any) => n.key.startsWith(copy.career.id + "|"))
      .map((n: any) => n.npc)
      .sort((a: any, b: any) => a.id.localeCompare(b.id));
    db.close();
    return { source, copy, copied };
  });
  expect(result.source.career.id).toBe(backup.payload.save.career.id);
  expect(result.copy.career.id).not.toBe(result.source.career.id);
  expect(result.copy.player).toEqual(backup.payload.save.player);
  expect(result.copy.social).toEqual(backup.payload.save.social);
  expect(result.copied).toEqual(
    [...backup.payload.npcs].sort((a, b) => a.id.localeCompare(b.id)),
  );
  await page
    .getByLabel("Character slot 2")
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Open profile for Browser Test Player/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Career", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export backup", exact: true }),
  ).toBeEnabled();
});
