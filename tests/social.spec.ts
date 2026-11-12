import { openSectionTab } from "./navigation";
import { expect, test, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { createCareer } from "./helpers";
import {
  approachNpc,
  recordSharedContacts,
} from "../src/game/social/relationships";
import { recordGame } from "../src/game/history/recordGame";
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
    const req = <T>(r: IDBRequest<T>) =>
      new Promise<T>((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    const tx = db.transaction(["keyval", "careerNpcs"]);
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
        s = tx.objectStore("keyval"),
        r = s.get("chess-career-mode-save-slot-1");
      r.onsuccess = () => {
        const value = JSON.parse(r.result);
        value.state.save = save;
        s.put(JSON.stringify(value), "chess-career-mode-save-slot-1");
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, save);
  await page.reload();
}
async function openDirectory(page: Page) {
  await page.getByRole("link", { name: "Tournament", exact: true }).click();
  await openSectionTab(page, "Rankings");
}
async function openNpc(page: Page, npc: Npc) {
  await openDirectory(page);
  await page
    .getByRole("searchbox", { name: "Search players by name, city or country" })
    .fill(npc.name);
  await page
    .getByRole("table", { name: "Player directory", exact: true })
    .getByRole("button", { name: npc.name, exact: true })
    .click();
  return page.getByRole("dialog", { name: npc.name, exact: true });
}
function acceptingNpc(save: GameSave, npcs: Npc[], action: "talk" | "play") {
  return npcs.find(
    (n) =>
      n.careerStatus === "active" &&
      n.currentElo < 1500 &&
      (() => {
        const r = approachNpc(save, n, action);
        return r.ok && r.accepted;
      })(),
  )!;
}

test("mobile directory includes the saved player and an actual detailed player profile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
  const { save } = await readCareer(page);
  await openDirectory(page);
  await page
    .getByRole("searchbox", { name: "Search players by name, city or country" })
    .fill(save.player.name);
  const table = page.getByRole("table", {
    name: "Player directory",
    exact: true,
  });
  await expect(
    table.getByRole("button", { name: save.player.name, exact: true }),
  ).toHaveCount(1);
  await table
    .getByRole("button", { name: save.player.name, exact: true })
    .click();
  const profile = page.getByRole("dialog", {
    name: save.player.name,
    exact: true,
  });
  await expect(profile).toContainText("You");
  for (const text of [
    "Birth place",
    "World ranking",
    "Current Elo",
    "Peak Elo",
    "Playing style",
    "Training habits",
    "Tournament history",
    "Preferred openings",
  ])
    await expect(profile).toContainText(text);
  await expect(profile).toContainText(String(save.player.rating));
  await expect(profile).toContainText(save.player.dateOfBirth);
  await expect(profile).toContainText("No rated games yet.");
  expect(
    await profile.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBeTruthy();
  await page.screenshot({ path: "artifacts/social-player-profile-mobile.png" });
  await profile
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  const renamed = {
    ...save,
    player: { ...save.player, name: "Renamed Directory Player" },
  };
  await writeCareer(page, renamed);
  await openSectionTab(page, "Rankings");
  await page
    .getByRole("button", { name: "Open your directory profile", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: renamed.player.name, exact: true }),
  ).toBeVisible();
});

test("competitive encounters remain separate from friendship; accepted conversation and cooldown persist", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createCareer(page);
  const { save, npcs } = await readCareer(page),
    npc = acceptingNpc(save, npcs, "talk");
  let fixture = save;
  for (let i = 0; i < 50; i++)
    fixture = recordGame(fixture, {
      opponentId: npc.id,
      opponentName: npc.name,
      opponentElo: npc.currentElo,
      outcome: "draw",
      color: "white",
      accuracy: 80,
    });
  for (let i = 0; i < 15; i++)
    fixture = recordSharedContacts(fixture, `social-ui-event-${i}`, [npc.id]);
  const response = approachNpc(fixture, npc, "talk");
  expect(response.ok && response.accepted).toBeTruthy();
  await writeCareer(page, fixture);
  let profile = await openNpc(page, npc);
  await expect(profile).toContainText("Regular opponents");
  await expect(profile).toContainText("Closeness 0/100");
  await expect(profile).toContainText("Rated meetings: 50");
  await expect(profile).toContainText("Shared tournaments: 15");
  await profile.getByRole("button", { name: "Actions", exact: true }).click();
  await profile
    .getByRole("button", { name: "Talk · 1 AP · 30 min", exact: true })
    .click();
  const after = (await readCareer(page)).save;
  const expected = 3;
  await expect(profile).toContainText(`Closeness ${expected}/100`);
  await expect(profile.getByRole("button", { name: /^Talk/ })).toBeDisabled();
  expect(after.social?.relationships[npc.id].closeness).toBe(expected);
  await page.screenshot({ path: "artifacts/social-relationship-mobile.png" });
  await page.reload();
  profile = await openNpc(page, npc);
  await expect(profile).toContainText(`Closeness ${expected}/100`);
  await profile.getByRole("button", { name: "Actions", exact: true }).click();
  await expect(profile.getByRole("button", { name: /^Talk/ })).toBeDisabled();
});

