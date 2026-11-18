import { expect, test } from "@playwright/test";
import { createCareer } from "./helpers";

test("career links, history, deep links and unknown routes on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
  const heading = (name: string) => page.getByRole("heading", { name, exact: true, level: 1 });
  await expect(heading("Train")).toBeVisible();

  for (const [label, path, title] of [
    ["Home", "/", "Welcome, Browser Test Player"],
    ["Tournament", "/complete", "Tournament"],
    ["Career", "/career", "Career"],
    ["Open profile for Browser Test Player", "/profile", "Profile"],
  ]) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(heading(title)).toBeVisible();
  }

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("dialog").getByRole("link", { name: /Changelog/ }).click();
  await expect(heading("Changelog")).toBeVisible();
  await page.reload();
  await expect(heading("Changelog")).toBeVisible();
  await page.goBack();
  await expect(heading("Profile")).toBeVisible();
  await page.goForward();
  await expect(heading("Changelog")).toBeVisible();
  await page.goto("/missing-route");
  await expect(page).toHaveURL("/");
  await expect(heading("Welcome, Browser Test Player")).toBeVisible();
});
