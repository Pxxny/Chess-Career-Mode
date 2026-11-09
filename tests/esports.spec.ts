import { test, expect, type Page } from "@playwright/test";
import { createCareer } from "./helpers";
import { getSchedule } from "../src/game/world/schedule";
import { registrationIssue } from "../src/game/competition/eligibility";
import { gameDay, bookedStart } from "../src/game/competition/agenda";

async function stored(page: Page, patch?: Record<string, unknown>) {
  return page.evaluate(async (patch) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      const tx = db.transaction("keyval", patch ? "readwrite" : "readonly"),
        table = tx.objectStore("keyval");
      const state = await new Promise<any>((resolve, reject) => {
        const r = table.get("chess-career-mode-save-slot-1");
        r.onsuccess = () => resolve(JSON.parse(r.result));
        r.onerror = () => reject(r.error);
      });
      if (patch) {
        Object.assign(state.state.save, patch);
        table.put(JSON.stringify(state), "chess-career-mode-save-slot-1");
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return state.state.save;
    } finally {
      db.close();
    }
  }, patch);
}
async function esports(page: Page) {
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  await page.getByRole("button", { name: "Esports", exact: true }).click();
  await expect(page.getByTestId("esports-panel")).toBeVisible();
}
async function simulateToEntry(
  page: Page,
  entry: ReturnType<Page["getByTestId"]>,
) {
  await entry
    .getByRole("button", { name: "Simulate until tournament", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: /Plan the days before/ });
  for (const c of await dialog.getByRole("checkbox").all()) await c.uncheck();
  await dialog
    .getByRole("button", { name: "Confirm & simulate", exact: true })
    .click();
  await expect(
    entry.getByRole("button", { name: "Date reached", exact: true }),
  ).toBeVisible({ timeout: 45000 });
}
test("Official/Unofficial finder, rotating 3/7-day schedules and exact-day registration", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createCareer(page);
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  await page
    .getByRole("button", { name: "Find suitable tournaments", exact: true })
    .click();
  let finder = page.getByRole("dialog", { name: "Find a suitable tournament" });
  await finder.getByLabel("Starts within (weeks)").fill("52");
  await finder.getByLabel("Minimum entry Elo up to").fill("3500");
  await finder
    .getByLabel("Organizer status", { exact: true })
    .selectOption("Official");
  await finder.getByLabel("Tournament duration").selectOption("7");
  await finder.getByLabel("Tournament pairing").selectOption("rotation");
  await finder.getByLabel("Only events I can enter now").uncheck();
  await finder
    .getByRole("button", { name: "Find tournaments", exact: true })
    .click();
  const events = page.getByTestId("open-events");
  await expect(events).toContainText("Seven Days Masters");
  await expect(events).not.toContainText("career simulation)");
  await events
    .getByTestId("daily-timetable")
    .first()
    .locator("summary")
    .click();
  await expect(
    events.getByTestId("daily-timetable").first().locator("tbody tr"),
  ).toHaveCount(7);
  await page
    .getByRole("button", { name: "Find suitable tournaments", exact: true })
    .click();
  finder = page.getByRole("dialog", { name: "Find a suitable tournament" });
  await finder
    .getByLabel("Organizer status", { exact: true })
    .selectOption("Unofficial");
  await finder.getByLabel("Tournament pairing").selectOption("bo3");
  await finder
    .getByRole("button", { name: "Find tournaments", exact: true })
    .click();
  await expect(events).toContainText("Triple Crown Series");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/esports-rotation-finder-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Clear finder", exact: true }).click();
  const save = await stored(page),
    schedule = getSchedule(
      save.world.date,
      {
        city: "Bangkok",
        countryCode: "TH",
        demonym: "Thai",
        continent: "Asia",
      },
      save.career.id,
      52,
    );
  const event = schedule.find(
    (e) => e.details?.agenda?.days === 3 && registrationIssue(save, e) === null,
  )!;
  expect(event).toBeTruthy();
  await page.getByLabel("Search tournaments").fill(event.name);
  await events.getByTestId("register").first().click();
  await simulateToEntry(
    page,
    page.getByTestId("registrations").locator(":scope > li").first(),
  );
  expect(gameDay(await stored(page))).toBe(bookedStart(event));
  await page.getByTestId("start-event").click();
  await expect(page.getByTestId("tournament-day-clock")).toBeVisible();
  await expect(page.getByTestId("daily-timetable").first()).toContainText(
    "3 days",
  );
  expect(errors).toEqual([]);
});

