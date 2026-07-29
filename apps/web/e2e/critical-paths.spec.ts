import { expect, test } from '@playwright/test';

import { signIn } from './auth';

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('seeded account exposes the scale, portfolio, and goals fixtures', async ({ page }) => {
  await page.goto('/expenses');
  await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible();
  await expect(page.getByText('50 of 120 this month')).toBeVisible();
  await page.getByRole('button', { name: 'Load more (showing 50 of 120)' }).click();
  await expect(page.getByText('100 of 120 this month')).toBeVisible();
  await page.getByRole('button', { name: 'Load more (showing 100 of 120)' }).click();
  await expect(page.getByText('120 of 120 this month')).toBeVisible();
  await expect(page.getByText('E2E Grocery 120')).toBeVisible();

  await page.goto('/portfolio');
  await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
  await expect(page.getByText('E2E Index Fund')).toBeVisible();
  await expect(page.getByText('Portfolio XIRR')).toBeVisible();

  await page.goto('/goals');
  await expect(page.getByRole('heading', { name: 'Goals & FIRE' })).toBeVisible();
  await expect(page.getByText('E2E Education Goal')).toBeVisible();
  await expect(page.getByText('FIRE number', { exact: true })).toBeVisible();
});

test('month navigation and seeded overspend remain visible at scale', async ({ page }) => {
  await page.goto('/expenses');
  const currentMonth = page.getByRole('button', { expanded: false }).filter({ hasText: /20\d{2}/ });
  const currentLabel = await currentMonth.textContent();
  const budgetSummary = page.getByRole('list', { name: 'Budget status summary' });
  await expect(budgetSummary.getByText('Overspent', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('progressbar', { name: 'Food & Dining budget progress' }),
  ).toHaveAttribute('aria-valuenow', '100');

  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByText('0 of 0 this month')).toBeVisible();
  if (currentLabel) await expect(page.getByRole('button', { name: currentLabel })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByText('50 of 120 this month')).toBeVisible();
});

test('strict expense template deduplicates the second import', async ({ page }) => {
  await page.goto('/expenses');
  await expect(page.getByLabel('Category', { exact: true })).toBeEnabled();
  const uniqueAmount = `${Date.now() % 100000}.37`;
  const template = {
    name: 'phase9-template.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`date,category,amount,type\n2020-01-01,Food,${uniqueAmount},expense\n`),
  };
  await page.locator('input[type="file"]').nth(1).setInputFiles(template);
  await expect(page.getByText('1 valid rows, 0 errors, 0 categories to create.')).toBeVisible();

  await page.getByRole('button', { name: 'Import template rows' }).click();
  await expect(
    page.getByText('1 CSV rows imported; 0 duplicates skipped; 0 failed.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Import template rows' }).click();
  await expect(
    page.getByText('0 CSV rows imported; 1 duplicates skipped; 0 failed.'),
  ).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'New regime' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Old regime' })).toBeVisible();
});
