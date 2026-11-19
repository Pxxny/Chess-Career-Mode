import { expect, type Page, type Locator } from "@playwright/test";

/** Secondary views can be tabs, the desktop selector, or the phone section sheet. */
export async function openSectionTab(scope: Page | Locator, name: string | RegExp) {
  let root: Page | Locator = scope;
  const page = "goto" in scope ? scope : scope.page();
  if (!("goto" in scope) && await scope.getAttribute("role") === "tablist") root = scope.locator("..");
  const tab = scope.getByRole("tab", { name, exact: typeof name === "string" });
  const menus = root.locator("select[data-section-overflow]").filter({ has: page.getByRole("option", { name, exact: typeof name === "string" }) });
  const picker = root.locator("[data-section-picker]:visible").first();
  const visibleTab = tab.filter({ visible: true }).first();
  const visibleMenu = menus.filter({ visible: true }).first();
  await expect(visibleTab.or(visibleMenu).or(picker).first()).toBeVisible();
  if (await visibleTab.isVisible()) { await visibleTab.click(); return; }
  if (await picker.isVisible()) {
    await picker.click();
    await page.locator("[data-section-options]").getByRole("button", {
      name, exact: typeof name === "string",
    }).click();
    return;
  }
  const menu = menus.first();
  const value = await menu.getByRole("option", { name, exact: typeof name === "string" }).first().getAttribute("value");
  await menu.selectOption(value!);
}

export async function openCareerManagement(page: Page) {
  if (await page.getByTestId("backup-panel").isVisible()) return;
  await page.getByText("Save & character management", { exact: true }).click();
  await expect(page.getByTestId("backup-panel")).toBeVisible();
}
