import { expect, type Page, type Locator } from "@playwright/test";

/** Secondary views may be pinned tabs or choices in the compact section selector. */
export async function openSectionTab(scope: Page | Locator, name: string | RegExp) {
  let root: Page | Locator = scope;
  const page = "goto" in scope ? scope : scope.page();
  if (!("goto" in scope) && await scope.getAttribute("role") === "tablist") root = scope.locator("..");
  const tab = scope.getByRole("tab", { name, exact: typeof name === "string" });
  const menus = root.locator("select[data-section-overflow]").filter({ has: page.getByRole("option", { name, exact: typeof name === "string" }) });
  await expect(tab.or(menus).first()).toBeVisible();
  if (await tab.count() && await tab.first().isVisible()) { await tab.first().click(); return; }
  const menu = menus.first();
  const value = await menu.getByRole("option", { name, exact: typeof name === "string" }).first().getAttribute("value");
  await menu.selectOption(value!);
}

export async function openCareerManagement(page: Page) {
  if (await page.getByTestId("backup-panel").isVisible()) return;
  await page.getByText("Save & character management", { exact: true }).click();
  await expect(page.getByTestId("backup-panel")).toBeVisible();
}
