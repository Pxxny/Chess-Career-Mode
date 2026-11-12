import { openSectionTab, openCareerManagement } from "./navigation";
import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function yearStep(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "New character", exact: true })
    .first()
    .click();
  await page.getByLabel("Full name").fill("Database Playtest");
  await page.getByText("Prefer not to say", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Nationality", exact: true })
    .fill("Thailand");
  await page.getByRole("option", { name: /Thailand/ }).click();
  await page
    .getByRole("combobox", { name: "City", exact: true })
    .fill("Bangkok");
  await page
    .getByRole("option", { name: /^Bangkok/ })
    .first()
    .click();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
}
async function state(page: Page, slot = 1) {
  return page.evaluate(async (slot) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const req = <T>(r: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    const tx = db.transaction(["keyval", "careerNpcs", "meta"]);
    const [raw, records, metas] = await Promise.all([
      req(tx.objectStore("keyval").get(`chess-career-mode-save-slot-${slot}`)),
      req(tx.objectStore("careerNpcs").getAll()),
      req(tx.objectStore("meta").getAll()),
    ]);
    db.close();
    const save = JSON.parse(raw).state.save;
    const npcs = records
      .filter((r) => r.key.startsWith(save.career.id + "|"))
      .map((r) => r.npc);
    const home = npcs.filter((n) => n.id.startsWith("domestic-"));
    return {
      career: save.career,
      count: npcs.length,
      fictional: npcs.filter((n) => n.kind === "fictional").length,
      real: npcs.filter((n) => n.kind === "real").length,
      homeCountries: [...new Set(home.map((n) => n.nationality))],
      homeCities: new Set(home.map((n) => n.city)).size,
      meta: metas.find((m) => m.careerId === save.career.id),
      magnus: npcs.find((n) => n.name === "Magnus Carlsen"),
    };
  }, slot);
}
async function finish(page: Page) {
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Create career", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Train", exact: true }),
  ).toBeVisible({ timeout: 90000 });
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("chess-career-install-hidden", "yes"),
  );
});
test("Small selection, real Worker generation, domestic pool, stable reload and backup", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let workers = 0;
  page.on("worker", () => workers++);
  await yearStep(page);
  await expect(
    page.getByRole("radio", { name: "Large", exact: true }),
  ).toBeChecked();
  const panel = page.getByTestId("player-database-choice");
  for (const label of [
    "Small",
    "Medium",
    "Large",
    "Extra Large",
    "Real Player",
  ])
    await expect(
      panel.getByRole("radio", { name: label, exact: true }),
    ).toBeVisible();
  await page.getByRole("radio", { name: "Small", exact: true }).check();
  await expect(panel).toContainText("912");
  await expect(panel.getByTestId("creation-estimate")).toContainText("1–8 s");
  await panel.screenshot({
    path: "artifacts/player-database-selection-en.png",
  });
  await finish(page);
  expect(workers).toBeGreaterThan(0);
  let s = await state(page);
  expect(s.count).toBe(912);
  expect(s.career.playerDatabase).toBe("small");
  expect(s.meta.fictionalCount).toBe(750);
  expect(s.homeCountries).toEqual(["TH"]);
  expect(s.homeCities).toBeGreaterThan(10);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Train", exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await state(page)).count).toBe(912);
  await page.getByRole("link", { name: "Career", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await openCareerManagement(page);
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const backupBytes = await readFile((await (await downloading).path())!);
  const backup = JSON.parse(backupBytes.toString("utf8"));
  expect(backup.payload.save.career.playerDatabase).toBe("small");
  expect(backup.payload.npcs.length).toBe(912);
  await page.getByRole("link", { name: /Open profile/ }).click();
  await page
    .getByRole("button", { name: "Switch or create character", exact: true })
    .click();
  await page.getByLabel("Backup file").setInputFiles({
    name: "small-backup.json",
    mimeType: "application/json",
    buffer: backupBytes,
  });
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await page
    .getByLabel("Character slot 2")
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Train", exact: true }),
  ).toBeVisible();
  expect((await state(page, 2)).count).toBe(912);
  expect((await state(page, 2)).career.playerDatabase).toBe("small");
  expect((await state(page, 1)).count).toBe(912);
  expect(errors).toEqual([]);
});
test("Extra Large responsive creation progress, counts, learned estimate and Thai choice screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await yearStep(page);
  await page.getByRole("radio", { name: "Extra Large", exact: true }).check();
  await expect(page.getByTestId("player-database-choice")).toContainText(
    "15,162",
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page
    .getByRole("button", { name: "Create career", exact: true })
    .click();
  const progress = page.getByTestId("creation-progress");
  await expect(progress).toBeVisible();
  for (const step of await page
    .getByRole("navigation", { name: "Character creation steps" })
    .getByRole("button")
    .all())
    await expect(step).toBeDisabled();
  await progress.screenshot({
    path: "artifacts/player-database-creation-progress.png",
  });
  await expect(
    page.getByRole("link", { name: "Train", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const s = await state(page);
  expect(s.count).toBe(15162);
  expect(s.meta.fictionalCount).toBe(15000);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("chess-career-creation-times-v1")!).get,
    ),
  ).toBeUndefined();
  const timings = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("chess-career-creation-times-v1")!)[
        "extra-large"
      ],
  );
  expect(timings[0]).toBeGreaterThan(0);
  await page.getByRole("link", { name: /Open profile/ }).click();
  await page
    .getByRole("button", { name: "Switch or create character", exact: true })
    .click();
  await yearStep(page);
  await page.getByRole("radio", { name: "Extra Large", exact: true }).check();
  await expect(page.getByTestId("player-database-choice")).toContainText(
    "Based on previous creations on this device.",
  );
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await expect(page.getByTestId("player-database-choice")).toContainText(
    "เวลาสร้างโดยประมาณ",
  );
  await page
    .getByTestId("player-database-choice")
    .screenshot({ path: "artifacts/player-database-selection-th.png" });
  expect((await state(page)).count).toBe(15162);
});
test("Real FIDE roster stays real after reload and displays source/date/year-only data", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await yearStep(page);
  await page.getByRole("radio", { name: "Real Player", exact: true }).check();
  await expect(page.getByTestId("player-database-choice")).toContainText(
    "20,000",
  );
  await expect(page.getByTestId("player-database-choice")).toContainText(
    "2026-11-11",
  );
  await finish(page);
  let s = await state(page);
  expect(s.count).toBe(20000);
  expect(s.real).toBe(20000);
  expect(s.fictional).toBe(0);
  expect(s.magnus.currentElo).toBe(2823);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Tournament", exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await state(page)).count).toBe(20000);
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await openSectionTab(page, "Rankings");
  await page
    .getByRole("searchbox", {
      name: "Search players by name, city or country",
      exact: true,
    })
    .fill("Magnus Carlsen");
  await page
    .getByRole("button", { name: "Magnus Carlsen", exact: true })
    .click();
  const profile = page.getByRole("dialog", {
    name: "Magnus Carlsen",
    exact: true,
  });
  await expect(profile).toContainText("FIDE snapshot: 2026-11-11");
  await expect(profile).toContainText("1990 · Year only");
  await expect(profile).toContainText("2823");
  await profile.screenshot({
    path: "artifacts/player-database-real-profile.png",
  });
  expect(errors).toEqual([]);
});
test("historical Real Player creation uses historical real identities without current FIDE roster", async ({
  page,
}) => {
  await yearStep(page);
  await page.getByLabel(/Or enter any year/).fill("2025");
  await page.getByRole("radio", { name: "Real Player", exact: true }).check();
  await expect(page.getByTestId("player-database-choice")).toContainText(
    "82 historical",
  );
  await finish(page);
  const s = await state(page);
  expect(s.count).toBe(82);
  expect(s.real).toBe(0);
  expect(s.fictional).toBe(0);
  expect(s.meta.fictionalCount).toBe(0);
});

test("different database sizes coexist in separate character slots and survive switching", async ({
  page,
}) => {
  await yearStep(page);
  await page.getByRole("radio", { name: "Small", exact: true }).check();
  await finish(page);
  const first = (await state(page)).career;
  await page.getByRole("link", { name: /Open profile/ }).click();
  await page
    .getByRole("button", { name: "Switch or create character", exact: true })
    .click();
  await yearStep(page);
  await page.getByRole("radio", { name: "Medium", exact: true }).check();
  await finish(page);
  expect((await state(page, 2)).count).toBe(2162);
  expect((await state(page, 2)).career.playerDatabase).toBe("medium");
  expect((await state(page, 1)).count).toBe(912);
  expect((await state(page, 1)).career.id).toBe(first.id);
  await page.getByRole("link", { name: /Open profile/ }).click();
  await page
    .getByRole("button", { name: "Switch or create character", exact: true })
    .click();
  await page
    .getByLabel("Character slot 1")
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Train", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Train", exact: true }),
  ).toBeVisible();
  expect((await state(page, 1)).count).toBe(912);
  expect((await state(page, 2)).count).toBe(2162);
});