test("Free Agent qualifier: real game, separate progression, reload and once-only team results", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createCareer(page);
  await esports(page);
  await page.getByLabel("Primary career focus").selectOption("esports");
  await page.getByLabel("Esports tier").selectOption("D");
  await page.getByLabel("Esports cadence").selectOption("Qualifier");
  await page.getByLabel("Only esports events I can enter now").check();
  await page
    .locator('button[data-testid="register-esports"]:enabled')
    .first()
    .click();
  const before = await stored(page);
  expect(before.esports.entries).toHaveLength(1);
  expect(before.registrations).toHaveLength(0);
  expect(before.tournament).toBeNull();
  await simulateToEntry(
    page,
    page.getByTestId("esports-bookings").locator(":scope > div").first(),
  );
  await page
    .getByRole("button", { name: "Start esports tournament", exact: true })
    .click();
  await expect(page.getByTestId("esports-standings")).toBeVisible();
  await page
    .getByRole("button", { name: "Simulate esports game", exact: true })
    .click();
  await expect(page.getByTestId("esports-day-clock")).toBeVisible();
  await expect(
    page.getByTestId("move-list").locator('button[data-ply="2"]'),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Take control of my side", exact: true })
    .click();
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await expect(page.getByTestId("result-banner")).toBeVisible();
  let save = await stored(page);
  expect(save.esports.active.round).toBe(2);
  expect(save.history.games).toHaveLength(1);
  expect(save.matches[0].setup.esports.eventId).toBe(
    before.esports.entries[0].event.id,
  );
  expect(save.tournament).toBeNull();
  await page.reload();
  await page.getByRole("button", { name: "Esports", exact: true }).click();
  save = await stored(page);
  expect(save.esports.active.round).toBe(2);
  expect(save.history.games).toHaveLength(1);
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Simulate esports game", exact: true })
      .click();
    await expect(
      page.getByTestId("move-list").locator('button[data-ply="2"]'),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Take control of my side", exact: true })
      .click();
    await page.getByRole("button", { name: "Resign", exact: true }).click();
    await expect(page.getByTestId("result-banner")).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }
  save = await stored(page);
  expect(save.esports.history).toHaveLength(1);
  expect(save.esports.active.status).toBe("finished");
  expect(save.history.games).toHaveLength(3);
  expect(save.esports.active.playerPrize).toBe(
    Math.floor(save.esports.active.teamPrize / save.esports.active.event.size),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/esports-results-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Esports history", exact: true })
    .click();
  await expect(page.getByTestId("esports-panel")).toContainText(
    before.esports.entries[0].event.name,
  );
  expect(errors).toEqual([]);
});

test("create a Trio, recruit with refusals/cooldown, persist focus, and keep both circuits accessible", async ({
  page,
}) => {
  await createCareer(page);
  await esports(page);
  await page.getByLabel("Primary career focus").selectOption("mixed");
  await page.getByRole("button", { name: "My team", exact: true }).click();
  await page.getByLabel("Esports team name").fill("Mobile Knights");
  await page.getByLabel("Create team format").selectOption("3");
  await page
    .getByRole("button", { name: "Create team · $100", exact: true })
    .click();
  expect((await stored(page)).player.money).toBe(150);
  for (
    let i = 0;
    i < 30 && (await stored(page)).esports.team.members.length < 3;
    i++
  ) {
    const invites = page.getByRole("button", { name: /^Invite / });
    if (!(await invites.count())) {
      await page
        .getByRole("button", { name: "Show more recruits", exact: true })
        .click();
      continue;
    }
    await invites.first().click();
    const message = await page.getByRole("status").first().textContent();
    expect(message).toMatch(/accepted|declined/);
  }
  let save = await stored(page);
  expect(save.esports.team.members).toHaveLength(3);
  expect(save.esports.team.size).toBe(3);
  expect(save.esports.recruitAttempts.some((a: any) => a.accepted)).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Esports", exact: true }).click();
  await page.getByRole("button", { name: "My team", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mobile Knights", exact: true }),
  ).toBeVisible();
  expect((await stored(page)).esports.team.members).toHaveLength(3);
  await page
    .getByRole("button", { name: "Chess tournaments", exact: true })
    .click();
  await expect(page.getByTestId("tournament-panel")).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(
    page.getByText("Career focus · Both circuits", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Open Esports Circuit", exact: true })
    .click();
  await expect(page.getByTestId("esports-panel")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "My team", exact: true }).click();
  await page.screenshot({
    path: "artifacts/esports-team-mobile.png",
    fullPage: true,
  });
});