test("NPC play action opens a real friendly board and a completed human game grows closeness without Elo changes", async ({
  page,
}) => {
  await createCareer(page);
  const { save, npcs } = await readCareer(page),
    npc = acceptingNpc(save, npcs, "play");
  const profile = await openNpc(page, npc);
  await profile.getByRole("button", { name: "Actions", exact: true }).click();
  await profile.getByRole("button", { name: /^Play friendly/ }).click();
  const invitation = page.getByRole("dialog", {
    name: `Friendly invitation · ${npc.name}`,
    exact: true,
  });
  await expect(invitation).toBeVisible();
  await invitation
    .getByRole("button", { name: "Start friendly game", exact: true })
    .click();
  const game = page.getByRole("dialog", {
    name: `Friendly game · ${npc.name}`,
    exact: true,
  });
  await expect(game.getByTestId("match-viewer")).toBeVisible();
  await expect
    .poll(
      async () => !!(await readCareer(page)).save.pendingMatch?.setup.social,
    )
    .toBeTruthy();
  for (let i = 0; i < 6; i++) {
    await expect
      .poll(
        async () =>
          (await readCareer(page)).save.pendingMatch?.ucis.length ?? -1,
      )
      .toBe(i * 2);
    const pending = (await readCareer(page)).save.pendingMatch!,
      chess = new Chess();
    for (const u of pending.ucis)
      chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    const legal = chess.moves({ verbose: true });
    const preferred = [
      "e2e4",
      "g1f3",
      "f1c4",
      "d2d3",
      "b1c3",
      "e1g1",
      "a2a3",
      "h2h3",
    ];
    const move =
      preferred
        .map((uci) => legal.find((m) => m.from + m.to === uci))
        .find(Boolean) ?? legal[0];
    expect(move).toBeTruthy();
    await game.locator(`[data-square="${move!.from}"]`).click();
    await game.locator(`[data-square="${move!.to}"]`).click();
  }
  await expect
    .poll(
      async () => (await readCareer(page)).save.pendingMatch?.ucis.length ?? 0,
    )
    .toBeGreaterThanOrEqual(12);
  await game.getByRole("button", { name: "Resign", exact: true }).click();
  await expect(game.getByTestId("result-banner")).toBeVisible();
  const finished = await readCareer(page);
  expect(finished.save.player.rating).toBe(save.player.rating);
  expect(finished.npcs.find((n) => n.id === npc.id)!.currentElo).toBe(
    npc.currentElo,
  );
  expect(finished.save.social?.relationships[npc.id].friendlyGames).toBe(1);
  expect(finished.save.social?.relationships[npc.id].closeness).toBe(5);
  expect(finished.save.player.ap.current).toBe(save.player.ap.current - 1);
  await game.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  const reopened = await openNpc(page, npc);
  await expect(reopened).toContainText("Closeness 5/100");
  await expect(reopened).toContainText("Casual games together: 1");
});

test("leaving a friendly board before moving clears the invitation and gives no friendship reward", async ({
  page,
}) => {
  await createCareer(page);
  const { save, npcs } = await readCareer(page),
    npc = acceptingNpc(save, npcs, "play");
  const profile = await openNpc(page, npc);
  await profile.getByRole("button", { name: "Actions", exact: true }).click();
  await profile.getByRole("button", { name: /^Play friendly/ }).click();
  await page
    .getByRole("button", { name: "Start friendly game", exact: true })
    .click();
  const game = page.getByRole("dialog", {
    name: `Friendly game · ${npc.name}`,
    exact: true,
  });
  await expect(game.getByTestId("match-viewer")).toBeVisible();
  await game.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(game).not.toBeVisible();
  await expect
    .poll(async () => (await readCareer(page)).save.social?.pending ?? null)
    .toBeNull();
  const after = (await readCareer(page)).save;
  expect(after.social?.relationships[npc.id].closeness).toBe(0);
  expect(after.social?.relationships[npc.id].friendlyGames).toBe(0);
  await page.getByRole("link", { name: "Train", exact: true }).click();
  await page
    .getByRole("button", { name: /Rest day: end day|End day & sleep/ })
    .click();
  await expect
    .poll(async () => (await readCareer(page)).save.world.day)
    .toBe(2);
});
