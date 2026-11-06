import { test, expect, type Page } from '@playwright/test';
import { createCareer } from './helpers';


async function readSave(page: Page): Promise<any> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('chess-career-mode');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      const values = await new Promise<string[]>((resolve, reject) => {
        const req = db.transaction('keyval').objectStore('keyval').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return values.map(v => JSON.parse(v)).find(v => v.state?.save)?.state.save;
    } finally { db.close(); }
  });
}

async function playPlayerMove(page: Page) {
  await expect(page.getByText(/^Your move \((White|Black)\)\.$/)).toBeVisible();
  const black = await page.getByText('Your move (Black).', { exact: true }).count();
  const pieces = page.getByRole('gridcell', { name: new RegExp(`, ${black ? 'black' : 'white'} (pawn|knight|bishop|rook|queen|king)$`) });
  for (let i = 0; i < await pieces.count(); i++) {
    await pieces.nth(i).click();
    const target = page.getByRole('gridcell', { name: /move available|capture available/ }).first();
    if (await target.count()) { await target.click(); return; }
  }
  throw new Error('No playable move found');
}

async function finishByResignation(page: Page) {
  await page.getByRole('button', { name: 'Resign', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm resign', exact: true }).click();
  await expect(page.getByText('You lost by resignation', { exact: true })).toBeVisible();
  await expect.poll(async () => (await readSave(page)).practice.games.at(-1)?.analysis, { timeout: 45_000 }).toBeTruthy();
}

async function gamesTab(page: Page, mode: RegExp) {
  await page.getByRole('tab', { name: 'Games', exact: true }).click();
  await page.getByRole('button', { name: mode }).click();
}

async function openingsTab(page: Page, view: string) {
  await page.getByRole('tab', { name: 'Openings', exact: true }).click();
  await page.getByRole('button', { name: view, exact: true }).click();
}

test('production app: real games, Stockfish, analysis, history and opening performance persist', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await createCareer(page);
  await gamesTab(page, /^Training Game/);
  await page.getByLabel('Time control', { exact: true }).selectOption('5+3');
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await playPlayerMove(page);
  await playPlayerMove(page);
  await expect(page.getByRole('timer', { name: 'Your clock' })).toBeVisible();
  await expect(page.getByText(/: (the engine's top choice|a good move|inaccuracy|mistake|blunder)/)).toBeVisible();
  await finishByResignation(page);
  let save = await readSave(page);
  expect(save.practice.games).toHaveLength(1);
  expect(save.practice.games[0].mode).toBe('training');
  expect(save.practice.games[0].analysis.engine).toMatch(/Stockfish/);
  await page.getByRole('button', { name: 'Back to setup', exact: true }).click();

  await gamesTab(page, /^Game vs the Engine/);
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await playPlayerMove(page);
  await playPlayerMove(page);
  await finishByResignation(page);
  await page.getByRole('button', { name: 'Back to setup', exact: true }).click();

  await gamesTab(page, /^Online Blitz/);
  await expect(page.getByText(/It is not real multiplayer/)).toBeVisible();
  await page.getByRole('button', { name: 'Find match', exact: true }).click();
  await page.getByRole('button', { name: 'Accept and play', exact: true }).click();
  await playPlayerMove(page);
  await playPlayerMove(page);
  await finishByResignation(page);
  save = await readSave(page);
  expect(save.practice.games).toHaveLength(3);
  expect(save.practice.blitzGames).toBe(1);
  expect(save.practice.blitzRating).toBeLessThan(1000);
  expect(save.practice.games.at(-1).ratingAfter).toBe(save.practice.blitzRating);

  await gamesTab(page, /^History/);
  await expect(page.getByRole('button', { name: 'Review', exact: true })).toHaveCount(3);
  await page.getByRole('button', { name: 'Review', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Close review', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/desktop-analysis.png', fullPage: true });
  await openingsTab(page, 'Performance');
  await expect(page.getByRole('heading', { name: /Performance|Results by opening/ }).first()).toBeVisible();
  await expect(page.getByText('Games with an opening', { exact: true }).locator('..').locator('p').nth(1)).toHaveText('3');
  await expect(page.getByText('Win rate', { exact: true }).locator('..').locator('p').nth(1)).toHaveText('0%');
  await expect(page.getByText('3 analysed games', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/desktop-performance.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Games', exact: true })).toBeVisible();
  expect((await readSave(page)).practice.games).toHaveLength(3);
  expect(errors).toEqual([]);
});

test('PGN file/paste, exports, imported opening on Games-first refresh and source removal', async ({ page }) => {
  await createCareer(page);
  await openingsTab(page, 'Import');
  const line = '[Event "Codex Test Line"]\n[ECO "A00"]\n\n1. a3 a6 2. h3 h6 3. b3 b6 *';
  await page.getByLabel('Name this source').fill('Browser repertoire');
  await page.getByLabel('PGN file', { exact: true }).setInputFiles({ name: 'test.pgn', mimeType: 'application/x-chess-pgn', buffer: Buffer.from(line) });
  await page.getByRole('button', { name: 'Import lines', exact: true }).click();
  await expect(page.getByText('1 new openings added', { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Export imported lines/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('imported-openings.pgn');
  await download.saveAs('artifacts/imported-openings.pgn');
  await page.getByRole('radio', { name: 'A game collection (statistics)', exact: true }).click();
  await page.getByLabel('Name this source').fill('Browser collection');
  await page.getByLabel('Or paste PGN').fill('[Event "Real Counts"]\n[Date "2020.01.01"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0');
  await page.getByRole('button', { name: 'Count games', exact: true }).click();
  await expect(page.getByText('1 matched an opening', { exact: true })).toBeVisible();
  await page.reload();
  await gamesTab(page, /^Training Game/);
  await page.getByText('Opening practice', { exact: true }).click();
  await page.getByRole('searchbox', { name: 'Opening to practise' }).fill('Codex Test Line');
  await expect(page.getByRole('button', { name: /A00 · Codex Test Line/ })).toBeVisible();
  await openingsTab(page, 'Import');
  await expect(page.getByText('Browser repertoire', { exact: true })).toBeVisible();
  await expect(page.getByText('Browser collection', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove everything imported', exact: true }).click();
  await page.reload();
  await openingsTab(page, 'Import');
  await expect(page.getByText('Nothing imported yet.', { exact: false })).toBeVisible();
});

test('missing Stockfish uses built-in engine and keeps playing', async ({ page }) => {
  await page.route('**/engine/**', route => route.abort());
  await createCareer(page);
  await gamesTab(page, /^Game vs the Engine/);
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await playPlayerMove(page);
  await playPlayerMove(page);
  await expect(page.getByText('Built-in engine', { exact: true })).toBeVisible();
  await finishByResignation(page);
  expect((await readSave(page)).practice.games.at(-1).analysis.engine).toMatch(/Built-in/);
});

test('reload of an active game records resignation once; version 5 save upgrades in place', async ({ page }) => {
  await createCareer(page);
  await gamesTab(page, /^Game vs the Engine/);
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await playPlayerMove(page);
  await playPlayerMove(page);
  await expect.poll(async () => (await readSave(page)).practice.pendingGame?.moves.length ?? 0).toBeGreaterThanOrEqual(2);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Games', exact: true })).toBeVisible();
  let save = await readSave(page);
  expect(save.practice.games).toHaveLength(1);
  expect(save.practice.games[0].termination).toBe('resignation');
  expect(save.practice.games[0].outcome).toBe('loss');
  expect(save.practice.pendingGame).toBeNull();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Games', exact: true })).toBeVisible();
  expect((await readSave(page)).practice.games).toHaveLength(1);

  const careerId = save.career.id;
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open('chess-career-mode'); req.onsuccess = () => resolve(req.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('keyval', 'readwrite');
      const store = tx.objectStore('keyval');
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const item = JSON.parse(cursor.value);
        if (item.state?.save) {
          item.version = 5;
          item.state.save.version = 5;
          delete item.state.save.practice;
          delete item.state.save.repertoire;
          cursor.update(JSON.stringify(item));
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Games', exact: true })).toBeVisible();
  save = await readSave(page);
  expect(save.version).toBe(6);
  expect(save.career.id).toBe(careerId);
  expect(save.player.name).toBe('Browser Test Player');
  expect(save.practice.games).toEqual([]);
  expect(save.repertoire.preferences).toBeTruthy();
});
