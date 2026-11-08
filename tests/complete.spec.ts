import { test, expect, type Page } from "@playwright/test";
import { createCareer } from "./helpers";

async function stored(page: Page, advance = false) {
  return page.evaluate(async (advance) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("chess-career-mode");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      const tx = db.transaction("keyval", advance ? "readwrite" : "readonly");
      const store = tx.objectStore("keyval");
      const raw = await new Promise<string>((resolve, reject) => {
        const r = store.get("chess-career-mode-save-slot-1");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const state = JSON.parse(raw);
      if (advance) {
        const reg = state.state.save.registrations[0];
        state.state.save.world.date = { year: reg.year, week: reg.week };
        store.put(JSON.stringify(state), "chess-career-mode-save-slot-1");
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return state.state.save;
    } finally {
      db.close();
    }
  }, advance);
}

test("Complete: six menus, registration, paid plan/repertoire/scout, reload and a real Swiss round on mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  const tabs = page.getByRole("tablist", { name: "Complete sections" });
  await expect(tabs.getByRole("tab")).toHaveText([
    "Tournament",
    "Swiss",
    "Prepare",
    "Rankings",
    "League",
    "History",
  ]);
  const before = await stored(page);
  await page
    .locator('button[data-testid="register"]:enabled')
    .first()
    .evaluate((el) => {
      for (let i = 0; i < 20; i++) (el as HTMLButtonElement).click();
    });
  await expect(
    page.getByTestId("registrations").locator(":scope > li"),
  ).toHaveCount(1);
  const paid = await stored(page);
  expect(paid.registrations).toHaveLength(1);
  expect(paid.player.money).toBe(
    before.player.money - paid.registrations[0].entryFee,
  );
  await tabs.getByRole("tab", { name: "Prepare", exact: true }).click();
  await page.getByRole("tab", { name: "Game Plan", exact: true }).click();
  await page
    .getByRole("button", { name: "All Out Attacks", exact: true })
    .click();
  await page.getByRole("button", { name: "Think Deeply", exact: true }).click();
  await page.getByRole("switch", { name: "Accept Early Draw" }).check();
  await page.getByRole("tab", { name: "Repertoire", exact: true }).click();
  await page.getByLabel("Search preparation openings").fill("Italian");
  const white = page.getByLabel("Add White repertoire", { exact: true });
  await white.selectOption(
    (await white.locator("option").nth(1).getAttribute("value")) as string,
  );
  await page.getByLabel("Search preparation openings").fill("Sicilian");
  const black = page.getByLabel("Add Response to 1.e4", { exact: true });
  await black.selectOption(
    (await black.locator("option").nth(1).getAttribute("value")) as string,
  );
  await page.getByRole("tab", { name: "Preparation", exact: true }).click();
  await page
    .getByRole("button", { name: "Prepare for tournament", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Preparation completed");
  const prepared = await stored(page);
  expect(prepared.player.ap.current).toBe(paid.player.ap.current - 3);
  expect(prepared.player.money).toBe(paid.player.money - 40);
  expect(prepared.training.hoursUsedToday).toBe(3);
  expect(prepared.competition.prepared.repertoire.white).toHaveLength(1);
  expect(prepared.competition.prepared.repertoire["vs-e4"]).toHaveLength(1);
  await page.getByRole("tab", { name: "Scout Opponent", exact: true }).click();
  await page.getByRole("button", { name: /Investigate opponent/ }).click();
  await expect(
    page.getByText("Report available", { exact: true }),
  ).toBeVisible();
  const scouted = await stored(page);
  expect(scouted.player.ap.current).toBe(prepared.player.ap.current - 1);
  expect(scouted.training.hoursUsedToday).toBe(4);
  expect(scouted.competition.scouts).toHaveLength(1);
  await page.reload();
  await page.getByRole("tab", { name: "Prepare", exact: true }).click();
  await expect(
    page.getByText("Prepared snapshot available", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Game Plan", exact: true }).click();
  await page.screenshot({
    path: "artifacts/complete-prepare-mobile.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("button", { name: "All Out Attacks", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("switch", { name: "Accept Early Draw" }),
  ).toBeChecked();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await stored(page, true); // Fixture advances to the paid event week; no resource/rating overrides.
  await page.reload();
  await page.getByTestId("start-event").click();
  await expect(page.getByTestId("standings")).toBeVisible();
  await page.getByRole("tab", { name: "Swiss", exact: true }).click();
  await expect(
    page.getByText("Pairings & history", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/complete-swiss.png",
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Simulate (take control any time)",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("match-viewer")).toBeVisible();
  await expect(
    page.getByTestId("move-list").locator('button[data-ply="2"]'),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Take control of my side", exact: true })
    .click();
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await expect(page.getByTestId("result-banner")).toBeVisible();
  const finished = await stored(page);
  expect(finished.tournament.round).toBeGreaterThan(1);
  expect(finished.matches).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("2024 Candidates uses verified dates and venue while career rules are labelled as simulated", async ({
  page,
}) => {
  await createCareer(page, 2024);
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  await page
    .getByLabel("Tournament category", { exact: true })
    .selectOption("Candidates Tournament");
  const events = page.getByTestId("open-events");
  await expect(
    events.getByText("2024-04-03 (W14)", { exact: true }),
  ).toBeVisible();
  await expect(
    events.getByText("2024-04-23 (W17)", { exact: true }),
  ).toBeVisible();
  await expect(
    events.getByText("Toronto, Canada", { exact: true }),
  ).toBeVisible();
  await expect(
    events.getByText("Verified dates & format · career simulation", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    events.getByRole("link", {
      name: "Historical date / format source · FIDE",
    }),
  ).toHaveAttribute("href", /fide.com/);
  await expect(
    events.getByRole("button", { name: "Not eligible", exact: true }),
  ).toBeDisabled();
});

test("national team participation requires registration and consumes the entry once", async ({
  page,
}) => {
  await createCareer(page);
  // Fixture grants selection credentials; registration, roster snapshot and team play use production actions.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("keyval", "readwrite"),
          store = tx.objectStore("keyval"),
          r = store.get("chess-career-mode-save-slot-1");
        r.onsuccess = () => {
          const state = JSON.parse(r.result),
            s = state.state.save;
          s.player.rating = 3000;
          s.player.peakRating = 3000;
          s.player.reputation = 100;
          s.player.league = "legendary";
          s.expansion.membershipYear = s.world.date.year;
          store.put(JSON.stringify(state), "chess-career-mode-save-slot-1");
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  await page.reload();
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  await page.getByText("Federation & national teams", { exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Register in Tournament first",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByLabel("Tournament category", { exact: true })
    .selectOption("Chess Olympiad");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  const entry = await stored(page);
  expect(entry.registrations).toHaveLength(1);
  expect(entry.registrations[0].entrantIds.length).toBeGreaterThan(0);
  await stored(page, true);
  await page.reload();
  await page
    .getByRole("button", { name: "Play national teams event", exact: true })
    .click();
  const done = await stored(page);
  expect(done.registrations).toHaveLength(0);
  expect(done.expansion.cups).toHaveLength(1);
  expect(done.expansion.cups[0].represented).toBe(true);
  expect(done.player.ap.current).toBe(entry.player.ap.current - 2);
  await page.getByText("Federation & national teams", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cup finished this year", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Final standings", { exact: true }),
  ).toBeVisible();
});
