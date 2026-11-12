import { test, expect, type Page } from "@playwright/test";
import { writeFile, readFile } from "node:fs/promises";
async function create(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("chess-career-install-hidden", "yes"),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "New character", exact: true })
    .first()
    .click();
  await page.getByLabel("Full name").fill("Season Playtest");
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
  await page.getByRole("radio", { name: "Small", exact: true }).check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Create career", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Home", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
}
async function state(page: Page) {
  return page.evaluate(async () => {
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
    const tx = db.transaction(["keyval", "careerNpcs"]);
    const [raw, records] = await Promise.all([
      req(tx.objectStore("keyval").get("chess-career-mode-save-slot-1")),
      req(tx.objectStore("careerNpcs").getAll()),
    ]);
    db.close();
    return {
      save: JSON.parse(raw).state.save,
      npcs: records.map((r) => r.npc),
    };
  });
}
async function start(page: Page) {
  await page
    .getByTestId("simulate-season-panel")
    .getByRole("button", { name: "Simulate Season", exact: true })
    .click();
  const d = page.getByRole("dialog", { name: "Simulate Season", exact: true });
  await d
    .getByRole("button", { name: "Start season simulation", exact: true })
    .click();
}
test("full year through real UI: automatic training/rest/AP/jobs/entries/games, annual review, NPC history, save and honest result view", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await create(page);
  const initial = (await state(page)).save;
  await page
    .getByTestId("simulate-season-panel")
    .getByRole("button", { name: "Simulate Season", exact: true })
    .click();
  const options = page.getByRole("dialog", {
    name: "Simulate Season",
    exact: true,
  });
  await options.getByLabel("Season approach").selectOption("competition");
  await options.screenshot({
    path: "artifacts/simulate-season-options-en.png",
  });
  await options
    .getByRole("button", { name: "Start season simulation", exact: true })
    .click();
  const live = page.getByTestId("season-progress");
  await expect(live).toBeVisible();
  await expect
    .poll(async () => (await state(page)).save.seasonSimulation?.games ?? 0, {
      timeout: 120000,
    })
    .toBeGreaterThanOrEqual(3);
  await page
    .getByRole("dialog", { name: "Simulating season", exact: true })
    .screenshot({ path: "artifacts/simulate-season-progress-en.png" });
  await expect(live).toBeHidden({ timeout: 180000 });
  const review = page.getByRole("dialog", {
    name: "2026 · Year in review",
    exact: true,
  });
  await expect(review).toBeVisible();
  await review.screenshot({
    path: "artifacts/simulate-season-year-review.png",
  });
  let data = await state(page);
  const s = data.save.seasonSimulation;
  expect(s.status).toBe("completed");
  expect(s.days).toBe(364);
  expect(s.games).toBeGreaterThan(20);
  expect(s.tournaments).toBeGreaterThan(3);
  expect(s.sessions).toBeGreaterThan(100);
  expect(s.games).toBe(s.wins + s.draws + s.losses);
  expect(s.draws).toBeGreaterThan(0);
  expect(data.save.world.date).toEqual({ year: 2027, week: 1 });
  expect(data.save.world.day).toBe(1);
  expect(data.save.player.ap.current).toBe(data.save.player.ap.max);
  expect(data.save.player.money).toBeGreaterThanOrEqual(0);
  expect(data.save.player.ratedGames - initial.player.ratedGames).toBe(s.games);
  expect(
    data.save.matches.every(
      (m: any) =>
        m.setup.simulation === "season" &&
        m.moves.length === 0 &&
        m.analysis === null,
    ),
  ).toBe(true);
  expect(
    data.npcs.some((n: any) =>
      n.tournamentHistory.some((h: any) => h.source === "career"),
    ),
  ).toBe(true);
  await writeFile(
    "verification/simulate-season/browser-year-result.json",
    JSON.stringify(
      {
        season: s,
        yearReview: data.save.yearReview.reviews.find(
          (r: any) => r.year === 2026,
        ),
        npcProfiles: data.npcs.length,
      },
      null,
      2,
    ) + "\n",
  );
  await review
    .getByRole("button", { name: "Continue to 2027", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await page
    .getByTestId("simulate-season-panel")
    .screenshot({ path: "artifacts/simulate-season-summary-th.png" });
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("en");
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  // Individual stored games identify abstract results without inventing a replay board.
  const history = page.locator('[data-testid="match-history"]');
  await history.getByRole("button").first().click();
  await expect(page.getByTestId("season-game-result")).toContainText(
    "No moves or engine analysis were generated.",
  );
  await page
    .getByTestId("season-game-result")
    .screenshot({ path: "artifacts/simulate-season-game-result.png" });
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Career", exact: true }),
  ).toBeVisible();
  data = await state(page);
  expect(data.save.seasonSimulation.status).toBe("completed");
  expect(data.save.seasonSimulation.games).toBe(s.games);
  expect(errors).toEqual([]);
});
test("pause, reload, resume, pause again and checksum backup keep the exact checkpoint", async ({
  page,
}) => {
  test.setTimeout(150000);
  await create(page);
  await start(page);
  await expect
    .poll(async () => (await state(page)).save.seasonSimulation?.days ?? 0)
    .toBeGreaterThan(4);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(page.getByTestId("season-progress")).toBeHidden();
  const checkpoint = (await state(page)).save;
  expect(checkpoint.seasonSimulation.status).toBe("paused");
  await page.reload();
  await expect(page.getByTestId("simulate-season-panel")).toBeVisible();
  expect((await state(page)).save.seasonSimulation).toEqual(
    checkpoint.seasonSimulation,
  );
  await page.getByRole("link", { name: "Train", exact: true }).click();
  await page
    .getByRole("button", { name: /^(Rest day: end day|End day & sleep)$/ })
    .click();
  await expect
    .poll(async () => (await state(page)).save.seasonSimulation.days)
    .toBe(checkpoint.seasonSimulation.days + 1);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page
    .getByRole("button", { name: "Resume season simulation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).save.seasonSimulation.days)
    .toBeGreaterThan(checkpoint.seasonSimulation.days + 1);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(page.getByTestId("season-progress")).toBeHidden();
  await page.getByRole("link", { name: "Career", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const backup = JSON.parse(
    await readFile((await (await downloading).path())!, "utf8"),
  );
  expect(backup.payload.save.seasonSimulation.status).toBe("paused");
  expect(backup.payload.save.career.playerDatabase).toBe("small");
  expect(
    new Set(backup.payload.save.matches.map((m: any) => m.setup.prediction?.id))
      .size,
  ).toBe(backup.payload.save.matches.length);
});

test("mobile Thai setup and late-season rollover recover exhausted AP and stop after the remaining days", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await create(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("keyval", "readwrite"),
        store = tx.objectStore("keyval"),
        r = store.get("chess-career-mode-save-slot-1");
      r.onsuccess = () => {
        const data = JSON.parse(r.result);
        data.state.save.world.date = { year: 2026, week: 52 };
        data.state.save.world.day = 5;
        data.state.save.player.ap.current = 0;
        data.state.save.training.fatigue = 100;
        store.put(JSON.stringify(data), "chess-career-mode-save-slot-1");
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByTestId("simulate-season-panel")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await page
    .getByTestId("simulate-season-panel")
    .getByRole("button", { name: "จำลองทั้งฤดูกาล", exact: true })
    .click();
  const options = page.getByRole("dialog", {
    name: "จำลองทั้งฤดูกาล",
    exact: true,
  });
  await expect(options).toContainText("ใช้ AP");
  await options.screenshot({
    path: "artifacts/simulate-season-options-th.png",
  });
  expect(
    await options.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await options
    .getByRole("button", { name: "เริ่มจำลองฤดูกาล", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).save.seasonSimulation?.status)
    .toBe("completed");
  const data = await state(page);
  expect(data.save.seasonSimulation.days).toBe(3);
  expect(data.save.world.date.year).toBe(2027);
  expect(data.save.player.ap.current).toBe(data.save.player.ap.max);
  expect(data.save.training.fatigue).toBeLessThan(100);
});
