// Run after test:e2e:ui-learning-elo. The state contains only the synthetic QA career.
import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ storageState: '/tmp/chess-ui-learning-storage.json', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.PLAYTEST_URL || 'http://127.0.0.1:4173/profile?tab=stats');
  const chart = page.getByTestId('elo-chart');
  await chart.locator('canvas').waitFor({ state: 'visible' });
  await page.getByRole('combobox', { name: 'Language / ภาษา', exact: true }).first().selectOption('th');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await chart.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 118));
    // Allow Chart.js's ResizeObserver to render the new canvas dimensions.
    await page.waitForTimeout(200);
    const layout = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
    if (layout.content > width + 1) throw new Error(`Overflow: ${JSON.stringify(layout)}`);
    await page.screenshot({ path: `artifacts/ui-learning-elo/${width === 390 ? '09-elo-month-mobile-th' : '13-elo-month-small-mobile-th'}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('combobox', { name: 'Language / ภาษา', exact: true }).first().selectOption('en');
  await page.goto(new URL('/train', process.env.PLAYTEST_URL || 'http://127.0.0.1:4173').href);
  await page.getByRole('tab', { name: 'Games', exact: true }).click();
  await page.getByRole('button', { name: /^Training Game/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(page.getByText('Your move (White).', { exact: true })).toBeVisible();
  await page.getByRole('gridcell', { name: /^e2,/ }).click();
  await page.getByRole('gridcell', { name: /^e4,/ }).click();
  await expect(page.getByText('Your move (White).', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Language / ภาษา', exact: true }).first().selectOption('th');
  await page.locator('[role="grid"]').first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 166));
  await page.screenshot({ path: 'artifacts/ui-learning-elo/12-live-game-mobile-th.png' });
  const native = await page.evaluate(() => ({ secureContext: isSecureContext, supported: !!navigator.wakeLock?.request, status: document.querySelector('[data-testid="screen-wake-status"]')?.getAttribute('data-status'), pageErrors: [] }));
  native.pageErrors = errors;
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile('verification/ui-learning-elo/native-browser-results.json', JSON.stringify(native, null, 2) + '\n');
  console.log(JSON.stringify(native));
  await context.close();
} finally { await browser.close(); }
