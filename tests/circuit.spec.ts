import { test, expect, devices, type Page } from "@playwright/test";
import { createCareer } from "./helpers";
import { getSchedule } from "../src/game/world/schedule";
import { registrationCount } from "../src/game/competition/entries";
import { stampIndex, stampFromIndex } from "../src/game/competition/catalog";

async function saveState(page: Page, patch?: Record<string, unknown>) {
  return page.evaluate(async (patch) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      const tx = db.transaction("keyval", patch ? "readwrite" : "readonly"),
        table = tx.objectStore("keyval");
      const state = await new Promise<any>((resolve, reject) => {
        const r = table.get("chess-career-mode-save-slot-1");
        r.onsuccess = () => resolve(JSON.parse(r.result));
        r.onerror = () => reject(r.error);
      });
      if (patch) {
        Object.assign(state.state.save, patch);
        table.put(JSON.stringify(state), "chess-career-mode-save-slot-1");
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return state.state.save;
    } finally {
      db.close();
    }
  }, patch);
}
async function complete(page: Page) {
  await page.getByRole("link", { name: "Complete", exact: true }).click();
}

test("birth place: independent country/town in creation, confirmation, profile and reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "New character", exact: true })
    .first()
    .click();
  await page.getByLabel("Full name").fill("Birth Place QA");
  await page.getByText("Male", { exact: true }).click();
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
  await page.getByLabel("Same as my home city and country").uncheck();
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Birth country", exact: true })
    .fill("Japan");
  await page.getByRole("option", { name: /Japan/ }).click();
  await page.getByLabel("Birth city / town").fill("Kyoto");
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Kyoto, Japan", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Create career", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Open profile for Birth Place QA", exact: true })
    .click();
  await expect(page.getByText("Kyoto, Japan", { exact: true })).toBeVisible();
  expect((await saveState(page)).player.birthPlace).toEqual({
    countryCode: "JP",
    city: "Kyoto",
    source: "chosen",
  });
  await page.reload();
  await expect(page.getByText("Kyoto, Japan", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "artifacts/circuit-birthplace-mobile.png",
    fullPage: true,
  });
});

