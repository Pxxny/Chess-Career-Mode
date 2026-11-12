import { test, expect, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
const ru = JSON.parse(
  readFileSync("public/data/cities/RU.json", "utf8"),
) as Array<[string, number]>;
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const capture = {
  style: "header.sticky, nav.fixed { visibility:hidden !important; }",
};
async function start(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("chess-career-install-hidden", "yes"),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "New character", exact: true })
    .first()
    .click();
  await page.getByLabel("Full name").fill("All Cities QA");
  await page.getByText("Prefer not to say", { exact: true }).click();
}
async function country(page: Page, name: string) {
  await page
    .getByRole("combobox", { name: "Nationality", exact: true })
    .fill(name);
  await page
    .getByRole("option", { name: new RegExp(name) })
    .first()
    .click();
  await page.getByRole("combobox", { name: "City", exact: true }).click();
}
async function sweep(page: Page) {
  return page
    .getByRole("listbox", { name: "City", exact: true })
    .evaluate(async (el) => {
      const list = el as HTMLElement,
        seen = new Set<string>();
      let maxRows = 0;
      const frame = () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
      const collect = () => {
        const rows = list.querySelectorAll("[role=option]");
        maxRows = Math.max(maxRows, rows.length);
        rows.forEach((row) =>
          seen.add(row.querySelector(".font-semibold")!.textContent!),
        );
      };
      const max = list.scrollHeight - list.clientHeight;
      for (let top = 0; top < max; top += 512) {
        list.scrollTop = top;
        await frame();
        collect();
      }
      list.scrollTop = max;
      await frame();
      collect();
      return { names: [...seen], maxRows };
    });
}
test("Russia: all 4301 cities reachable by scrolling, every search match retained, keyboard and saved last-city selection work", async ({
  page,
}) => {
  await start(page);
  await country(page, "Russia");
  const city = page.getByRole("combobox", { name: "City", exact: true }),
    list = page.getByRole("listbox", { name: "City", exact: true });
  await expect(list).toHaveAttribute("data-total-options", "4301");
  const complete = await sweep(page);
  expect(new Set(complete.names)).toEqual(new Set(ru.map((r) => r[0])));
  expect(complete.maxRows).toBeLessThanOrEqual(14);
  await list.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "artifacts/all-cities-russia-bottom-en.png",
    ...capture,
  });
  // Broad queries are not truncated at 90, 300, or 500 matches.
  await city.fill("a");
  const expected = ru
    .filter(([name]) => norm(name).includes("a"))
    .map((r) => r[0]);
  await expect(list).toHaveAttribute(
    "data-total-options",
    String(expected.length),
  );
  expect(expected.length).toBeGreaterThan(500);
  const matches = await sweep(page);
  expect(new Set(matches.names)).toEqual(new Set(expected));
  expect(matches.maxRows).toBeLessThanOrEqual(14);
  await city.press("Control+End");
  await expect
    .poll(() => list.getByRole("option").last().getAttribute("aria-posinset"))
    .toBe(String(expected.length));
  const lastMatch = await list
    .getByRole("option")
    .last()
    .locator(".font-semibold")
    .textContent();
  await city.press("Enter");
  await expect(city).toHaveValue(lastMatch!);
  // Clicking a focused input after a selection must reopen the list.
  await city.click();
  await expect(list).toBeVisible();
  await city.press("End");
  await expect
    .poll(() => list.getByRole("option").last().getAttribute("aria-posinset"))
    .toBe("4301");
  await expect(list.getByRole("option").last()).toHaveAttribute(
    "aria-setsize",
    "4301",
  );
  const lastName = await list
    .getByRole("option")
    .last()
    .locator(".font-semibold")
    .textContent();
  await city.press("Home");
  await expect(list.getByRole("option").first()).toHaveAttribute(
    "aria-posinset",
    "1",
  );
  await city.press("PageDown");
  await city.press("PageUp");
  await city.press("End");
  await city.press("Enter");
  await expect(city).toHaveValue(lastName!);
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Create career", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Train", exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open("chess-career-mode");
      q.onsuccess = () => r(q.result);
    });
    const value = await new Promise<any>((r) => {
      const q = db
        .transaction("keyval")
        .objectStore("keyval")
        .get("chess-career-mode-save-slot-1");
      q.onsuccess = () => r(JSON.parse(q.result).state.save);
    });
    db.close();
    return value;
  });
  expect(saved.player.city).toEqual({ name: lastName, custom: false });
  writeFileSync(
    "verification/all-cities/russia-browser-coverage.json",
    JSON.stringify(
      {
        total: ru.length,
        scrollVisited: complete.names.length,
        maxRendered: complete.maxRows,
        query: "a",
        matchCount: expected.length,
        searchVisited: matches.names.length,
        maxSearchRendered: matches.maxRows,
        savedCity: lastName,
      },
      null,
      2,
    ),
  );
});
test.describe("Touch city selection", () => {
  test.use({ hasTouch: true });
  test("mobile: Thai labels, city after index 3000, touch selection, country reset and custom input", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await start(page);
    await country(page, "Russia");
    const city = page.getByRole("combobox", { name: "City", exact: true }),
      list = page.getByRole("listbox", { name: "City", exact: true });
    await expect(list).toHaveAttribute("data-total-options", "4301");
    const distant = ru[3200][0];
    await city.fill(distant);
    await list.getByRole("option").filter({ hasText: distant }).first().tap();
    await expect(city).toHaveValue(distant);
    await country(page, "India");
    await expect(list).toHaveAttribute("data-total-options", "3375");
    await expect(city).toHaveValue("");
    await page
      .getByRole("combobox", { name: "Language / ภาษา", exact: true })
      .selectOption("th");
    const thaiCity = page.getByRole("combobox", { name: "เมือง", exact: true }),
      thaiList = page.getByRole("listbox", { name: "เมือง", exact: true });
    await thaiCity.click();
    await expect(thaiList).toContainText("3,375 เมือง");
    await thaiList.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "artifacts/all-cities-mobile-th.png",
      ...capture,
    });
    await page
      .getByRole("combobox", { name: "Language / ภาษา", exact: true })
      .selectOption("en");
    await country(page, "Vatican");
    await expect(list).toHaveAttribute("data-total-options", "1");
    await list.getByRole("option").first().tap();
    await expect(city).toHaveValue("Vatican City");
    await city.fill("My Custom Chess Town");
    await list
      .getByRole("option", { name: /Use “My Custom Chess Town”/ })
      .tap();
    await expect(city).toHaveValue("My Custom Chess Town");
  });
});
test("USA largest file and a late country response do not truncate or replace the new country list", async ({
  page,
}) => {
  await start(page);
  await country(page, "United States");
  const city = page.getByRole("combobox", { name: "City", exact: true }),
    list = page.getByRole("listbox", { name: "City", exact: true });
  const data = JSON.parse(
    readFileSync("public/data/cities/US.json", "utf8"),
  ) as Array<[string, number]>;
  await expect
    .poll(async () => Number(await list.getAttribute("data-total-options")))
    .toBeGreaterThanOrEqual(data.length);
  await city.press("End");
  await expect(list.getByRole("option").last()).toHaveAttribute(
    "aria-posinset",
    (await list.getAttribute("data-total-options"))!,
  );
  expect(await list.getByRole("option").count()).toBeLessThan(20);
  const tail = data.at(-1)![0];
  await city.fill(tail);
  await expect(
    list.getByRole("option").filter({ hasText: tail }).first(),
  ).toBeVisible();
  let release!: () => void;
  const blocked = new Promise<void>((r) => (release = r));
  await page.route("**/data/cities/RU.json", async (route) => {
    await blocked;
    await route.fulfill({
      path: "public/data/cities/RU.json",
      contentType: "application/json",
    });
  });
  await country(page, "Russia");
  await country(page, "Thailand");
  await expect(list).toHaveAttribute("data-total-options", "955");
  release();
  await page.unrouteAll({ behavior: "wait" });
  await expect(list).toHaveAttribute("data-total-options", "955");
  await expect(list).not.toContainText("Moscow");
});
