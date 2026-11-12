import { openSectionTab } from "./navigation";
import { expect, test, type Page } from "@playwright/test";
import { createCareer } from "./helpers";
import { approachNpc } from "../src/game/social/relationships";
import type { GameSave, Npc } from "../src/types";

const preferenceKey = "chess-career-mode-language";
const language = (page: Page) =>
  page.getByRole("combobox", { name: "Language / ภาษา", exact: true }).last();
async function career(page: Page): Promise<{ save: GameSave; npcs: Npc[] }> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const read = <T>(r: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    const tx = db.transaction(["keyval", "careerNpcs"]);
    const [raw, rows] = await Promise.all([
      read(tx.objectStore("keyval").get("chess-career-mode-save-slot-1")),
      read(tx.objectStore("careerNpcs").getAll()),
    ]);
    db.close();
    const save = JSON.parse(raw).state.save;
    return {
      save,
      npcs: rows
        .filter((r) => r.key.startsWith(`${save.career.id}|`))
        .map((r) => r.npc),
    };
  });
}
async function updateCareer(page: Page, save: GameSave) {
  await page.evaluate(async (save) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("keyval", "readwrite"),
        store = tx.objectStore("keyval"),
        r = store.get("chess-career-mode-save-slot-1");
      r.onsuccess = () => {
        const value = JSON.parse(r.result);
        value.state.save = save;
        store.put(JSON.stringify(value), "chess-career-mode-save-slot-1");
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, save);
  await page.reload();
}
const noOverflow = async (page: Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();

test("English is the default even in a Thai browser; preference persists and synchronizes across tabs", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "th-TH" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your characters", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(language(page)).toHaveValue("en");
  await page.evaluate((key) => localStorage.setItem(key, "fr"), preferenceKey);
  await page.reload();
  await expect(language(page)).toHaveValue("en");
  await language(page).selectOption("th");
  await expect(
    page.getByRole("heading", { name: "ตัวละครของคุณ", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "th");
  await page.reload();
  await expect(language(page)).toHaveValue("th");
  const other = await context.newPage();
  await other.goto("/");
  await expect(language(other)).toHaveValue("th");
  await language(other).selectOption("en");
  await expect(language(page)).toHaveValue("en");
  await expect(
    page.getByRole("heading", { name: "Your characters", exact: true }),
  ).toBeVisible();
  await context.close();
});

test("Thai character creation searches both languages, retains input through a live switch and saves canonical identities", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await language(page).selectOption("th");
  await page
    .getByRole("button", { name: "สร้างตัวละคร", exact: true })
    .first()
    .click();
  await page.getByLabel("ชื่อและนามสกุล", { exact: true }).fill("Train");
  await page.getByLabel("เดือนเกิด", { exact: true }).selectOption("7");
  await page.getByText("ไม่ต้องการระบุ", { exact: true }).click();
  const nationality = page.getByRole("combobox", {
    name: "สัญชาติ",
    exact: true,
  });
  await nationality.fill("ไทย");
  await page
    .getByRole("listbox", { name: "สัญชาติ", exact: true })
    .getByRole("option", { name: /^ไทย/ })
    .click();
  await expect(nationality).toHaveValue("🇹🇭 ไทย");
  await page
    .getByRole("combobox", { name: "เมือง", exact: true })
    .fill("Bangkok");
  await page
    .getByRole("option", { name: /^Bangkok/ })
    .first()
    .click();
  await language(page).selectOption("en");
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Train",
  );
  await expect(page.getByLabel("Birth month", { exact: true })).toHaveValue(
    "7",
  );
  await expect(
    page.getByRole("combobox", { name: "Nationality", exact: true }),
  ).toHaveValue("🇹🇭 Thailand");
  await expect(
    page.getByRole("combobox", { name: "City", exact: true }),
  ).toHaveValue("Bangkok");
  await language(page).selectOption("th");
  await page
    .getByRole("combobox", { name: "สัญชาติ", exact: true })
    .fill("Thailand");
  await page
    .getByRole("listbox", { name: "สัญชาติ", exact: true })
    .getByRole("option", { name: /^ไทย/ })
    .click();
  await expect(
    page.getByRole("combobox", { name: "เมือง", exact: true }),
  ).toHaveValue("Bangkok");
  for (let i = 0; i < 4; i++) {
    await noOverflow(page);
    await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  }
  await expect(page.getByText("Train", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/language-thai-create-mobile.png" });
  await page.getByRole("button", { name: "เริ่มอาชีพ", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "ฝึกซ้อม", exact: true }),
  ).toBeVisible();
  const { save } = await career(page);
  expect(save.player.name).toBe("Train");
  expect(save.player.country).toBe("TH");
  expect(save.player.city.name).toBe("Bangkok");
  expect(save.player.gender).toBe("undisclosed");
  expect(save.player.dateOfBirth.slice(5, 7)).toBe("07");
  await page.reload();
  await expect(language(page)).toHaveValue("th");
  await expect(
    page.getByRole("link", { name: "ฝึกซ้อม", exact: true }),
  ).toBeVisible();
});

test("existing careers, navigation and an open player profile switch live without changing the save", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await createCareer(page);
  const initial = (await career(page)).save;
  await updateCareer(page, {
    ...initial,
    player: { ...initial.player, name: "Train", money: 999999999 },
  });
  await expect(
    page.getByRole("link", { name: "Train", exact: true }),
  ).toBeVisible();
  const before = (await career(page)).save;
  await language(page).selectOption("th");
  await expect(
    page.getByRole("link", { name: "ฝึกซ้อม", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.getByRole("link", { name: "หน้าหลัก", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ยินดีต้อนรับ Train", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("home-date")).toContainText("สัปดาห์");
  await expect(page.getByTestId("home-date")).toContainText(
    String(before.world.date.year),
  );
  await expect(page.getByTestId("home-date")).not.toContainText("Week");
  await language(page).selectOption("en");
  await expect(page.getByTestId("home-date")).toContainText("Week");
  await language(page).selectOption("th");
  await page.getByRole("link", { name: "ทัวร์นาเมนต์", exact: true }).click();
  await openSectionTab(page, "อันดับ");
  await page
    .getByRole("searchbox", {
      name: "ค้นหาผู้เล่นด้วยชื่อ เมือง หรือประเทศ",
      exact: true,
    })
    .fill("ไทย");
  await expect(
    page
      .getByRole("table", { name: "ทำเนียบผู้เล่น", exact: true })
      .getByRole("cell", { name: "ไทย", exact: true })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("searchbox", {
      name: "ค้นหาผู้เล่นด้วยชื่อ เมือง หรือประเทศ",
      exact: true,
    })
    .fill("Train");
  await page
    .getByRole("button", { name: "เปิดโปรไฟล์ของคุณในทำเนียบ", exact: true })
    .click();
  const profile = page.getByRole("dialog", { name: "Train", exact: true });
  await expect(profile).toBeVisible();
  await expect(profile).toContainText("Elo ปัจจุบัน");
  await expect(profile).toContainText("สถานที่เกิด");
  await expect(profile).toContainText("ประวัติทัวร์นาเมนต์");
  await expect(profile).toContainText("Bangkok");
  await expect(profile).toContainText("Train");
  await language(page).selectOption("en");
  await expect(profile).toContainText("Current Elo");
  await language(page).selectOption("th");
  expect(
    await profile.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBeTruthy();
  await page.screenshot({ path: "artifacts/language-thai-profile-320.png" });
  await page.getByRole("button", { name: "ปิดหน้าต่าง", exact: true }).click();
  await page.getByRole("link", { name: "เส้นทางอาชีพ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "เส้นทางอาชีพ", exact: true }),
  ).toBeVisible();
  expect((await career(page)).save).toEqual(before);
  await page.reload();
  await expect(language(page)).toHaveValue("th");
  expect((await career(page)).save).toEqual(before);
  await noOverflow(page);
});

test("NPC actions and a running friendly board retain their state when switching languages", async ({
  page,
}) => {
  await createCareer(page);
  const { save, npcs } = await career(page);
  const npc = npcs.find(
    (n) =>
      n.careerStatus === "active" &&
      n.currentElo < 1500 &&
      (() => {
        const r = approachNpc(save, n, "play");
        return r.ok && r.accepted;
      })(),
  )!;
  expect(npc).toBeTruthy();
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await openSectionTab(page, "Rankings");
  await page
    .getByRole("searchbox", {
      name: "Search players by name, city or country",
      exact: true,
    })
    .fill(npc.name);
  await page
    .getByRole("table", { name: "Player directory", exact: true })
    .getByRole("button", { name: npc.name, exact: true })
    .click();
  const profile = page.getByRole("dialog", { name: npc.name, exact: true });
  await language(page).selectOption("th");
  await expect(profile).toContainText("ความสนิท 0/100");
  await expect(profile).toContainText("ความคุ้นเคย 0/100");
  await profile.getByRole("button", { name: "กิจกรรม", exact: true }).click();
  await profile.getByRole("button", { name: /^ชวนเล่นกระชับมิตร/ }).click();
  await page
    .getByRole("button", { name: "เริ่มเกมกระชับมิตร", exact: true })
    .click();
  const game = page.getByRole("dialog", {
    name: `เกมกระชับมิตร · ${npc.name}`,
    exact: true,
  });
  await expect(game.getByTestId("match-viewer")).toBeVisible();
  await game.locator('[data-square="e2"]').click();
  await game.locator('[data-square="e4"]').click();
  await expect
    .poll(async () => (await career(page)).save.pendingMatch?.ucis.length ?? 0)
    .toBeGreaterThanOrEqual(2);
  const before = (await career(page)).save;
  await language(page).selectOption("en");
  await expect(
    page
      .getByRole("dialog", { name: `Friendly game · ${npc.name}`, exact: true })
      .getByTestId("match-viewer"),
  ).toBeVisible();
  expect((await career(page)).save).toEqual(before);
  await language(page).selectOption("th");
  await expect(game.getByTestId("match-viewer")).toBeVisible();
  expect((await career(page)).save.pendingMatch?.ucis).toEqual(
    before.pendingMatch?.ucis,
  );
  await page.screenshot({ path: "artifacts/language-thai-friendly-game.png" });
});

test("blocked preference storage keeps English default and allows an in-session Thai selection", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalGet = Storage.prototype.getItem,
      originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === "chess-career-mode-language")
        throw new DOMException("Blocked", "SecurityError");
      return originalGet.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "chess-career-mode-language")
        throw new DOMException("Blocked", "SecurityError");
      return originalSet.call(this, key, value);
    };
  });
  await page.goto("/");
  await expect(language(page)).toHaveValue("en");
  await language(page).selectOption("th");
  await expect(
    page.getByRole("heading", { name: "ตัวละครของคุณ", exact: true }),
  ).toBeVisible();
});
