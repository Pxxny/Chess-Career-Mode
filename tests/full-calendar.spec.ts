import { test, expect, type Page } from "@playwright/test";
import { createCareer } from "./helpers";
const capture = {
  style: "header.sticky, nav.fixed { visibility:hidden !important; }",
};
async function database(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open("chess-career-mode");
      q.onsuccess = () => r(q.result);
    });
    const req = <T>(r: IDBRequest<T>) =>
      new Promise<T>((resolve) => {
        r.onsuccess = () => resolve(r.result);
      });
    const tx = db.transaction(["keyval", "careerNpcs", "tournamentArchive"]);
    const [raw, npcs, archives] = await Promise.all([
      req(tx.objectStore("keyval").get("chess-career-mode-save-slot-1")),
      req(tx.objectStore("careerNpcs").getAll()),
      req(tx.objectStore("tournamentArchive").getAll()),
    ]);
    db.close();
    const save = JSON.parse(raw).state.save;
    return {
      save,
      npcs: npcs
        .filter((n: any) => n.key.startsWith(save.career.id + "|"))
        .map((n: any) => n.npc),
      archives: archives
        .filter((n: any) => n.key.startsWith(save.career.id + "|"))
        .map((n: any) => n.event),
    };
  });
}
async function start(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("chess-career-install-hidden", "yes"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
}
async function endDays(page: Page, count: number) {
  await page.getByRole("link", { name: "Train", exact: true }).click();
  for (let i = 0; i < count; i++)
    await page
      .getByRole("button", { name: /Rest day: end day|End day & sleep/ })
      .click();
}
test("history shows all calendar tournaments from day one; national standings include real projected roster names", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await page
    .getByRole("tab", { name: "Tournament history", exact: true })
    .click();
  const history = page.getByTestId("annual-history");
  await expect(history.getByLabel("Tournament results filter")).toHaveValue(
    "all",
  );
  await expect(history.locator("[data-annual-event]")).toHaveCount(20);
  for (const name of [
    "World Cup",
    "Candidates Tournament",
    "National Championship",
    "Open Board Rotation",
  ]) {
    await history.getByLabel("Search annual tournaments").fill(name);
    await expect(history.locator("[data-annual-event]").first()).toContainText(
      name,
    );
  }
  await history.getByLabel("Search annual tournaments").fill("");
  await history
    .getByLabel("Annual tournament category")
    .selectOption("national");
  await expect(history.locator('[data-event-kind="national"]')).toHaveCount(20);
  await expect(history.locator('[data-event-kind="regular"]')).toHaveCount(0);
  await history.screenshot({
    path: "artifacts/all-tournaments-national-en.png",
    ...capture,
  });
  await history.getByLabel("Search annual tournaments").fill("African Games");
  await history
    .locator('[data-annual-event="career-african-games-2026"]')
    .getByRole("button", { name: "View tournament", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("tab", { name: "Standings", exact: true }).click();
  await expect(modal.getByTestId("standing-participant").first()).toBeVisible();
  const roster = modal.locator("details").first();
  await roster.getByText("Team roster", { exact: true }).click();
  await expect(roster.locator("li").first()).toBeVisible();
  await expect(modal).toContainText("Projected national squads");
  await modal.screenshot({
    path: "artifacts/national-standings-roster-en.png",
    ...capture,
  });
  await modal
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await expect(modal).toContainText("รายชื่อสมาชิกทีม");
  await modal.screenshot({
    path: "artifacts/national-standings-roster-th.png",
    ...capture,
  });
  await modal.getByRole("button", { name: "ปิดหน้าต่าง", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("en");
  await history.getByLabel("Annual tournament category").selectOption("all");
  await history.getByLabel("Search annual tournaments").fill("");
  await history
    .getByLabel("Tournament results filter")
    .selectOption("recorded");
  await expect(history).toContainText(
    "No tournament results recorded for this year.",
  );
  await history.getByLabel("Tournament results filter").selectOption("all");
  await history.getByLabel("Tournament year").selectOption("2025");
  await history.getByLabel("Search annual tournaments").fill("World Cup");
  await expect(history.locator("[data-annual-event]").first()).toContainText(
    "Date passed · no recorded result",
  );
  await expect(
    history.getByLabel("Tournament year").locator("option"),
  ).toHaveText(["2025", "2026"]);
});

test("unentered calendar event has entrants and live NPC boards, then real named standings and one NPC history after finishing and reloading", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await page
    .getByRole("tab", { name: "Tournament history", exact: true })
    .click();
  const history = page.getByTestId("annual-history");
  await history
    .getByLabel("Search annual tournaments")
    .fill("Open Board Rotation · 2026/1");
  const row = history.locator('[data-annual-event="rotation-2026-1-0"]');
  await row
    .getByRole("button", { name: "View tournament", exact: true })
    .click();
  let modal = page.getByRole("dialog");
  await modal.getByRole("tab", { name: "Standings", exact: true }).click();
  await expect(modal.getByTestId("standing-participant")).not.toHaveCount(0);
  await expect(modal).toContainText("Announced entrants");
  await modal
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await endDays(page, 3);
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await page
    .getByRole("tab", { name: "Tournament history", exact: true })
    .click();
  await history
    .getByLabel("Search annual tournaments")
    .fill("Open Board Rotation · 2026/1");
  await expect(row).toContainText("In progress");
  await row
    .getByRole("button", { name: "Open tournament / watch games", exact: true })
    .click();
  modal = page.getByRole("dialog");
  await modal.getByRole("tab", { name: "Standings", exact: true }).click();
  await expect(modal.getByTestId("standing-participant")).not.toHaveCount(0);
  await modal
    .getByRole("tab", { name: "Pairings & live boards", exact: true })
    .click();
  await modal
    .getByRole("button", { name: "Watch live board", exact: true })
    .first()
    .click();
  const live = page.getByTestId("live-broadcast");
  await expect
    .poll(async () => Number(await live.getAttribute("data-broadcast-ply")))
    .toBeGreaterThan(1);
  await live
    .getByRole("button", { name: "Pause broadcast", exact: true })
    .click();
  const watching = await database(page);
  expect(watching.save.tournament).toBeNull();
  expect(watching.save.history.games).toHaveLength(0);
  expect(watching.save.history.tournaments).toHaveLength(0);
  expect(watching.save.registrations).toHaveLength(0);
  expect(watching.save.pendingMatch).toBeNull();
  const game = watching.save.calendarTournaments.active.find(
    (t: any) => t.eventId === "rotation-2026-1-0",
  );
  const recorded = game.pairings
    .flat()
    .find((p: any) => p.broadcast?.ucis.length);
  expect(recorded.broadcast.ucis.length).toBeGreaterThan(1);
  await page.setViewportSize({ width: 390, height: 1200 });
  await modal.evaluate((el) => {
    el.scrollTop = 0;
  });
  await modal.screenshot({
    path: "artifacts/calendar-npc-live-en.png",
    ...capture,
  });
  await modal
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await endDays(page, 2);
  await expect
    .poll(async () =>
      (await database(page)).archives.some(
        (r: any) => r.id === "rotation-2026-1-0",
      ),
    )
    .toBe(true);
  const finished = await database(page);
  const result = finished.archives.find(
    (r: any) => r.id === "rotation-2026-1-0",
  );
  expect(result.source).toBe("calendar");
  const partial = result.pairings
    .flat()
    .find(
      (p: any) =>
        p.white === recorded.white && p.black === recorded.black && p.broadcast,
    );
  expect(
    partial.broadcast.ucis.slice(0, recorded.broadcast.ucis.length),
  ).toEqual(recorded.broadcast.ucis);
  for (const participant of result.players)
    expect(
      finished.npcs
        .find((n: any) => n.id === participant.id)
        .tournamentHistory.filter((h: any) => h.eventId === result.id),
    ).toHaveLength(1);
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await page
    .getByRole("tab", { name: "Tournament history", exact: true })
    .click();
  await history
    .getByLabel("Search annual tournaments")
    .fill("Open Board Rotation · 2026/1");
  await expect(row).toContainText("Completed");
  await row
    .getByRole("button", { name: "View tournament", exact: true })
    .click();
  modal = page.getByRole("dialog");
  await modal.getByRole("tab", { name: "Standings", exact: true }).click();
  for (const participant of result.players)
    await expect(
      modal.getByText(participant.name, { exact: true }),
    ).toBeVisible();
  await modal.screenshot({
    path: "artifacts/calendar-completed-standings-en.png",
    ...capture,
  });
  await modal
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await modal.screenshot({
    path: "artifacts/calendar-completed-standings-th.png",
    ...capture,
  });
  await modal.getByRole("button", { name: "ปิดหน้าต่าง", exact: true }).click();
  await history.getByLabel("ค้นหาทัวร์นาเมนต์รายปี").fill("");
  await history.getByLabel("ตัวกรองผลการแข่งขัน").selectOption("recorded");
  await history.screenshot({
    path: "artifacts/all-tournaments-history-th.png",
    ...capture,
  });
  await page.reload();
  const reloaded = await database(page);
  expect(reloaded.archives.find((r: any) => r.id === result.id)).toEqual(
    result,
  );
  expect(reloaded.save.history.games).toHaveLength(0);
  expect(reloaded.save.player.rating).toBe(watching.save.player.rating);
});

test("city selector exposes 62 real places, UK federation datasets, and all available small-country cities", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "New character", exact: true })
    .first()
    .click();
  await page.getByLabel("Full name").fill("City Browser QA");
  await page.getByText("Prefer not to say", { exact: true }).click();
  for (const name of ["Thailand", "England", "Scotland", "Wales"]) {
    await page
      .getByRole("combobox", { name: "Nationality", exact: true })
      .fill(name);
    await page
      .getByRole("option", { name: new RegExp(name) })
      .first()
      .click();
    const city = page.getByRole("combobox", { name: "City", exact: true });
    await city.click();
    await expect(
      page
        .getByRole("listbox", { name: "City", exact: true })
        .getByRole("option"),
    ).toHaveCount(62);
    if (name === "Thailand") {
      await page.getByRole('listbox', { name: 'City', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: "artifacts/more-cities-thailand-en.png",
        ...capture,
      });
      await city.fill("Bangkok");
      await page
        .getByRole("option", { name: /^Bangkok/ })
        .first()
        .click();
    } else
      await page
        .getByRole("listbox", { name: "City", exact: true })
        .getByRole("option")
        .last()
        .click();
  }
  await page
    .getByRole("combobox", { name: "Nationality", exact: true })
    .fill("Vatican");
  await page
    .getByRole("option", { name: /Vatican/ })
    .first()
    .click();
  await page.getByRole("combobox", { name: "City", exact: true }).click();
  await expect
    .poll(async () =>
      page
        .getByRole("listbox", { name: "City", exact: true })
        .getByRole("option")
        .count(),
    )
    .toBeLessThan(50);
  await expect(
    page
      .getByRole("listbox", { name: "City", exact: true })
      .getByRole("option")
      .first(),
  ).toContainText("Vatican");
});
