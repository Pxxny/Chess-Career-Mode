import { expect, test, type Page } from "@playwright/test";
import { createCareer } from "./helpers";
import {
  createTournament,
  reportPlayerResult,
} from "../src/game/match/tournament";
import { recordGame, recordTournament } from "../src/game/history/recordGame";
import type { GameSave, Npc } from "../src/types";

async function readCareer(
  page: Page,
): Promise<{ save: GameSave; npcs: Npc[] }> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction(["keyval", "careerNpcs"]);
    const req = <T>(r: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    const [raw, rows] = await Promise.all([
      req(tx.objectStore("keyval").get("chess-career-mode-save-slot-1")),
      req(tx.objectStore("careerNpcs").getAll()),
    ]);
    const save = JSON.parse(raw).state.save;
    db.close();
    return {
      save,
      npcs: rows
        .filter((r) => r.key.startsWith(`${save.career.id}|`))
        .map((r) => r.npc),
    };
  });
}
async function writeCareer(page: Page, save: GameSave) {
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
        const data = JSON.parse(r.result);
        data.state.save = save;
        store.put(JSON.stringify(data), "chess-career-mode-save-slot-1");
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, save);
  await page.reload();
}

test("finished player event appears in NPC profiles, survives reload, and Magnus plays the weekly circuit", async ({
  page,
}) => {
  await createCareer(page);
  const { save, npcs } = await readCareer(page);
  let t = createTournament({
    event: {
      id: "browser-history-qa",
      name: "Browser History Open",
      year: 2026,
      week: 1,
      level: "local",
      fieldSize: 8,
      entryFee: 0,
      minElo: 0,
      minReputation: 0,
      registrationDeadline: { year: 2026, week: 1 },
      weeksUntilStart: 0,
      weeksUntilDeadline: 0,
      invitational: false,
    },
    player: {
      name: save.player.name,
      rating: save.player.rating,
      country: save.player.country,
      title: "none",
    },
    npcs,
    seed: 991,
  });
  while (t.status === "playing")
    t = reportPlayerResult(t, t.round % 3 === 0 ? "draw" : "win");
  const npc = t.players.find((p) => !p.isPlayer)!;
  // Upgrade an old-name NPC and backfill its missing event history during the same load.
  await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("chess-career-mode");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("careerNpcs", "readwrite"),
        store = tx.objectStore("careerNpcs"),
        r = store.getAll();
      r.onsuccess = () => {
        const row = r.result.find((row) => row.npc.id === id);
        if (row) {
          row.npc.nameVersion = 0;
          store.put(row);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, npc.id);
  const finished = recordTournament(
    { ...save, tournament: t },
    {
      tournamentId: t.eventId,
      name: t.name,
      level: t.level,
      rank: t.finalRank!,
      fieldSize: t.players.length,
      points: t.players.find((p) => p.isPlayer)!.points,
      prize: 0,
    },
  );
  await writeCareer(page, finished);
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await page.getByRole("tab", { name: "Rankings", exact: true }).click();
  const profileName = (await readCareer(page)).npcs.find(
    (n) => n.id === npc.id,
  )!.name;
  await page
    .getByRole("searchbox", { name: "Search players by name, city or country" })
    .fill(profileName);
  await page.getByRole("button", { name: profileName, exact: true }).click();
  const profile = page.getByRole("dialog", { name: profileName, exact: true });
  await expect(profile).toContainText("Browser History Open");
  await expect(profile).toContainText("Career tournament");
  const first = (await readCareer(page)).npcs.find((n) => n.id === npc.id)!;
  expect(
    first.tournamentHistory.filter((h) => h.eventId === t.eventId),
  ).toHaveLength(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Tournament", exact: true }),
  ).toBeVisible();
  expect(
    (await readCareer(page)).npcs
      .find((n) => n.id === npc.id)!
      .tournamentHistory.filter((h) => h.eventId === t.eventId),
  ).toHaveLength(1);
  await page.getByRole("link", { name: "Train", exact: true }).click();
  for (let i = 0; i < 7; i++)
    await page
      .getByRole("button", { name: /Rest day: end day|End day & sleep/ })
      .click();
  await expect
    .poll(
      async () =>
        (await readCareer(page)).npcs
          .find((n) => n.id === "legend-magnus-carlsen")!
          .tournamentHistory.filter((h) => h.source === "world-circuit").length,
    )
    .toBeGreaterThan(0);
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await page.getByRole("tab", { name: "Rankings", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search players by name, city or country" })
    .fill("Magnus Carlsen");
  await page
    .getByRole("button", { name: "Magnus Carlsen", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Magnus Carlsen", exact: true }),
  ).toContainText("Simulated world circuit");
  await page
    .getByRole("dialog", { name: "Magnus Carlsen", exact: true })
    .evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
  await page.screenshot({
    path: "artifacts/world-activity-magnus.png",
    fullPage: false,
  });
});

test("mobile year-end dialog shows real recorded totals, dismissal persists, and annual archive is readable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
  const { save } = await readCareer(page);
  let fixture = save;
  for (const outcome of ["win", "draw", "loss"] as const)
    fixture = recordGame(fixture, {
      opponentId: "annual-ui",
      opponentName: "Annual UI",
      opponentElo: fixture.player.rating,
      outcome,
      color: "white",
      accuracy: 80,
    });
  fixture = {
    ...fixture,
    world: { ...fixture.world, date: { year: 2026, week: 52 }, day: 7 },
  };
  await writeCareer(page, fixture);
  await page
    .getByRole("button", { name: /Rest day: end day|End day & sleep/ })
    .click();
  const dialog = page.getByRole("dialog", { name: "2026 · Year in review" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("3 · 1W 1D 1L");
  await expect(dialog).toContainText("33.3%");
  await expect(dialog).toContainText("Career Elo");
  await expect(dialog).toContainText("Cash change");
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBeTruthy();
  await page.screenshot({
    path: "artifacts/year-review-mobile.png",
    fullPage: false,
  });
  await dialog.getByRole("button", { name: "Continue to 2027" }).click();
  await expect(dialog).not.toBeVisible();
  // IndexedDB persistence is asynchronous; reload after the dismissal is durable.
  await expect
    .poll(async () =>
      (await readCareer(page)).save.yearReview!.unread.includes(2026),
    )
    .toBe(false);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Train", exact: true }),
  ).toBeVisible();
  await expect(dialog).not.toBeVisible();
  await page.goto("/career?view=years");
  await expect(
    page.getByRole("tab", { name: "Year in review", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Review year")).toHaveValue("2026");
  await expect(page.getByRole("tabpanel")).toContainText("3 · 1W 1D 1L");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "artifacts/year-review-archive-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByRole("tabpanel")).toContainText("3 · 1W 1D 1L");
});
