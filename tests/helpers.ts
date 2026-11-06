import { expect, type Page } from '@playwright/test';

export async function createCareer(page: Page) {
  await page.goto('/');
  await page.getByLabel('Full name').fill('Browser Test Player');
  await page.getByText('Prefer not to say', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Nationality' }).fill('Thailand');
  await page.getByRole('option', { name: /Thailand/ }).click();
  await page.getByRole('combobox', { name: 'City' }).fill('Bangkok');
  await page.getByRole('option', { name: /^Bangkok/ }).first().click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Create career', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Train', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Train', exact: true }).click();
}

