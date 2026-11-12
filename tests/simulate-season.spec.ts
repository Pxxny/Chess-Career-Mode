import { continueSeasonUntil } from "./seasonNews";
import { openSectionTab, openCareerManagement } from "./navigation";
import { Chess } from "chess.js";
import { test, expect, type Page } from "@playwright/test";
import { writeFile, readFile } from "node:fs/promises";
async function create(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("chess-career-install-hidden", "yes"),
  );
  await page.addInitScript(() => localStorage.setItem("chess-career-tour-dismissed", "yes"));
  await page.goto("/");
  await page
    .getByRole("button", { name: "New character", exact: true })
    .first()
    .click();
  await page.getByLabel("Full name").fill("Season Playtest");
  await page.getByText("Prefer not to say", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Nationality", exact: true })
    .fill("Thailand");
  await page.getByRole("option", { name: /Thailand/ }).click();
  await page
    .getByRole("combobox", { name: "City", exact: true })
    .fill("Bangkok");
  await page
    .getByRole("option", { name: /^Bangkok/ })
    .first()
    .click();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("radio", { name: "Small", exact: true }).check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Create career", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Home", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
}
async function state(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const req = <T>(r: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    const tx = db.transaction(["keyval", "careerNpcs", "matchArchive"]);
    const [raw, records, archived] = await Promise.all([
      req(tx.objectStore("keyval").get("chess-career-mode-save-slot-1")),
      req(tx.objectStore("careerNpcs").getAll()),
      req(tx.objectStore("matchArchive").getAll()),
    ]);
    db.close();
    return {
      save: JSON.parse(raw).state.save,
      npcs: records.map((r) => r.npc),
      archived: archived.map((r) => r.match),
    };
  });
}
async function start(page: Page) {
  await page
    .getByTestId("simulate-season-panel")
    .getByRole("button", { name: "Simulate Season", exact: true })
    .click();
  const d = page.getByRole("dialog", { name: "Simulate Season", exact: true });
  await d
    .getByRole("button", { name: "Start season simulation", exact: true })
    .click();
}
test("full season records real games, retained replays/openings/clocks/PGN, complete backup and measured times", async ({
  page,
}) => {
  test.setTimeout(600000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await create(page);
  await page
    .getByTestId("simulate-season-panel")
    .getByRole("button", { name: "Simulate Season", exact: true })
    .click();
  const options = page.getByRole("dialog", {
    name: "Simulate Season",
    exact: true,
  });
  await options.getByLabel("Season approach").selectOption("competition");
  await options.screenshot({ path: "artifacts/season-replays-options-en.png" });
  const at = Date.now();
  await options
    .getByRole("button", { name: "Start season simulation", exact: true })
    .click();
  await expect(page.getByTestId("season-progress")).toBeVisible();
  await expect
    .poll(async () => (await state(page)).save.seasonSimulation.games, {
      timeout: 90000,
    })
    .toBeGreaterThanOrEqual(3);
  await page
    .getByRole("dialog", { name: "Simulating season", exact: true })
    .screenshot({ path: "artifacts/season-replays-progress-en.png" });
  await continueSeasonUntil(page, async () => (await state(page)).save.seasonSimulation?.status === "completed");
  await expect(page.getByTestId("season-progress")).toBeHidden();
  const wallMs = Date.now() - at;
  const review = page.getByRole("dialog", {
    name: "2026 · Year in review",
    exact: true,
  });
  await expect(review).toBeVisible();
  await review.screenshot({ path: "artifacts/season-replays-year-review.png" });
  const data = await state(page),
    s = data.save.seasonSimulation;
  expect(s.status).toBe("completed");
  expect(s.days).toBe(364);
  expect(s.games).toBeGreaterThan(60);
  expect(s.sessions).toBeGreaterThan(100);
  expect(s.games).toBe(s.wins + s.draws + s.losses);
  expect(data.save.player.ap.current).toBe(data.save.player.ap.max);
  await expect
    .poll(async () => (await state(page)).archived.length)
    .toBe(s.games);
  const archive = (await state(page)).archived.sort(
    (a: any, b: any) =>
      a.year - b.year ||
      a.week - b.week ||
      (a.day ?? 1) - (b.day ?? 1) ||
      a.id.localeCompare(b.id, undefined, { numeric: true }),
  );
  expect(
    archive.every(
      (m: any) =>
        m.moves.length > 0 &&
        m.recording &&
        m.recording.ucis.length === m.moves.length &&
        m.analysis === null,
    ),
  ).toBe(true);
  const first = archive[0];
  expect(data.save.matches.some((m: any) => m.id === first.id)).toBe(false);
  expect(first.openingName).toBeTruthy();
  const samples = archive
      .map((m: any) => m.recording.wallMs)
      .sort((a: number, b: number) => a - b),
    q = (p: number) => samples[Math.max(0, Math.ceil(p * samples.length) - 1)];
  await writeFile(
    "verification/season-replays/browser-timings.json",
    JSON.stringify(
      {
        environment:
          "Cloud Chromium, Small database, real UI including NPC calendar and storage",
        wallMs,
        persistedTiming: s.timing,
        games: s.games,
        tournaments: s.tournaments,
        totalPlies: archive.reduce(
          (n: number, m: any) => n + m.moves.length,
          0,
        ),
        p50GameMs: q(0.5),
        p95GameMs: q(0.95),
        maxGameMs: samples.at(-1),
        meanGameMs:
          samples.reduce((a: number, b: number) => a + b, 0) / samples.length,
        openings: new Set(archive.map((m: any) => m.openingName)).size,
      },
      null,
      2,
    ) + "\n",
  );
  expect(s.timing.games).toBe(s.games);
  expect(Math.abs(wallMs - s.timing.runMs)).toBeLessThan(wallMs * 0.15 + 3000);
  await review
    .getByRole("button", { name: "Continue to 2027", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Tournament", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await openSectionTab(page, "History");
  await expect(page.getByTestId("archived-match-count")).toContainText(
    String(s.games),
  );
  await page.getByLabel("Match order").selectOption("oldest");
  await page.getByTestId("match-history").getByRole("button").first().click();
  const replay = page.getByTestId("replay");
  await expect(replay).toBeVisible();
  await expect(replay.getByTestId("recorded-game-details")).toContainText(
    first.openingName,
  );
  await expect(replay.getByRole("gridcell")).toHaveCount(64);
  await replay.getByRole("button", { name: "Start", exact: true }).click();
  await replay.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(replay.locator('[data-ply="1"]')).toHaveAttribute(
    "aria-current",
    "true",
  );
  const dl = page.waitForEvent("download");
  await replay
    .getByRole("button", { name: "Download PGN", exact: true })
    .click();
  const pgn = await readFile((await (await dl).path())!, "utf8"),
    chess = new Chess();
  chess.loadPgn(pgn);
  expect(chess.history().length).toBe(first.moves.length);
  expect(chess.fen()).toBe(first.recording.finalFen);
  expect(pgn).toContain("[%clk");
  await replay.screenshot({
    path: "artifacts/season-replays-oldest-match-en.png",
  });
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await replay.screenshot({
    path: "artifacts/season-replays-oldest-match-th.png",
  });
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("en");
  await page.getByRole("link", { name: "Career", exact: true }).click();
  const backupDownload = page.waitForEvent("download");
  await openCareerManagement(page);
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const buffer = await readFile((await (await backupDownload).path())!),
    backup = JSON.parse(buffer.toString("utf8"));
  expect(backup.payload.matchArchive.length).toBe(s.games);
  await page
    .getByRole("button", { name: "Your characters", exact: true })
    .click();
  await page.getByLabel("Backup file").setInputFiles({
    name: "career.json",
    mimeType: "application/json",
    buffer,
  });
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await page
    .getByLabel("Character slot 2")
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Tournament", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await openSectionTab(page, "History");
  await expect(page.getByTestId("archived-match-count")).toContainText(
    String(s.games),
  );
  await page.getByLabel("Match order").selectOption("oldest");
  await page.getByTestId("match-history").getByRole("button").first().click();
  await expect(page.getByTestId("recorded-game-details")).toContainText(
    first.openingName,
  );
  expect(errors).toEqual([]);
});
test("pause, reload, resume, pause again and checksum backup keep the exact checkpoint", async ({
  page,
}) => {
  test.setTimeout(150000);
  await create(page);
  await start(page);
  await expect
    .poll(async () => (await state(page)).save.seasonSimulation?.days ?? 0)
    .toBeGreaterThan(4);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(page.getByTestId("season-progress")).toBeHidden();
  const checkpoint = (await state(page)).save;
  expect(checkpoint.seasonSimulation.status).toBe("paused");
  await page.reload();
  await expect(page.getByTestId("simulate-season-panel")).toBeVisible();
  expect((await state(page)).save.seasonSimulation).toEqual(
    checkpoint.seasonSimulation,
  );
  await page.getByRole("link", { name: "Train", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: /^(Rest day: end day|End day & sleep)$/ })
    .click();
  await expect
    .poll(async () => (await state(page)).save.seasonSimulation.days)
    .toBe(checkpoint.seasonSimulation.days + 1);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page
    .getByRole("button", { name: "Resume season simulation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).save.seasonSimulation.days)
    .toBeGreaterThan(checkpoint.seasonSimulation.days + 1);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(page.getByTestId("season-progress")).toBeHidden();
  await page.getByRole("link", { name: "Career", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await openCareerManagement(page);
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const backup = JSON.parse(
    await readFile((await (await downloading).path())!, "utf8"),
  );
  expect(backup.payload.save.seasonSimulation.status).toBe("paused");
  expect(backup.payload.save.career.playerDatabase).toBe("small");
  expect(
    new Set(backup.payload.save.matches.map((m: any) => m.setup.prediction?.id))
      .size,
  ).toBe(backup.payload.save.matches.length);
});

test("mobile Thai setup and late-season rollover recover exhausted AP and stop after the remaining days", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await create(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("keyval", "readwrite"),
        store = tx.objectStore("keyval"),
        r = store.get("chess-career-mode-save-slot-1");
      r.onsuccess = () => {
        const data = JSON.parse(r.result);
        data.state.save.world.date = { year: 2026, week: 52 };
        data.state.save.world.day = 5;
        data.state.save.player.ap.current = 0;
        data.state.save.training.fatigue = 100;
        store.put(JSON.stringify(data), "chess-career-mode-save-slot-1");
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByTestId("simulate-season-panel")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await page
    .getByTestId("simulate-season-panel")
    .getByRole("button", { name: "จำลองทั้งฤดูกาล", exact: true })
    .click();
  const options = page.getByRole("dialog", {
    name: "จำลองทั้งฤดูกาล",
    exact: true,
  });
  await expect(options).toContainText("ใช้ AP");
  await options.screenshot({
    path: "artifacts/simulate-season-options-th.png",
  });
  expect(
    await options.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await options
    .getByRole("button", { name: "เริ่มจำลองฤดูกาล", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).save.seasonSimulation?.status)
    .toBe("completed");
  const data = await state(page);
  expect(data.save.seasonSimulation.days).toBe(3);
  expect(data.save.world.date.year).toBe(2027);
  expect(data.save.player.ap.current).toBe(data.save.player.ap.max);
  expect(data.save.training.fatigue).toBeLessThan(100);
});
