import { openSectionTab } from "./navigation";
import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { createCareer } from "./helpers";
import { applyFinishedMatch } from "../src/game/match/aftermath";
import { getBaseOpeningDatabase } from "../src/game/openings/database";
import type { GameSave, MatchRecord, MatchSide } from "../src/types";
test("archived-only game: cancellation, actual engine analysis, persisted accuracy, and opening-history replay", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() =>
    localStorage.setItem("chess-career-install-hidden", "yes"),
  );
  await createCareer(page);
  const save: GameSave = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
    });
    const raw = await new Promise<string>((resolve) => {
      const r = db
        .transaction("keyval")
        .objectStore("keyval")
        .get("chess-career-mode-save-slot-1");
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    return JSON.parse(raw).state.save;
  });
  // A known legal four-ply mate keeps the full-analysis UI test small. The full-season test validates generated games separately.
  const white: MatchSide = {
      id: null,
      name: save.player.name,
      elo: save.player.rating,
      title: "none",
      countryCode: "TH",
      nationality: "Thai",
      flag: "🇹🇭",
      isPlayer: true,
    },
    black = {
      ...white,
      id: "qa-opponent",
      name: "Archive Analysis Opponent",
      isPlayer: false,
    };
  const result = applyFinishedMatch(
    save,
    {
      setup: {
        simulation: "season",
        white,
        black,
        playerColor: "white",
        timeControl: {
          id: "qa-rapid",
          label: "10 min + 5 s",
          base: 600,
          increment: 5,
          category: "rapid",
        },
        rated: true,
        tournament: null,
        accuracyBonus: 0,
      },
      result: "black",
      termination: "checkmate",
      moves: ["f3", "e5", "g4", "Qh4#"],
      ucis: ["f2f3", "e7e5", "g2g4", "d8h4"],
      controlLog: [],
      playerMoved: false,
    },
    getBaseOpeningDatabase(),
  );
  const record: MatchRecord = { ...result.record!, id: "qa-archive-analysis" };
  const fixture = { ...result.save, matches: [], matchArchivePending: [] };
  await page.evaluate(
    async ({ save, record }) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open("chess-career-mode");
        r.onsuccess = () => resolve(r.result);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["keyval", "matchArchive"], "readwrite");
        tx.objectStore("keyval").put(
          JSON.stringify({ state: { save }, version: save.version }),
          "chess-career-mode-save-slot-1",
        );
        tx.objectStore("matchArchive").put({
          key: save.career.id + "|" + record.id,
          match: record,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { save: fixture, record },
  );
  await page.goto("/complete");
  await openSectionTab(page, "History");
  await page.getByTestId("match-history").getByRole("button").first().click();
  const replay = page.getByTestId("replay");
  await expect(replay).toBeVisible();
  await replay
    .getByRole("button", { name: "Analyze saved game", exact: true })
    .click();
  await replay
    .getByRole("button", { name: "Cancel analysis", exact: true })
    .click();
  await expect(
    replay.getByRole("button", { name: "Analyze saved game", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  const at = Date.now();
  await replay
    .getByRole("button", { name: "Analyze saved game", exact: true })
    .click();
  await expect(
    replay.getByRole("button", { name: "Cancel analysis", exact: true }),
  ).toBeHidden({ timeout: 90000 });
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
    });
    const rows = await new Promise<any[]>((resolve) => {
      const r = db
        .transaction("matchArchive")
        .objectStore("matchArchive")
        .getAll();
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    return rows.find((r) => r.match.id === "qa-archive-analysis").match;
  });
  expect(stored.analysis.moves.length).toBe(4);
  expect(stored.analysis.evals.length).toBe(5);
  expect(stored.analysis.whiteAccuracy).toBeGreaterThanOrEqual(0);
  expect(stored.analysis.whiteAccuracy).toBeLessThanOrEqual(100);
  await writeFile(
    "verification/season-replays/analysis-timings.json",
    JSON.stringify(
      {
        fixture: "Known legal four-ply checkmate, archived-only record",
        wallMs: Date.now() - at,
        engine: stored.analysis.engine,
        moves: stored.analysis.moves.length,
      },
      null,
      2,
    ) + "\n",
  );
  await page.reload();
  await openSectionTab(page, "History");
  await page.getByTestId("match-history").getByRole("button").first().click();
  await expect(
    page.getByRole("button", { name: "Analyze saved game", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: /Open profile for/ }).click();
  await openSectionTab(page, "Stats");
  await page
    .getByRole("button", {
      name: "View games with " + record.openingName,
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Replay game", exact: true })
    .first()
    .click();
  await expect(dialog.getByTestId("replay")).toBeVisible();
  await expect(dialog.getByRole("gridcell")).toHaveCount(64);
  await expect(dialog.getByTestId("recorded-game-details")).toContainText(
    record.openingName!,
  );
});

test("fresh recorded season game has working clocks and clean English/Thai replay screenshots on mobile", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() =>
    localStorage.setItem("chess-career-install-hidden", "yes"),
  );
  await createCareer(page);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate Season", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start season simulation", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve) => {
            const r = indexedDB.open("chess-career-mode");
            r.onsuccess = () => resolve(r.result);
          });
          const raw = await new Promise<string>((resolve) => {
            const r = db
              .transaction("keyval")
              .objectStore("keyval")
              .get("chess-career-mode-save-slot-1");
            r.onsuccess = () => resolve(r.result);
          });
          db.close();
          return JSON.parse(raw).state.save.seasonSimulation.games;
        }),
      { timeout: 45000 },
    )
    .toBeGreaterThanOrEqual(1);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(page.getByTestId("season-progress")).toBeHidden({
    timeout: 30000,
  });
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await openSectionTab(page, "History");
  await page.getByLabel("Match order").selectOption("oldest");
  await page.getByTestId("match-history").getByRole("button").first().click();
  const replay = page.getByTestId("replay");
  await expect(replay.getByTestId("player-white")).not.toContainText("∞");
  await expect(replay.getByTestId("player-black")).not.toContainText("∞");
  await replay.getByRole("button", { name: "Start", exact: true }).click();
  await replay.getByRole("button", { name: "Next move", exact: true }).click();
  await replay.screenshot({
    path: "artifacts/season-replays-clean-match-en.png",
    style: "header.sticky,nav.fixed {visibility:hidden!important}",
  });
  await page
    .getByRole("combobox", { name: "Language / ภาษา", exact: true })
    .selectOption("th");
  await page.setViewportSize({ width: 430, height: 932 });
  await replay.screenshot({
    path: "artifacts/season-replays-clean-match-th-mobile.png",
    style: "header.sticky,nav.fixed {visibility:hidden!important}",
  });
  expect(
    await replay.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await expect(
    replay.getByRole("button", { name: "ดาวน์โหลด PGN", exact: true }),
  ).toBeVisible();
});
