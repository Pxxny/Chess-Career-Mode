import { test, expect, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { createCareer } from "./helpers";

async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      return await new Promise<any>((resolve, reject) => {
        const r = db
          .transaction("keyval")
          .objectStore("keyval")
          .get("chess-career-mode-save-slot-1");
        r.onsuccess = () => resolve(JSON.parse(r.result).state.save);
        r.onerror = () => reject(r.error);
      });
    } finally {
      db.close();
    }
  });
}
async function start(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("chess-career-install-hidden", "yes"),
  );
  await createCareer(page);
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
}

test("selected extended editions display larger game counts with safe daily timetables in English and Thai", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  for (const [id, name, games, days] of [
    ["rotation-2026-2-0", "Open Board Rotation · 2026/2", 11, 3],
    ["rotation-2026-3-1", "Seven Days Masters · 2026/3", 23, 7],
    ["rotation-2026-3-2", "Triple Crown Series · 2026/3", 33, 7],
  ] as const) {
    await page.getByLabel("Search tournaments").fill(name);
    const entry = page.locator(`[data-event-id="${id}"]`);
    await expect(entry.getByTestId("tournament-game-count")).toContainText(
      `Up to ${games} scheduled games per player`,
    );
    await entry.getByTestId("daily-timetable").locator("summary").click();
    const rows = entry.getByTestId("daily-timetable").locator("tbody tr");
    await expect(rows).toHaveCount(days);
    let total = 0;
    for (const row of await rows.all())
      total += Number(await row.locator("td").nth(1).textContent());
    expect(total).toBe(games);
    await entry.getByTestId("tournament-game-count").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `artifacts/expanded-tournament-${days}day-${games}games.png`,
    });
  }
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await expect(
    page
      .locator('[data-event-id="rotation-2026-3-2"]')
      .getByTestId("tournament-game-count"),
  ).toContainText("สูงสุด 33 เกมตามตารางต่อผู้เล่น");
  await page
    .locator('[data-event-id="rotation-2026-3-2"]')
    .getByTestId("tournament-game-count")
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/expanded-tournament-thai.png" });
});

test("register and play a human round in a longer tournament, then retain its round count and result after reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page
    .getByLabel("Search tournaments")
    .fill("Open Board Rotation · 2026/2");
  const entry = page.locator('[data-event-id="rotation-2026-2-0"]');
  await entry.getByTestId("register").click();
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
  const initial = await stored(page);
  expect(initial.tournament.players.length).toBeGreaterThan(6);
  expect(initial.tournament.rounds).toBeGreaterThan(5);
  await page.getByTestId("play-round").click();
  await expect(page.getByTestId("match-viewer")).toBeVisible();
  await expect
    .poll(async () => !!(await stored(page)).pendingMatch)
    .toBeTruthy();
  const color = (await stored(page)).pendingMatch.setup.playerColor;
  await expect
    .poll(
      async () => ((await stored(page)).pendingMatch?.ucis.length ?? -1) % 2,
    )
    .toBe(color === "white" ? 0 : 1);
  const pending = (await stored(page)).pendingMatch;
  const board = new Chess();
  for (const u of pending.ucis)
    board.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  const legal = board.moves({ verbose: true });
  const move =
    legal.find((m) => m.from === "e2" && m.to === "e4") ??
    legal.find((m) => m.from === "e7" && m.to === "e5") ??
    legal[0];
  await page.locator(`[data-square="${move.from}"]`).click();
  await page.locator(`[data-square="${move.to}"]`).click();
  await expect
    .poll(async () => (await stored(page)).pendingMatch?.ucis.length ?? 0)
    .toBeGreaterThan(pending.ucis.length);
  await page.getByTestId("match-board").evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  );
  await page.screenshot({
    path: "artifacts/expanded-tournament-live-playtest.png",
  });
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await expect(page.getByTestId("result-banner")).toBeVisible();
  await expect
    .poll(async () => (await stored(page)).tournament.round)
    .toBeGreaterThan(initial.tournament.round);
  const finished = await stored(page);
  expect(finished.history.games.at(-1).tournamentId).toBe("rotation-2026-2-0");
  expect(finished.tournament.rounds).toBe(initial.tournament.rounds);
  await page.reload();
  await expect(page.getByTestId("tournament-game-count").first()).toContainText(
    "Based on actual entrants",
  );
  expect((await stored(page)).tournament.rounds).toBe(
    initial.tournament.rounds,
  );
  await page
    .getByTestId("tournament-game-count")
    .first()
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "artifacts/expanded-tournament-after-round.png",
  });
});