test("tournament finder, official organizer, real full state and invitation-only acceptance survive reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createCareer(page);
  const base = await saveState(page);
  const schedule = getSchedule(
    base.world.date,
    { city: "Bangkok", countryCode: "TH", demonym: "Thai", continent: "Asia" },
    base.career.id,
    52,
  );
  const fullEvent = schedule.find((e) => {
    const close = (stampIndex(e.registrationDeadline) + 1) * 7 - 1;
    const s = {
      ...base,
      world: {
        ...base.world,
        date: stampFromIndex(Math.floor((close - 2) / 7)),
        day: ((close - 2) % 7) + 1,
      },
    };
    return (
      e.level === "local" &&
      e.fieldSize === 32 &&
      e.minElo === 0 &&
      e.details?.country === "TH" &&
      close > stampIndex(base.world.date) * 7 + 3 &&
      registrationCount(s, e) === e.fieldSize
    );
  })!;
  expect(fullEvent).toBeTruthy();
  const close = (stampIndex(fullEvent.registrationDeadline) + 1) * 7 - 1;
  await saveState(page, {
    world: {
      ...base.world,
      date: stampFromIndex(Math.floor((close - 2) / 7)),
      day: ((close - 2) % 7) + 1,
    },
  });
  await page.reload();
  await complete(page);
  await page.getByLabel("Search tournaments").fill(fullEvent.name);
  const card = page.locator(`[data-event-id="${fullEvent.id}"]`);
  await expect(card.getByTestId("entry-count")).toContainText(
    "32 / 32 registered",
  );
  await expect(card.getByTestId("register")).toBeDisabled();
  await card.locator("summary").filter({ hasText: "NPC entrants" }).click();
  await expect(card.locator("details li")).toHaveCount(32);
  await page.reload();
  await page.getByLabel("Search tournaments").fill(fullEvent.name);
  await expect(card.getByTestId("register")).toBeDisabled();
  expect((await saveState(page)).player.money).toBe(base.player.money);

  await page
    .getByRole("button", { name: "Find suitable tournaments", exact: true })
    .click();
  const finder = page.getByRole("dialog", {
    name: "Find a suitable tournament",
  });
  await finder.getByLabel("Starts within (weeks)").fill("52");
  await finder.getByLabel("Minimum entry Elo up to").fill("3000");
  await finder.getByLabel("Tournament continent").selectOption("Asia");
  await finder.getByLabel("Participant limit from").fill("16");
  await finder.getByLabel("Participant limit up to").fill("64");
  await finder.getByLabel("Only events I can enter now").uncheck();
  await finder
    .getByRole("button", { name: "Find tournaments", exact: true })
    .click();
  await expect(page.getByText(/matching tournaments/)).toBeVisible();
  const facts = await page
    .getByTestId("open-events")
    .locator(":scope > li")
    .allTextContents();
  expect(facts.length).toBeGreaterThan(0);
  expect(
    facts.every(
      (t) =>
        t.includes("Organizer") &&
        t.includes("Organization") &&
        /Official|Unofficial/.test(t),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Clear finder", exact: true }).click();
  await page
    .getByLabel("Tournament category")
    .selectOption("Invitational Showmatches");
  await expect(
    page.getByTestId("open-events").getByTestId("register").first(),
  ).toBeDisabled();
  await expect(page.getByTestId("open-events")).toContainText(
    "Invitation only",
  );
  const invited = {
    ...base.player,
    age: 20,
    dateOfBirth: "2005-06-15",
    rating: 3500,
    peakRating: 3500,
    money: 100000,
  };
  await saveState(page, { world: base.world, player: invited });
  await page.reload();
  await page
    .getByLabel("Tournament category")
    .selectOption("Invitational Showmatches");
  await page
    .getByRole("button", { name: "Accept invitation", exact: true })
    .first()
    .click();
  await expect(
    page.getByTestId("registrations").locator(":scope > li"),
  ).toHaveCount(1);
  const accepted = await saveState(page);
  expect(accepted.registrations[0].invitationAccepted).toBe(true);
  expect(accepted.registrations[0].details.rounds).toBe(10);
  expect(new Set(accepted.registrations[0].entrantIds).size).toBe(
    accepted.registrations[0].entrantIds.length,
  );
  await page.reload();
  await expect(page.getByTestId("registrations")).toContainText(
    "Next Generation Nations Showcase",
  );
  await page.screenshot({
    path: "artifacts/circuit-showcase.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("analysis board: ?? and !! highlight the selected move, clear at start and use local SVG pieces", async ({
  page,
}) => {
  await createCareer(page);
  const s = await saveState(page);
  // Synthetic labels isolate marker rendering; real review classification is covered by test:match.
  const side = {
    name: "Marker QA",
    elo: 1200,
    title: "none",
    countryCode: "TH",
    nationality: "Thai",
    flag: "🇹🇭",
    isPlayer: true,
    id: null,
  };
  const moves = ["e4", "e5", "Nf3", "Nc6"];
  const labels = ["blunder", "good", "brilliant", "good"];
  const reviews = moves.map((san, i) => ({
    ply: i + 1,
    color: i % 2 ? "black" : "white",
    san,
    uci: ["e2e4", "e7e5", "g1f3", "b8c6"][i],
    label: labels[i],
    loss: i === 0 ? 30 : 0,
    evalBefore: 0,
    evalAfter: 0,
    mateAfter: null,
    bestSan: san,
    bestUci: null,
    accuracy: 80,
    line: [],
    gap: 10,
    sacrifice: i === 2,
    only: false,
  }));
  await saveState(page, {
    matches: [
      {
        id: "marker-fixture",
        year: 2026,
        week: 1,
        setup: {
          white: side,
          black: { ...side, id: "rival", name: "Rival", isPlayer: false },
          playerColor: "white",
          timeControl: {
            id: "15+10",
            label: "15+10",
            base: 900,
            increment: 10,
            category: "rapid",
          },
          rated: false,
          accuracyBonus: 0,
        },
        moves,
        result: "draw",
        termination: "agreement",
        outcome: "draw",
        simulated: false,
        controlLog: [],
        openingName: "King’s Pawn",
        analysis: {
          engine: "Synthetic rendering fixture",
          depth: 10,
          evals: [0, 0, 0, 0, 0],
          moves: reviews,
          whiteAccuracy: 80,
          blackAccuracy: 80,
        },
      },
    ],
  });
  await page.reload();
  await complete(page);
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await page
    .getByRole("button", { name: /vs Rival/ })
    .first()
    .click();
  const replay = page.getByTestId("replay"),
    board = replay.getByTestId("match-board");
  await replay
    .getByRole("button", { name: "Move 1: e4, Blunder", exact: true })
    .click();
  await expect(board.getByTestId("move-annotation")).toHaveText("??");
  await expect(board.locator('[data-move-highlight="blunder"]')).toHaveCount(2);
  await expect(board.getByTestId("move-annotation")).toHaveCSS(
    "background-color",
    "rgb(153, 27, 27)",
  );
  await replay
    .getByRole("button", { name: "Move 2: Nf3, Brilliant move", exact: true })
    .click();
  await expect(board.getByTestId("move-annotation")).toHaveText("!!");
  await expect(board.getByTestId("move-annotation")).toHaveCSS(
    "background-color",
    "rgb(125, 211, 252)",
  );
  await expect(board.locator('[data-move-highlight="brilliant"]')).toHaveCount(
    2,
  );
  await expect(board.locator("img[data-piece]")).toHaveCount(32);
  await page.screenshot({
    path: "artifacts/circuit-brilliant-board.png",
    fullPage: true,
  });
  await replay.getByRole("button", { name: "Start", exact: true }).click();
  await expect(board.getByTestId("move-annotation")).toHaveCount(0);
  expect((await saveState(page)).player.name).toBe(s.player.name);
});

test("Android and iOS emulation use identical loaded piece assets with a square mobile board", async ({
  browser,
}) => {
  const sources: string[][] = [];
  for (const deviceName of ["Pixel 7", "iPhone 13"]) {
    const device = devices[deviceName];
    const context = await browser.newContext({
      userAgent: device.userAgent,
      viewport: device.viewport,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
      baseURL: "http://127.0.0.1:4173",
    });
    try {
      const page = await context.newPage();
      await createCareer(page);
      await page.getByRole("tab", { name: "Games", exact: true }).click();
      await page.getByRole("button", { name: /^Game vs the Engine/ }).click();
      await page
        .getByRole("button", { name: "Start game", exact: true })
        .click();
      const board = page.getByRole("grid", {
        name: "Chess board",
        exact: true,
      });
      await expect(board.locator("img[data-piece]")).toHaveCount(32);
      await expect
        .poll(() =>
          board
            .locator("img")
            .evaluateAll((imgs) =>
              imgs.every(
                (img) =>
                  (img as HTMLImageElement).complete &&
                  (img as HTMLImageElement).naturalWidth > 0,
              ),
            ),
        )
        .toBe(true);
      const b = await board.boundingBox();
      expect(Math.abs(b!.width - b!.height)).toBeLessThan(2);
      sources.push(
        await board
          .locator("img")
          .evaluateAll((imgs) =>
            [
              ...new Set(
                imgs.map(
                  (img) => (img as HTMLImageElement).getAttribute("src")!,
                ),
              ),
            ].sort(),
          ),
      );
      expect(sources.at(-1)).toHaveLength(12);
      await board.screenshot({
        path: `artifacts/circuit-pieces-${deviceName.replaceAll(" ", "-")}.png`,
      });
    } finally {
      await context.close();
    }
  }
  expect(sources[0]).toEqual(sources[1]);
});
