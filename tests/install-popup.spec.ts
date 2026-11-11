import { expect, test } from "@playwright/test";
import { createCareer } from "./helpers";

test("native browser install event is retained on slots and requires the install button", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your characters", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as any).__prompts = 0;
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        (window as any).__prompts++;
      },
      userChoice: new Promise((resolve) => {
        (window as any).__finishInstall = resolve;
      }),
    });
    window.dispatchEvent(event);
  });
  const dialog = page.getByRole("dialog", {
    name: "Install Chess Career Mode",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => (window as any).__prompts)).toBe(0);
  await page.screenshot({ path: "artifacts/install-popup-android-en.png" });
  await dialog
    .getByRole("button", { name: "Install app", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Opening installer…", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() =>
    (window as any).__finishInstall({ outcome: "accepted" }),
  );
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => (window as any).__prompts)).toBe(1);
});

test("later is remembered for seven days; permanent opt out suppresses future automatic popups", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", {
    name: "Install Chess Career Mode",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Not now", exact: true }).click();
  const after = await page.evaluate(() =>
    Number(localStorage.getItem("chess-career-install-after")),
  );
  expect(after - Date.now()).toBeGreaterThan(6.9 * 86400000);
  await page.reload();
  await page.waitForTimeout(5000);
  await expect(dialog).not.toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem("chess-career-install-after", "0"),
  );
  await page.reload();
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Do not show again", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("chess-career-install-hidden"),
    ),
  ).toBe("yes");
  await page.reload();
  await page.waitForTimeout(5000);
  await expect(dialog).not.toBeVisible();
});

test("Thai iPhone instructions appear during playtest on Home and fit a narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1",
    }),
  );
  await createCareer(page);
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await page.getByRole("link", { name: "หน้าหลัก", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "ติดตั้ง Chess Career Mode",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Safari");
  await expect(dialog).toContainText("เพิ่มไปยังหน้าจอโฮม");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "artifacts/install-popup-iphone-th.png" });
  await dialog.getByRole("button", { name: "ไว้ภายหลัง", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "ยินดีต้อนรับ Browser Test Player",
      exact: true,
    }),
  ).toBeVisible();
  const card = page
    .getByRole("heading", { name: "ติดตั้งลงเครื่องนี้", exact: true })
    .locator("..")
    .locator("..");
  await card.getByRole("button", { name: "วิธีติดตั้ง", exact: true }).click();
  await expect(card).toContainText("Safari");
});

test("already installed standalone app never shows the suggestion", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) =>
      query === "(display-mode: standalone)"
        ? Object.assign(original(query), {
            /* navigator fallback below */
          })
        : original(query);
    Object.defineProperty(navigator, "standalone", { value: true });
  });
  await page.goto("/");
  await page.waitForTimeout(5200);
  await expect(
    page.getByRole("dialog", {
      name: "Install Chess Career Mode",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("creation is uninterrupted and an unavailable native prompt falls back to browser instructions", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "New character", exact: true })
    .first()
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("Install Playtest");
  await page.waitForTimeout(5000);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Install Playtest",
  );
  await page
    .getByRole("button", { name: "Back to character slots", exact: true })
    .click();
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        throw new Error("Unavailable");
      },
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    window.dispatchEvent(event);
  });
  const dialog = page.getByRole("dialog", {
    name: "Install Chess Career Mode",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Install app", exact: true })
    .click();
  await expect(dialog).toContainText("Install from your browser");
  await dialog.getByRole("button", { name: "Not now", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});
