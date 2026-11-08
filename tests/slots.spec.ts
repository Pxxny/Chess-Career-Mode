import { expect, test, type Page } from '@playwright/test';
import { createCareer } from './helpers';

async function readSlots(page: Page): Promise<Array<{ key: string; name: string; dateOfBirth: string }>> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('chess-career-mode');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      const tx = db.transaction('keyval');
      const store = tx.objectStore('keyval');
      const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const values = await new Promise<string[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return keys
        .map((key, i) => ({ key: String(key), save: JSON.parse(values[i])?.state?.save }))
        .filter((e) => e.key.includes('-slot-') && e.save)
        .map((e) => ({ key: e.key, name: e.save.player.name, dateOfBirth: e.save.player.dateOfBirth }));
    } finally {
      db.close();
    }
  });
}

test('date of birth, then two characters side by side in separate slots', async ({ page }) => {
  // Character 1: a chosen date of birth.
  await page.goto('/');
  await page.getByRole('button', { name: 'New character', exact: true }).first().click();
  await page.getByLabel('Full name').fill('First Character');
  await page.getByLabel('Birth day').selectOption('9');
  await page.getByLabel('Birth month').selectOption('3');
  await page.getByLabel('Birth year').selectOption('2008');
  await page.getByText('Prefer not to say', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Nationality' }).fill('Thailand');
  await page.getByRole('option', { name: /Thailand/ }).click();
  await page.getByRole('combobox', { name: 'City' }).fill('Bangkok');
  await page.getByRole('option', { name: /^Bangkok/ }).first().click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Create career', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Train', exact: true })).toBeVisible();
  expect((await readSlots(page)).map((s) => [s.name, s.dateOfBirth])).toEqual([['First Character', '2008-03-09']]);

  // Switch: the character stays saved in slot 1.
  await page.getByRole('link', { name: /Open profile for First Character/ }).click();
  await page.getByRole('button', { name: 'Switch or create character', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your characters' })).toBeVisible();
  await expect(page.getByLabel('Character slot 1').getByText('First Character')).toBeVisible();
  await expect(page.getByLabel('Character slot 2').getByText('Empty slot')).toBeVisible();

  // Character 2 goes into slot 2.
  await page.getByLabel('Character slot 2').getByRole('button', { name: 'New character' }).click();
  await page.getByLabel('Full name').fill('Second Character');
  await page.getByText('Prefer not to say', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Nationality' }).fill('Thailand');
  await page.getByRole('option', { name: /Thailand/ }).click();
  await page.getByRole('combobox', { name: 'City' }).fill('Bangkok');
  await page.getByRole('option', { name: /^Bangkok/ }).first().click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Create career', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Train', exact: true })).toBeVisible();
  expect((await readSlots(page)).map((s) => s.name).sort()).toEqual(['First Character', 'Second Character']);

  // Back to the first one; a reload opens the character that was open last.
  await page.getByRole('link', { name: /Open profile for Second Character/ }).click();
  await page.getByRole('button', { name: 'Switch or create character', exact: true }).click();
  await page.getByLabel('Character slot 1').getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('link', { name: /Open profile for First Character/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: /Open profile for First Character/ })).toBeVisible();

  // Deleting slot 2 leaves slot 1 alone.
  await page.getByRole('link', { name: /Open profile for First Character/ }).click();
  await page.getByRole('button', { name: 'Switch or create character', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Second Character' }).click();
  await page.getByRole('button', { name: 'Delete character', exact: true }).click();
  await expect(page.getByLabel('Character slot 2').getByText('Empty slot')).toBeVisible();
  expect((await readSlots(page)).map((s) => s.name)).toEqual(['First Character']);
});

test('a date of birth that does not fit the start year blocks the start year step', async ({ page }) => {
  await createCareer(page); // sanity: the default flow still works from the slot screen
  await page.getByRole('link', { name: /Open profile/ }).click();
  await page.getByRole('button', { name: 'Switch or create character', exact: true }).click();
  await page.getByLabel('Character slot 2').getByRole('button', { name: 'New character' }).click();
  await page.getByLabel('Full name').fill('Too Young');
  await page.getByLabel('Birth year').selectOption('2018');
  await page.getByText('Prefer not to say', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Nationality' }).fill('Thailand');
  await page.getByRole('option', { name: /Thailand/ }).click();
  await page.getByRole('combobox', { name: 'City' }).fill('Bangkok');
  await page.getByRole('option', { name: /^Bangkok/ }).first().click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/youngest allowed age is 8/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
});
