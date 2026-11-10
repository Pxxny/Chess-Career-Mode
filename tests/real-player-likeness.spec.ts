import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test("all real-player character likenesses render in the offline preview gallery", async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 820 });
  await page.setContent(readFileSync("artifacts/real-player-portraits.html", "utf8"));
  await expect(page.locator("article")).toHaveCount(82);
  await expect(page.getByRole("img")).toHaveCount(82);
  for (const name of [
    "Magnus Carlsen",
    "Fabiano Caruana",
    "Hikaru Nakamura",
    "Viswanathan Anand",
    "Anish Giri",
    "Maxime Vachier-Lagrave",
    "Hou Yifan",
    "Judit Polgar",
  ])
    await expect(
      page.getByRole("img", { name: `${name} portrait`, exact: true }),
    ).toBeVisible();
  const caruana = await page
    .locator('[data-player="fabiano-caruana"] svg')
    .innerHTML();
  const nakamura = await page
    .locator('[data-player="hikaru-nakamura"] svg')
    .innerHTML();
  const carlsen = await page
    .locator('[data-player="magnus-carlsen"] svg')
    .innerHTML();
  expect(caruana).not.toBe(nakamura);
  expect(caruana).not.toBe(carlsen);
  await page.screenshot({ path: "artifacts/real-player-likeness-preview.png" });
});
