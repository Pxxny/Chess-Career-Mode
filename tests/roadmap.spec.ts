import { openSectionTab, openCareerManagement } from "./navigation";
import { makeRoadmapFixtures } from "./roadmapFixtures";
import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createCareer } from "./helpers";
test.beforeAll(async () => {
  await makeRoadmapFixtures();
});

async function start(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("chess-career-install-hidden", "yes"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
}
async function saved(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const raw = await new Promise<string>((resolve, reject) => {
      const r = db
        .transaction("keyval")
        .objectStore("keyval")
        .get("chess-career-mode-save-slot-1");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    db.close();
    return JSON.parse(raw).state.save;
  });
}
async function importFixture(page: Page, path: string) {
  await start(page);
  await page.goto("/");
  await page.getByLabel("Backup file", { exact: true }).setInputFiles(path);
  const modal = page.getByRole("dialog", {
    name: "Restore this career?",
    exact: true,
  });
  await expect(modal).toBeVisible();
  await modal
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await expect(modal).not.toBeVisible();
  await page
    .getByLabel("Character slot 1")
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Train", exact: true }),
  ).toBeVisible();
}
test("new career: actual training, visible skill effects, season focus, recommended registration and calendar persist", async ({
  page,
}) => {
  await start(page);
  await createCareer(page);
  const before = await saved(page);
  await page.getByRole("button", { name: "Chess", exact: true }).click();
  await page
    .getByRole("button", { name: "Train: Tactics Puzzle", exact: true })
    .click();
  await openSectionTab(page, "Skill effects");
  await expect(page.getByTestId("skill-effects")).toContainText(
    "Training does not directly add rated Elo.",
  );
  await expect(page.getByTestId("training-changes")).toContainText(
    "Tactics Puzzle",
  );
  expect((await saved(page)).player.rating).toBe(before.player.rating);
  await page
    .getByTestId("skill-effects")
    .screenshot({
      path: "artifacts/roadmap-2-skill-effects-en.png",
      style: "header.sticky, nav.fixed { visibility: hidden !important; }",
    });
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await expect(page.getByTestId("skill-effects")).toContainText(
    "การฝึกส่งผลต่อการเล่นอย่างไร",
  );
  await page
    .getByTestId("skill-effects")
    .screenshot({
      path: "artifacts/roadmap-2-skill-effects-th.png",
      style: "header.sticky, nav.fixed { visibility: hidden !important; }",
    });
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("en");
  await page.getByRole("link", { name: "Career", exact: true }).click();
  await openSectionTab(page, "Season plan");
  await page
    .getByLabel("Annual focus", { exact: true })
    .selectOption("competition");
  await page
    .getByRole("button", { name: "Save annual focus", exact: true })
    .click();
  await expect(page.getByTestId("goal-games")).toContainText("0 / 60");
  await page
    .getByTestId("season-plan")
    .screenshot({
      path: "artifacts/roadmap-3-season-plan-en.png",
      style: "header.sticky, nav.fixed { visibility: hidden !important; }",
    });
  const recommended = page.getByTestId("recommended-events");
  await expect(
    recommended
      .getByRole("link", { name: "View tournament", exact: true })
      .first(),
  ).toBeVisible();
  await recommended
    .getByRole("link", { name: "View tournament", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Tournament", exact: true }),
  ).toBeVisible();
  const reg = page.getByTestId("register");
  await expect(reg).toHaveCount(1);
  await expect(reg).toBeEnabled();
  await reg.click();
  await expect(page.getByTestId("registrations")).toContainText(
    "Simulate until tournament",
  );
  await page.getByRole("link", { name: "Career", exact: true }).click();
  await openSectionTab(page, "Season plan");
  await expect(page.getByTestId("career-calendar")).not.toContainText(
    "No booked tournaments",
  );
  await page.reload();
  expect((await saved(page)).planning.current.focus).toBe("competition");
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await expect(page.getByTestId("season-plan")).toContainText("เป้าหมายรายปี");
  await page
    .getByTestId("season-plan")
    .screenshot({
      path: "artifacts/roadmap-3-season-plan-th.png",
      style: "header.sticky, nav.fixed { visibility: hidden !important; }",
    });
});
test("veteran fixture: championship requirements, a real recorded rivalry and durable shared memories in English and Thai", async ({
  page,
}) => {
  const info = JSON.parse(
    await readFile("/tmp/chess-roadmap-veteran-info.json", "utf8"),
  );
  await importFixture(page, "/tmp/chess-roadmap-veteran-backup.json");
  await page.getByRole("link", { name: "Career", exact: true }).click();
  await openSectionTab(page, "Championship path");
  await expect(page.getByTestId("title-requirements")).toContainText(
    "Peak Elo 2500 + 50 rated games + 3 GM norms",
  );
  await expect(page.getByTestId("title-requirements")).toContainText(
    "Untitled",
  );
  await page
    .getByTestId("championship-path")
    .screenshot({
      path: "artifacts/roadmap-4-championship-en.png",
      style: "header.sticky, nav.fixed { visibility: hidden !important; }",
    });
  await openSectionTab(page, "People & stories");
  await expect(page.getByTestId("people-stories")).toContainText(
    "Emerging rivalry",
  );
  await page
    .getByTestId("people-stories")
    .getByRole("button", { name: info.rivalName, exact: true })
    .click();
  const modal = page.getByRole("dialog", { name: info.rivalName, exact: true });
  await expect(modal.getByTestId("shared-memories")).toContainText(
    "3 rated meetings",
  );
  await expect(modal.getByTestId("shared-memories")).toContainText("You drew");
  await modal
    .getByTestId("shared-memories")
    .screenshot({
      path: "artifacts/roadmap-5-memories-en.png",
      style: "header.sticky, nav.fixed { visibility: hidden !important; }",
    });
  await modal
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await expect(modal.getByTestId("shared-memories")).toContainText(
    "ความทรงจำร่วม",
  );
  await modal
    .getByTestId("shared-memories")
    .screenshot({
      path: "artifacts/roadmap-5-memories-th.png",
      style: "header.sticky, nav.fixed { visibility: hidden !important; }",
    });
  await page.reload();
  expect((await saved(page)).social.relationships[info.rivalId].closeness).toBe(
    0,
  );
  expect((await saved(page)).social.memories).toHaveLength(3);
});
test("veteran due-payment fixture: actual day advancement pays sponsor once, legacy work has costs and weekly cooldown, backups retain state", async ({
  page,
}) => {
  await importFixture(page, "/tmp/chess-roadmap-sponsor-due-backup.json");
  await page.getByRole("link", { name: "Career", exact: true }).click();
  await openSectionTab(page, "Sponsors & legacy");
  await expect(page.getByTestId("sponsorship-panel")).toContainText(
    "Rated games: 6 / 6",
  );
  const before = await saved(page);
  expect(before.world.date.week).toBe(4);
  expect(before.world.day).toBe(7);
  await page.getByRole("link", { name: "Train", exact: true }).click();
  await page
    .getByRole("button", { name: "Rest day: end day", exact: true })
    .click();
  await expect.poll(async () => (await saved(page)).world.date.week).toBe(5);
  const paid = await saved(page);
  expect(paid.player.money).toBe(before.player.money + 40);
  await page.getByRole("link", { name: "Career", exact: true }).click();
  await openSectionTab(page, "Sponsors & legacy");
  await expect(page.getByTestId("sponsorship-panel")).toContainText("Paid $40");
  const legacy = page.getByTestId("legacy-panel");
  await legacy.getByRole("button", { name: "Mentor", exact: true }).click();
  await legacy
    .getByRole("button", { name: "Do weekly legacy activity", exact: true })
    .click();
  await expect(
    legacy.getByRole("button", {
      name: "Do weekly legacy activity",
      exact: true,
    }),
  ).toBeDisabled();
  const worked = await saved(page);
  expect(worked.player.money).toBe(paid.player.money + 40);
  expect(worked.player.ap.current).toBe(paid.player.ap.current - 2);
  expect(worked.training.hoursUsedToday).toBe(2);
  await page
    .getByTestId("career-business")
    .screenshot({
      path: "artifacts/roadmap-6-sponsor-legacy-en.png",
      style: "header.sticky, nav.fixed { visibility: hidden !important; }",
    });
  await page.reload();
  expect((await saved(page)).player.money).toBe(worked.player.money);
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await expect(page.getByTestId("career-business")).toContainText(
    "สัญญาสปอนเซอร์",
  );
  await page
    .getByTestId("career-business")
    .screenshot({
      path: "artifacts/roadmap-6-sponsor-legacy-th.png",
      style: "header.sticky, nav.fixed { visibility: hidden !important; }",
    });
  // Export through the existing UI to verify the new systems are included in a full career backup.
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("en");
  const event = page.waitForEvent("download");
  await openCareerManagement(page);
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const download = await event;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.payload.save.legacy.services).toBe(1);
  expect(backup.payload.save.sponsorship.active.paid).toBe(40);
  expect(backup.payload.npcs.length).toBeGreaterThan(4000);
});
