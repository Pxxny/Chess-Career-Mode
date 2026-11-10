import { expect, test, type Page } from "@playwright/test";
import { createCareer } from "./helpers";

const ranks = (page: Page) =>
  page
    .getByRole("tablist", { name: "Ranking scope", exact: true })
    .locator("..");
const fits = async (page: Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();

test("phone rankings show character faces for every NPC and the saved player, stable across scopes and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  const ranking = ranks(page);
  await expect(ranking.locator("[data-npc-portrait]")).toHaveCount(20);
  await expect(ranking.getByText("Real player", { exact: true })).toHaveCount(
    0,
  );
  const portrait = ranking.locator("[data-npc-portrait]").first();
  const id = await portrait.getAttribute("data-npc-portrait");
  const face = await portrait.locator("svg").innerHTML();
  const playerRow = ranking
    .getByRole("row")
    .filter({ hasText: "Browser Test Player" });
  const playerFace = await page
    .getByRole("banner")
    .getByRole("img", { name: "Browser Test Player portrait", exact: true })
    .innerHTML();
  expect(await playerRow.locator("svg").innerHTML()).toBe(playerFace);
  await ranking.evaluate((el) =>
    window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 140),
  );
  await page.screenshot({
    path: "artifacts/npc-portraits-rankings-mobile.png",
  });
  for (const scope of ["National", "City", "World"]) {
    await ranking.getByRole("tab", { name: scope, exact: true }).click();
    expect(
      await ranking.locator("[data-npc-portrait]").count(),
    ).toBeGreaterThan(0);
    expect(await playerRow.locator("svg").innerHTML()).toBe(playerFace);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await fits(page);
    }
  }
  expect(
    await ranking.locator(`[data-npc-portrait="${id}"] svg`).innerHTML(),
  ).toBe(face);
  await page.reload();
  expect(
    await ranks(page).locator(`[data-npc-portrait="${id}"] svg`).innerHTML(),
  ).toBe(face);
  expect(errors).toEqual([]);
});

test("ranking, directory and NPC profile use the same face and preserve name buttons and player appearance", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  const ranking = ranks(page);
  const portrait = ranking.locator("[data-npc-portrait]").first();
  const id = await portrait.getAttribute("data-npc-portrait");
  const face = await portrait.locator("svg").innerHTML();
  const row = ranking
    .getByRole("row")
    .filter({ has: page.locator(`[data-npc-portrait="${id}"]`) });
  const name = (await row.getByRole("button").innerText()).trim();
  await row.getByRole("button", { name, exact: true }).click();
  const profile = page.getByRole("dialog", { name, exact: true });
  await expect(profile).toBeVisible();
  await expect(profile.getByText("Real player", { exact: true })).toHaveCount(
    0,
  );
  expect(
    await profile.locator(`[data-npc-portrait="${id}"] svg`).innerHTML(),
  ).toBe(face);
  await page.screenshot({ path: "artifacts/npc-portrait-profile-mobile.png" });
  await profile
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  await page.getByRole("tab", { name: "Rankings", exact: true }).click();
  await page
    .getByRole("searchbox", {
      name: "Search players by name, city or country",
      exact: true,
    })
    .fill(name);
  const directory = page.getByRole("table", {
    name: "Player directory",
    exact: true,
  });
  expect(
    await directory.locator(`[data-npc-portrait="${id}"] svg`).innerHTML(),
  ).toBe(face);
  await directory.getByRole("button", { name, exact: true }).click();
  expect(
    await profile.locator(`[data-npc-portrait="${id}"] svg`).innerHTML(),
  ).toBe(face);
  await profile
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page
    .getByRole("searchbox", {
      name: "Search players by name, city or country",
      exact: true,
    })
    .fill("Browser Test Player");
  const ownFace = await page
    .getByRole("banner")
    .getByRole("img", { name: "Browser Test Player portrait", exact: true })
    .innerHTML();
  expect(
    await directory
      .getByRole("row")
      .filter({ hasText: "Browser Test Player" })
      .locator("svg")
      .innerHTML(),
  ).toBe(ownFace);
  await fits(page);
});
