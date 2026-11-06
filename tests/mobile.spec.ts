import { test, expect, type Page } from '@playwright/test';
import { createCareer } from './helpers';

test.use({ isMobile: true, hasTouch: true });

async function assertFits(page: Page, width: number) {
  const size = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  // Mobile innerWidth grows with overflowing content, so compare against the requested viewport.
  expect(size.viewport).toBe(width);
  expect(size.content).toBeLessThanOrEqual(width + 1);
}

test('mobile layouts keep the board, opening details and performance within the viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await createCareer(page);
  await page.getByRole('tab', { name: 'Games', exact: true }).click();
  await page.getByRole('button', { name: 'Simulate instead', exact: true }).click();

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('tab', { name: 'Games', exact: true }).click();
    await assertFits(page, width);
    await page.getByRole('button', { name: /^Online Blitz/ }).click();
    await expect(page.getByText(/It is not real multiplayer/)).toBeVisible();
    await assertFits(page, width);
    await page.getByRole('button', { name: /^Game vs the Engine/ }).click();
    await assertFits(page, width);
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    await expect(page.getByRole('grid', { name: 'Chess board' })).toBeVisible();
    await assertFits(page, width);
    await page.getByRole('button', { name: 'Leave', exact: true }).click();
    await page.getByRole('button', { name: /^History/ }).click();
    await assertFits(page, width);

    await page.getByRole('tab', { name: 'Openings', exact: true }).click();
    await assertFits(page, width);
    await page.locator('#panel-openings ul button').first().click();
    await expect(page.getByRole('heading', { name: 'English Opening', exact: true })).toBeVisible();
    await assertFits(page, width);
    if (width === 320) await page.getByRole('button', { name: 'Add to preferences', exact: true }).click();
    await page.getByRole('button', { name: 'Preferences', exact: true }).click();
    await assertFits(page, width);
    await page.getByRole('button', { name: 'Performance', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Results by opening', exact: true })).toBeVisible();
    await assertFits(page, width);
    const table = page.getByRole('region', { name: 'Opening performance table', exact: true });
    await expect(table).toBeVisible();
    expect(await table.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await assertFits(page, width);
  }
  expect(errors).toEqual([]);
});
