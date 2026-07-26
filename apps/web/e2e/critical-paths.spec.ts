import { expect, test } from '@playwright/test';

import { signIn } from './auth';

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('seeded account exposes the scale, portfolio, and goals fixtures', async ({ page }) => {
  await page.goto('/expenses');
  await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible();
  await expect(page.getByText(/of 120 this month/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Load more/ })).toBeVisible();
  await expect(page.getByText('E2E Grocery 120')).toBeVisible();

  await page.goto('/portfolio');
  await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
  await expect(page.getByText('E2E Index Fund')).toBeVisible();
  await expect(page.getByText('Portfolio XIRR')).toBeVisible();

  await page.goto('/goals');
  await expect(page.getByRole('heading', { name: 'Goals & FIRE' })).toBeVisible();
  await expect(page.getByText('E2E Education Goal')).toBeVisible();
  await expect(page.getByText('FIRE number')).toBeVisible();
});

test('expense can be added, edited, and deleted through the offline-first UI', async ({ page }) => {
  const merchant = `E2E CRUD ${Date.now()}`;
  const updatedMerchant = `${merchant} updated`;

  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page.getByLabel('Amount').fill('275');
  await page.getByLabel('Merchant').fill(merchant);
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await expect(page.getByText(merchant)).toBeVisible();

  const row = page.getByRole('listitem').filter({ hasText: merchant });
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Merchant').fill(updatedMerchant);
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await expect(page.getByText(updatedMerchant)).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('listitem')
    .filter({ hasText: updatedMerchant })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.getByText(updatedMerchant)).toHaveCount(0);
});

test('tax calculator compares regimes without network data', async ({ page }) => {
  await page.goto('/tax');
  await expect(page.getByRole('heading', { name: 'Tax' })).toBeVisible();
  await page.getByLabel('Annual CTC').fill('2400000');
  await expect(page.getByText(/regime leaves you better off/i)).toBeVisible();
  await expect(page.getByText('New regime', { exact: true })).toBeVisible();
  await expect(page.getByText('Old regime', { exact: true })).toBeVisible();
});
