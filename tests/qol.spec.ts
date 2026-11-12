import { test, expect, type Page } from "@playwright/test";
import { createCareer } from "./helpers";

async function readState(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      const tx = db.transaction(["keyval", "careerNpcs"]);
      const request = <T>(r: IDBRequest<T>) =>
        new Promise<T>((resolve, reject) => {
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
      const [raw, count] = await Promise.all([
        request(tx.objectStore("keyval").get("chess-career-mode-save-slot-1")),
        request(tx.objectStore("careerNpcs").count()),
      ]);
      return { save: JSON.parse(raw).state.save, count };
    } finally {
      db.close();
    }
  });
}
async function fixture(
  page: Page,
  kind: "history" | "transfer" | "long-event" | "legacy-world",
) {
  await page.evaluate(async (kind) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(
            ["keyval", "careerNpcs", "meta"],
            "readwrite",
          ),
          keyval = tx.objectStore("keyval"),
          r = keyval.get("chess-career-mode-save-slot-1");
        r.onsuccess = () => {
          const state = JSON.parse(r.result),
            s = state.state.save;
          if (kind === "legacy-world") {
            const table = tx.objectStore("careerNpcs"),
              all = table.getAll();
            all.onsuccess = () => {
              for (const row of all.result) {
                if (
                  row.npc.id.startsWith("local-") ||
                  (row.npc.id.startsWith("npc-") &&
                    Number(row.npc.id.slice(4)) > 1200)
                )
                  table.delete(row.key);
                else if (row.npc.id === "npc-0001")
                  table.put({
                    ...row,
                    npc: {
                      ...row.npc,
                      name: "Preserved evolved rival",
                      currentElo: 1741,
                    },
                  });
              }
            };
            const meta = tx.objectStore("meta"),
              m = meta.get(`npc-db:${s.career.id}`);
            m.onsuccess = () =>
              meta.put(
                { ...m.result, fictionalCount: 1200 },
                `npc-db:${s.career.id}`,
              );
          }
          if (kind === "transfer") {
            s.player.rating = 1900;
            s.player.ratedGames = 25;
            s.player.money = 1000;
            s.player.reputation = 10;
            s.registrations = [
              {
                eventId: "transfer-destination-date",
                name: "Open board transfer checkpoint",
                level: "local",
                year: 2026,
                week: 6,
                fieldSize: 32,
                entryFee: 10,
              },
            ];
          }
          if (kind === "long-event")
            s.registrations = [
              {
                eventId: "long-calendar-target",
                name: "Long calendar target",
                level: "local",
                year: 2026,
                week: 50,
                fieldSize: 32,
                entryFee: 10,
              },
            ];
          if (kind === "history") {
            const player = {
              id: null,
              name: s.player.name,
              elo: 1000,
              title: "none",
              countryCode: "TH",
              nationality: "Thai",
              flag: "🇹🇭",
              isPlayer: true,
            };
            const npc = {
              id: "history-rival",
              name: "History Rival",
              elo: 1200,
              title: "none",
              countryCode: "TH",
              nationality: "Thai",
              flag: "🇹🇭",
              isPlayer: false,
            };
            const tc = {
              id: "15+10",
              label: "15+10",
              base: 900,
              increment: 10,
              category: "rapid",
            };
            const players = [
              {
                id: "player",
                name: player.name,
                elo: 1000,
                title: "none",
                countryCode: "TH",
                isPlayer: true,
                points: 1.5,
                opponents: ["history-rival", "history-rival", "history-rival"],
                colors: [1, -1, 1],
              },
              {
                id: npc.id,
                name: npc.name,
                elo: 1200,
                title: "none",
                countryCode: "TH",
                isPlayer: false,
                points: 1.5,
                opponents: ["player", "player", "player"],
                colors: [-1, 1, -1],
              },
            ];
            s.tournament = {
              eventId: "history-event",
              name: "History fixture match",
              level: "local",
              year: 2026,
              week: 1,
              rounds: 3,
              round: 3,
              status: "finished",
              entryFee: 0,
              prizeFund: 0,
              timeControl: tc,
              seed: 1,
              players,
              pairings: [
                [{ white: "player", black: npc.id, result: 1 }],
                [{ white: npc.id, black: "player", result: 0.5 }],
                [{ white: "player", black: npc.id, result: 0 }],
              ],
              finalRank: 1,
              prize: 0,
              details: {
                category: "Invitational Tournaments",
                format: "match",
                location: "Bangkok",
                country: "TH",
                end: { year: 2026, week: 1 },
                rounds: 3,
                timeControl: tc,
                prize: 0,
                prestige: 0,
                provenance: "fictional",
              },
            };
            s.history.games = ["win", "draw", "loss"].map((outcome, i) => ({
              id: `qol-history-${i}`,
              year: 2026,
              week: 1,
              opponentId: npc.id,
              opponentName: npc.name,
              opponentElo: 1200,
              outcome,
              color: i === 1 ? "black" : "white",
              tournamentId: s.tournament.eventId,
              tournamentName: s.tournament.name,
              ratingBefore: 1000,
              ratingAfter: 1000,
              accuracy: 70,
              analyzed: true,
              opening: "Sicilian Defense",
            }));
            s.history.games.push({
              ...s.history.games[0],
              id: "unrelated-opening",
              opening: "French Defense",
              opponentName: "Unrelated game",
            });
            s.matches = s.history.games.slice(0, 3).map((g, i) => ({
              id: `qol-match-${i}`,
              year: 2026,
              week: 1,
              setup: {
                white: i === 1 ? npc : player,
                black: i === 1 ? player : npc,
                playerColor: g.color,
                timeControl: tc,
                rated: true,
                tournament: {
                  id: s.tournament.eventId,
                  name: s.tournament.name,
                  level: "local",
                  round: i + 1,
                  rounds: 3,
                },
                accuracyBonus: 0,
              },
              result: i === 0 ? "white" : i === 1 ? "draw" : "black",
              termination: i === 1 ? "agreement" : "resignation",
              outcome: g.outcome,
              moves: ["e4", "c5", "Nf3", "d6"],
              gameResultId: g.id,
              openingName: "Sicilian Defense",
              openingEco: "B50",
              simulated: false,
              controlLog: [],
              ratingBefore: 1000,
              ratingAfter: 1000,
              analysis: null,
            }));
          }
          keyval.put(JSON.stringify(state), "chess-career-mode-save-slot-1");
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, kind);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Tournament", exact: true }),
  ).toBeVisible();
}

