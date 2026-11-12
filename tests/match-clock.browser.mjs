// Real-component clock/render regression against two Vite servers. No engine or UI mocks.
// Run patched Vite on4181 and pristine source on4180 with the same dependencies.
// If node_modules is shared, give each server a separate Vite cacheDir.
// CHROMIUM_PATH=/usr/bin/chromium node tests/match-clock.browser.mjs [baselineURL] [patchedURL]
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const output = [];
try {
  for (const [label, url] of [['baseline', process.argv[2] ?? 'http://127.0.0.1:4180'], ['patched', process.argv[3] ?? 'http://127.0.0.1:4181']]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(label, error.message); });
    page.setDefaultTimeout(15_000);
    await page.addInitScript(() => {
      window.__clockPerf = { viewer: 0, board: 0, panels: { white: 0, black: 0 }, intervals: new Set() };
      const start = window.setInterval.bind(window);
      const stop = window.clearInterval.bind(window);
      window.setInterval = (fn, delay, ...args) => {
        const id = start(fn, delay, ...args);
        if (delay === 100) window.__clockPerf.intervals.add(id);
        return id;
      };
      window.clearInterval = id => { window.__clockPerf.intervals.delete(id); return stop(id); };
    });
    for (const [file, fn, counter] of [
      ['MatchViewer', 'MatchViewer', 'window.__clockPerf.viewer++'],
      ['MatchBoard', 'MatchBoard', 'window.__clockPerf.board++'],
      ['PlayerPanel', 'PlayerPanel', 'window.__clockPerf.panels[color]++'],
    ]) {
      await page.route(`**/src/features/match/${file}.tsx*`, async route => {
        const response = await route.fetch();
        const source = await response.text();
        const pattern = new RegExp(`(function ${fn}\\([^]*?\\) \\{)`);
        assert.match(source, pattern, `Render observer insertion point: ${file}`);
        await route.fulfill({ response, body: source.replace(pattern, `$1\n${counter};`) });
      });
    }
    await page.route('**/src/game/match/session.ts*', async route => {
      const response = await route.fetch();
      const source = await response.text();
      assert.match(source, /\n  start\(\) \{/);
      await route.fulfill({ response, body: source.replace(/(\n  start\(\) \{)/, `$1
window.__clockPerfSession = this;
if (!this.__clockPerfCallbacks) {
  this.__clockPerfCallbacks = { finish: 0, analysis: 0, checkpoint: 0 };
  for (const [key, counter] of [['onFinish', 'finish'], ['onAnalysis', 'analysis'], ['onCheckpoint', 'checkpoint']]) {
    const callback = this.opts[key];
    this.opts[key] = (...args) => { this.__clockPerfCallbacks[counter]++; return callback?.(...args); };
  }
}`) });
    });
    await page.goto(url);
    await page.evaluate(async () => {
      const viewerSource = await (await fetch('/src/features/match/MatchViewer.tsx')).text();
      const mainSource = await (await fetch('/src/main.tsx')).text();
      const reactURL = viewerSource.match(/from "([^"]*\/react\.js(?:\?[^"]*)?)"/)[1];
      const domURL = mainSource.match(/from "([^"]*\/react-dom_client\.js(?:\?[^"]*)?)"/)[1];
      const [reactModule, domModule, { MatchViewer }, { createPlayer }, { DEFAULT_APPEARANCE }, { buildPlayerProfile }] = await Promise.all([
        import(reactURL),
        import(domURL),
        import('/src/features/match/MatchViewer.tsx'),
        import('/src/game/player/createPlayer.ts'),
        import('/src/data/appearance.ts'),
        import('/src/game/match/npcProfile.ts'),
      ]);
      const { createElement } = reactModule.default ?? reactModule;
      const { createRoot } = domModule.default ?? domModule;
      const player = createPlayer({ name: 'Clock regression', gender: 'undisclosed', countryCode: 'TH', city: { name: 'Bangkok', custom: false }, archetype: 'balanced', appearance: DEFAULT_APPEARANCE, startYear: 2026, alternateHistory: false }, 2026);
      const profile = buildPlayerProfile(player, 0, { white: [], black: [] });
      const side = { id: null, name: player.name, elo: player.rating, title: 'none', countryCode: 'TH', nationality: 'Thai', flag: '🇹🇭', isPlayer: true };
      const setup = { white: side, black: { ...side, name: 'Clock opponent', isPlayer: false }, playerColor: 'white', timeControl: { id: '1+0', label: '1+0', base: 60, increment: 0, category: 'bullet' }, rated: false, tournament: null, accuracyBonus: 0, profiles: { white: profile, black: profile }, mode: 'play', speed: 'real', seed: 912 };
      document.getElementById('root').style.display = 'none';
      const mount = document.createElement('main');
      mount.style.cssText = 'width:100%;max-width:1024px;margin:auto;padding:16px';
      document.body.append(mount);
      const root = createRoot(mount);
      window.__clockPerfRoot = root;
      root.render(createElement(MatchViewer, { setup, onExit: () => root.unmount() }));
      window.__clockPerfStrictProbe = () => {
        const strictMount = document.createElement('main');
        document.body.append(strictMount);
        const strictRoot = createRoot(strictMount);
        window.__clockPerfRoot = strictRoot;
        const StrictMode = (reactModule.default ?? reactModule).StrictMode;
        strictRoot.render(createElement(StrictMode, null, createElement(MatchViewer, { setup, onExit: () => strictRoot.unmount() })));
      };
    });
    await page.getByTestId('match-viewer').waitFor().catch(async error => { console.error(await page.locator('body').innerText()); throw error; });
    console.log(label, 'mounted');
    await page.waitForFunction(() => window.__clockPerfSession?.getSnapshot().live !== null);
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => ({ viewer: window.__clockPerf.viewer, board: window.__clockPerf.board, panels: { ...window.__clockPerf.panels }, clock: document.querySelector('[data-testid="clock-white"]').textContent }));
    await page.waitForTimeout(2200);
    const after = await page.evaluate(() => ({ viewer: window.__clockPerf.viewer, board: window.__clockPerf.board, panels: { ...window.__clockPerf.panels }, clock: document.querySelector('[data-testid="clock-white"]').textContent, intervals: window.__clockPerf.intervals.size }));
    const result = { label, intervalMs: 2200, viewerRenders: after.viewer - before.viewer, boardRenders: after.board - before.board, whitePanelRenders: after.panels.white - before.panels.white, blackPanelRenders: after.panels.black - before.panels.black, clockBefore: before.clock, clockAfter: after.clock, active100msIntervals: after.intervals };
    assert.notEqual(before.clock, after.clock, 'Active clock keeps counting');
    if (label === 'baseline') assert.ok(result.viewerRenders >= 15, 'Baseline timer reaches viewer');
    else {
      assert.equal(result.viewerRenders, 0, 'No parent renders from clock display');
      assert.equal(result.boardRenders, 0, 'No board renders from clock display');
      assert.ok(result.whitePanelRenders >= 15, 'Active clock card still redraws');
      assert.equal(result.blackPanelRenders, 0, 'Inactive clock card stays idle');
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        const geometry = await page.getByTestId('match-board').getByRole('grid').evaluate(el => {
          const rect = el.getBoundingClientRect();
          const cells = [...el.querySelectorAll('[role="gridcell"]')].map(cell => cell.getBoundingClientRect());
          return { width: rect.width, height: rect.height, rows: new Set(cells.map(r => Math.round(r.top))).size, minCellHeight: Math.min(...cells.map(r => r.height)), maxCellHeight: Math.max(...cells.map(r => r.height)), rowsClass: el.classList.contains('grid-rows-8') };
        });
        assert.equal(geometry.rows, 8);
        assert.equal(geometry.rowsClass, true);
        assert.ok(Math.abs(geometry.width - geometry.height) <= 1);
        assert.ok(geometry.maxCellHeight - geometry.minCellHeight <= 1);
        result[`layout${width}`] = geometry;
      }
      // Pause/resume through the real session API; pending bot work is invalidated by pause.
      await page.evaluate(() => { window.__clockPerfSession.setController('white', 'auto'); window.__clockPerfSession.pause(); });
      await page.getByText('Paused. The clocks are stopped.', { exact: true }).waitFor();
      const paused = await page.getByTestId('clock-white').textContent();
      await page.waitForTimeout(1200);
      assert.equal(await page.getByTestId('clock-white').textContent(), paused, 'Paused clock is frozen');
      assert.equal(await page.evaluate(() => window.__clockPerf.intervals.size), 1, 'Only referee timer remains while paused');
      await page.evaluate(() => window.__clockPerfSession.setController('white', 'human'));
      await page.waitForTimeout(1200);
      assert.notEqual(await page.getByTestId('clock-white').textContent(), paused, 'Resume restarts clock display');
      // Preserve selection and real move handling while the clock updates.
      await page.locator('[data-square="e2"]').click();
      await page.waitForTimeout(250);
      assert.equal(await page.locator('[data-square="e4"]').getAttribute('data-target'), 'true');
      await page.locator('[data-square="e4"]').click();
      await page.waitForFunction(() => window.__clockPerfSession.getSnapshot().game.ucis[0] === 'e2e4');
      await page.getByRole('button', { name: 'Leave', exact: true }).click();
    }
    if (label === 'baseline') await page.getByRole('button', { name: 'Leave', exact: true }).click();
    await page.waitForTimeout(150);
    assert.equal(await page.getByTestId('match-viewer').count(), 0, 'Viewer unmounted');
    assert.equal(await page.evaluate(() => window.__clockPerf.intervals.size), 0, 'Display and session timers cleaned up');
    assert.deepEqual(errors, []);
    await page.evaluate(() => window.__clockPerfStrictProbe());
    await page.getByTestId('match-viewer').waitFor();
    await page.waitForTimeout(250);
    result.developmentStrictMode = await page.evaluate(() => ({ status: window.__clockPerfSession.getSnapshot().status, active100msIntervals: window.__clockPerf.intervals.size }));
    assert.equal(result.developmentStrictMode.status, label === 'baseline' ? 'over' : 'running');
    if (label === 'patched') {
      const initialCallbacks = await page.evaluate(() => ({ ...window.__clockPerfSession.__clockPerfCallbacks }));
      assert.deepEqual(initialCallbacks, { finish: 0, analysis: 0, checkpoint: 0 }, 'StrictMode probe cleanup did not abandon the game');
      const strictClock = await page.getByTestId('clock-white').textContent();
      await page.waitForTimeout(1100);
      assert.notEqual(await page.getByTestId('clock-white').textContent(), strictClock);
      await page.evaluate(() => {
        const session = window.__clockPerfSession;
        session.setController('black', 'human');
        session.humanMove('e2e4');
        session.humanMove('e7e5');
      });
    }
    await page.evaluate(() => window.__clockPerfRoot.unmount());
    assert.equal(await page.evaluate(() => window.__clockPerf.intervals.size), 0);
    if (label === 'patched') {
      await page.waitForFunction(() => window.__clockPerfSession.__clockPerfCallbacks.analysis === 1);
      result.strictModeCallbacksAfterUnmount = await page.evaluate(() => ({ ...window.__clockPerfSession.__clockPerfCallbacks }));
      assert.equal(result.strictModeCallbacksAfterUnmount.finish, 1);
      assert.equal(result.strictModeCallbacksAfterUnmount.analysis, 1);
      assert.equal(result.strictModeCallbacksAfterUnmount.checkpoint, 3);
    }
    assert.deepEqual(errors, []);
    output.push({ ...result, pageErrors: errors, cleanupIntervals: 0 });
    await page.close();
  }
  // Exercise the actual application entry point, including main.tsx's StrictMode.
  const devPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  devPage.setDefaultTimeout(20_000);
  const devErrors = [];
  devPage.on('pageerror', error => devErrors.push(error.message));
  await devPage.goto(process.argv[3] ?? 'http://127.0.0.1:4181');
  await devPage.getByRole('button', { name: 'New character', exact: true }).first().click();
  await devPage.getByLabel('Full name').fill('Development clock test');
  await devPage.getByText('Prefer not to say', { exact: true }).click();
  await devPage.getByRole('combobox', { name: 'Nationality' }).fill('Thailand');
  await devPage.getByRole('option', { name: /Thailand/ }).click();
  await devPage.getByRole('combobox', { name: 'City' }).fill('Bangkok');
  await devPage.getByRole('option', { name: /^Bangkok/ }).first().click();
  for (let step = 0; step < 4; step++) await devPage.getByRole('button', { name: 'Next', exact: true }).click();
  await devPage.getByRole('button', { name: 'Create career', exact: true }).click();
  await devPage.getByRole('link', { name: 'Tournament', exact: true }).click();
  await devPage.getByRole('button', { name: 'White', exact: true }).click();
  await devPage.getByRole('button', { name: 'Friendly', exact: true }).click();
  await devPage.getByTestId('custom-minutes').fill('1');
  await devPage.getByTestId('custom-increment').fill('0');
  await devPage.getByTestId('start-game').click();
  await devPage.getByTestId('match-viewer').waitFor();
  const devClockBefore = await devPage.getByTestId('clock-white').textContent();
  await devPage.waitForTimeout(1100);
  const devClockAfter = await devPage.getByTestId('clock-white').textContent();
  assert.notEqual(devClockAfter, devClockBefore, 'Real dev Complete clock runs under StrictMode');
  for (const width of [320, 390]) {
    await devPage.setViewportSize({ width, height: 844 });
    await devPage.evaluate(() => scrollTo(0, 0));
    await devPage.screenshot({ path: `artifacts/match-performance-${width}.png`, fullPage: true });
  }
  await devPage.locator('[data-square="e2"]').click();
  await devPage.locator('[data-square="e4"]').click();
  await devPage.getByTestId('move-list').locator('[data-ply="2"]').waitFor();
  await devPage.getByRole('button', { name: 'Resign', exact: true }).click();
  await devPage.getByTestId('review-report').waitFor();
  await devPage.getByRole('button', { name: 'Start', exact: true }).click();
  for (const width of [320, 390]) {
    await devPage.setViewportSize({ width, height: 844 });
    await devPage.evaluate(() => scrollTo(0, 0));
    await devPage.screenshot({ path: `artifacts/match-performance-review-${width}.png`, fullPage: true });
  }
  const devMatches = await devPage.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const req = indexedDB.open('chess-career-mode'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const values = await new Promise((resolve, reject) => { const req = db.transaction('keyval').objectStore('keyval').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    db.close();
    return values.map(value => JSON.parse(value)).find(value => value.state?.save)?.state.save.matches;
  });
  assert.equal(devMatches.length, 1, 'Exactly one result was saved in the real dev flow');
  assert.ok(devMatches[0].analysis, 'Exactly one finished game contains the analysis');
  await devPage.getByRole('button', { name: 'Close', exact: true }).click();
  assert.equal(await devPage.getByTestId('match-viewer').count(), 0);
  assert.deepEqual(devErrors, []);
  output.find(item => item.label === 'patched').developmentComplete = { clockBefore: devClockBefore, clockAfter: devClockAfter, savedMatches: devMatches.length, analysisAttached: true, pageErrors: devErrors };
  await devPage.close();
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/match-clock-perf.json', JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
} finally { await browser.close(); }
