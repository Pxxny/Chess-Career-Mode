import { expect, test, type Page } from "@playwright/test";

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      const tx = db.transaction(["keyval", "careerNpcs"]);
      const req = <T>(r: IDBRequest<T>) =>
        new Promise<T>((resolve, reject) => {
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
      const [raw, npcs] = await Promise.all([
        req(tx.objectStore("keyval").get("chess-career-mode-save-slot-1")),
        req(tx.objectStore("careerNpcs").getAll()),
      ]);
      return { save: JSON.parse(raw).state.save, npcs };
    } finally {
      db.close();
    }
  });
}

test("expanded look, federation, coaching, team entry guard, tournament entrants and annual population persist", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "New character", exact: true })
    .first()
    .click();
  await page.getByLabel("Full name").fill("Expansion Browser");
  await page.getByText("Female", { exact: true }).click();
  await page.getByRole("combobox", { name: "Nationality" }).fill("Thailand");
  await page.getByRole("option", { name: /Thailand/ }).click();
  await page.getByRole("combobox", { name: "City" }).fill("Bangkok");
  await page
    .getByRole("option", { name: /^Bangkok/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Randomize", exact: true }).click();
  await expect(
    page
      .getByRole("radiogroup", { name: "Facial hair", exact: true })
      .getByRole("radio", { name: "None", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.screenshot({
    path: "artifacts/expansion-look.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  // A burst is intentional: creation must be protected before React rerenders.
  await page
    .getByRole("button", { name: "Create career", exact: true })
    .evaluate((el) => {
      for (let i = 0; i < 20; i++) (el as HTMLButtonElement).click();
    });
  await expect(
    page.getByRole("link", { name: /Open profile for Expansion Browser/ }),
  ).toBeVisible();
  const original = await snapshot(page);
  expect(original.npcs.length).toBe(1282);
  expect(original.save.player.appearance.hairStyle).toMatch(/^female-/);
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  await page.getByText("Federation & national teams", { exact: true }).click();
  await page
    .getByRole("button", { name: "Join federation · $35", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Member this year", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Search federations").fill("Thailand");
  await expect(
    page.getByText(/Thailand Chess Federation/).first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Prepare", exact: true }).click();
  await page.getByText("Coach contracts", { exact: true }).click();
  await page.getByLabel("Coaching contract").selectOption("week");
  await page.getByRole("button", { name: /^Hire Mira Chen/ }).click();
  await expect(page.getByText(/Your coach: Mira Chen/)).toBeVisible();
  expect((await snapshot(page)).save.player.money).toBe(161);
  await page.getByRole("tab", { name: "Tournament", exact: true }).click();
  await page.getByText("Federation & national teams", { exact: true }).click();
  // Selected national players must now enter via the formal registration flow.
  await expect(
    page.getByRole("button", {
      name: "Register in Tournament first",
      exact: true,
    }),
  ).toBeDisabled();
  expect((await snapshot(page)).save.expansion.cups).toHaveLength(0);
  await page.getByRole("tab", { name: "Tournament", exact: true }).click();
  await page.getByTestId("open-events").locator("summary").first().click();
  await expect(
    page
      .getByTestId("open-events")
      .getByText(/Announced invitations/)
      .first(),
  ).toBeVisible();
  await page
    .getByTestId("open-events")
    .locator('button[data-testid="register"]:enabled')
    .first()
    .click();
  const reg = await snapshot(page);
  expect(reg.save.registrations[0].entrantIds.length).toBeGreaterThan(0);
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Open profile for Expansion Browser/ }),
  ).toBeVisible();
  expect((await snapshot(page)).save.expansion.membershipYear).toBe(2026);
  // Test fixture stops one day before New Year; the app itself executes the actual End Day transition.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["keyval", "careerNpcs"], "readwrite"),
        kv = tx.objectStore("keyval"),
        r = kv.get("chess-career-mode-save-slot-1");
      r.onsuccess = () => {
        const item = JSON.parse(r.result);
        item.state.save.world.date = { year: 2026, week: 52 };
        item.state.save.world.day = 7;
        kv.put(JSON.stringify(item), "chess-career-mode-save-slot-1");
        const store = tx.objectStore("careerNpcs"),
          q = store.get(`${item.state.save.career.id}|npc-0001`);
        q.onsuccess = () => {
          const row = q.result;
          row.npc.dateOfBirth = "1962-01-01";
          row.npc.age = 64;
          row.npc.careerStatus = "active";
          store.put(row);
        };
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Train", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Train", exact: true }).click();
  await page
    .getByRole("button", { name: /Rest day: end day|End day & sleep/i })
    .click();
  await expect
    .poll(async () => {
      const s = await snapshot(page);
      return s.npcs.filter((r: any) => r.npc.id.startsWith("recruit-2027-"))
        .length;
    })
    .toBeGreaterThanOrEqual(100);
  const after = await snapshot(page);
  expect(after.save.world.date.year).toBe(2027);
  expect(after.npcs.length - original.npcs.length).toBeLessThanOrEqual(250);
  expect(
    after.npcs.find((r: any) => r.npc.id === "npc-0001").npc.careerStatus,
  ).toBe("retired");
  await page.reload();
  await expect(
    page.getByRole("link", { name: /Open profile for Expansion Browser/ }),
  ).toBeVisible();
  expect((await snapshot(page)).npcs.length).toBe(after.npcs.length);
  await page.getByRole("link", { name: "Complete", exact: true }).click();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(page.getByText(/new players enter the circuit/)).toBeVisible();
  await expect(page.getByText(/wins World Circuit Open/)).toBeVisible();
  await page.screenshot({
    path: "artifacts/expansion-news.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
