import { expect, test } from "@playwright/test";
import { createCareer } from "./helpers";
import { openSectionTab } from "./navigation";

test("ranks tournaments and changes the displayed currency across screens", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("chess-career-install-hidden", "yes"));
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await openSectionTab(page, "Popularity");
  const ranking = page.getByRole("list", { name: "Tournament popularity ranking" });
  await expect(ranking.getByRole("listitem").first()).toContainText("#1");
  const search = page.getByRole("textbox", { name: "Search tournament popularity" });
  await search.fill("Paul Keres Cup");
  await expect(ranking.getByRole("listitem")).toHaveCount(2);
  await ranking.getByRole("button", { name: /Paul Keres Cup · Spring/ }).click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByText(/Best.of.7 final/i)).toBeVisible();
  await expect(detail.getByText(/3 h · \+30 s after move 50/).first()).toBeVisible();
  await expect(detail.getByText(/^\$[\d,]+$/).first()).toBeVisible();
  await detail.getByRole("button", { name: "Close dialog" }).click();

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("combobox", { name: /^Currency/ }).selectOption("THB");
  await page.getByRole("dialog").getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByRole("img", { name: /^Money: ฿/ })).toBeVisible();
  await ranking.getByRole("button", { name: /Paul Keres Cup · Spring/ }).click();
  await expect(page.getByRole("dialog").getByText(/^฿[\d,]+$/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("img", { name: /^Money: ฿/ })).toBeVisible();
});