test("QoL: date, work income, abroad/FIDE filters, diverse repertoire and chosen training to the next event", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("home-date")).toContainText("1 January 2026");
  const before = await readState(page);
  expect(before.count).toBe(4162);
  await page
    .getByRole("link", { name: "Work & income →", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Work", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Work · Club assistant", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Earned $30");
  await expect(
    page.getByRole("button", { name: "Work · Club assistant", exact: true }),
  ).toBeDisabled();
  const worked = await readState(page);
  expect(worked.save.player.money).toBe(before.save.player.money + 30);
  expect(worked.save.player.ap.current).toBe(before.save.player.ap.current - 1);
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await page
    .getByLabel("Tournament location", { exact: true })
    .selectOption("abroad");
  await page
    .getByLabel("Tournament source", { exact: true })
    .selectOption("fide");
  await expect(
    page
      .getByTestId("open-events")
      .getByRole("link", { name: /FIDE reference/ })
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/qol-foreign-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByLabel("Tournament source", { exact: true })
    .selectOption("all");
  await page
    .getByLabel("Tournament location", { exact: true })
    .selectOption("home");
  await page.locator('button[data-testid="register"]:enabled').first().click();
  const registered = await readState(page);
  expect(registered.save.registrations).toHaveLength(1);
  await page.getByRole("tab", { name: "Prepare", exact: true }).click();
  await page.getByRole("tab", { name: "Repertoire", exact: true }).click();
  const white = page.getByLabel("Add White repertoire", { exact: true });
  const ecos = await white.locator("option").allTextContents();
  expect(new Set(ecos.slice(1).map((s) => s[0])).size).toBeGreaterThanOrEqual(
    4,
  );
  await page
    .getByLabel("Opening family for Black repertoire", { exact: true })
    .selectOption("King's Indian Defense");
  await expect(
    page
      .getByLabel("Add Black repertoire", { exact: true })
      .locator("option")
      .nth(1),
  ).toContainText(/[DE]\d\d/);
  await page.getByRole("tab", { name: "Tournament", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate until tournament", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Calculation Drills/ }).check();
  await page
    .getByRole("button", { name: "Confirm & simulate", exact: true })
    .click();
  await expect(page.getByTestId("start-event")).toBeVisible();
  const advanced = await readState(page);
  expect(advanced.save.world.date.week).toBe(
    registered.save.registrations[0].week,
  );
  expect(advanced.save.world.day).toBe(
    registered.save.registrations[0].details?.agenda?.exactStart
      ? registered.save.registrations[0].details.agenda.startDay
      : 1,
  );
  expect(advanced.save.history.sessions.length).toBeGreaterThan(
    registered.save.history.sessions.length,
  );
  expect(advanced.save.training.hoursUsedToday).toBe(0);
  expect(advanced.save.player.ap.current).toBe(10);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("link", { name: "Home", exact: true }).click();
  const typography = await page.evaluate(() => ({
    h: getComputedStyle(document.querySelector("h1")!).fontFamily,
    body: getComputedStyle(document.body).fontFamily,
    background: getComputedStyle(document.body).backgroundImage,
  }));
  expect(typography.h).toBe(typography.body);
  expect(typography.background).toBe("none");
  await page.screenshot({
    path: "artifacts/qol-home-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("QoL: favorite opening and tournament player histories scope outcomes and open actual replays", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createCareer(page);
  await fixture(page, "history");
  await page.getByRole("link", { name: /Open profile for/ }).click();
  await page.getByRole("tab", { name: "Stats", exact: true }).click();
  await page
    .getByRole("button", {
      name: "View games with Sicilian Defense",
      exact: true,
    })
    .click();
  const opening = page.getByRole("dialog");
  await expect(
    opening.getByRole("img", { name: "Win", exact: true }),
  ).toHaveCount(1);
  await expect(
    opening.getByRole("img", { name: "Draw", exact: true }),
  ).toHaveCount(1);
  await expect(
    opening.getByRole("img", { name: "Loss", exact: true }),
  ).toHaveCount(1);
  await expect(opening.getByText("Unrelated game")).toHaveCount(0);
  await opening
    .getByRole("button", { name: "Replay game", exact: true })
    .first()
    .click();
  await expect(page.getByTestId("replay")).toBeVisible();
  await expect(page.getByTestId("replay").getByRole("gridcell")).toHaveCount(
    64,
  );
  await opening
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Tournament games for History Rival",
      exact: true,
    })
    .click();
  const npc = page.getByTestId("tournament-player-history");
  expect(
    await npc
      .getByRole("img")
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))),
  ).toEqual(["Loss", "Draw", "Win"]);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Replay game", exact: true })
    .first()
    .click();
  await expect(page.getByTestId("replay")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Tournament games for Browser Test Player",
      exact: true,
    })
    .click();
  expect(
    await page
      .getByTestId("tournament-player-history")
      .getByRole("img")
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))),
  ).toEqual(["Win", "Draw", "Loss"]);
  await page.screenshot({
    path: "artifacts/qol-tournament-history.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("QoL: federation processing, calendar cancellation and additive legacy NPC upgrade persist", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createCareer(page);
  await fixture(page, "legacy-world");
  const migrated = await readState(page);
  expect(migrated.count).toBe(4162);
  const evolved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
    });
    try {
      return await new Promise<{ name: string; currentElo: number }>(
        (resolve) => {
          const r = db
            .transaction("careerNpcs")
            .objectStore("careerNpcs")
            .getAll();
          r.onsuccess = () =>
            resolve(r.result.find((row) => row.npc.id === "npc-0001").npc);
        },
      );
    } finally {
      db.close();
    }
  });
  expect(evolved.name).toBe("Preserved evolved rival");
  expect(evolved.currentElo).toBe(1741);
  await fixture(page, "transfer");
  await page.getByRole("link", { name: /Open profile for/ }).click();
  await page.getByLabel("New federation", { exact: true }).selectOption("VN");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Apply · $250", exact: true }).click();
  await expect(page.getByText(/Application: Vietnam/)).toBeVisible();
  const applied = await readState(page);
  expect(applied.save.player.money).toBe(750);
  expect(applied.save.player.country).toBe("TH");
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate until tournament", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Tactics Puzzle/ }).uncheck();
  await page
    .getByRole("button", { name: "Confirm & simulate", exact: true })
    .click();
  await expect(page.getByTestId("start-event")).toBeVisible();
  const moved = await readState(page);
  expect(moved.save.player.country).toBe("VN");
  expect(moved.save.career.countryCode).toBe("TH");
  expect(moved.save.qol.birthCountry).toBe("TH");
  expect(moved.save.qol.moves).toHaveLength(1);
  expect(moved.count).toBe(4242);
  await fixture(page, "long-event");
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate until tournament", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Tactics Puzzle/ }).uncheck();
  await page
    .getByRole("button", { name: "Confirm & simulate", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stop simulation", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Advancing your calendar", exact: true }),
  ).toHaveCount(0);
  const stopped = await readState(page);
  expect(stopped.save.world.date.week).toBeLessThan(50);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Tournament", exact: true }),
  ).toBeVisible();
  expect((await readState(page)).save.world.date).toEqual(
    stopped.save.world.date,
  );
  expect(errors).toEqual([]);
});
