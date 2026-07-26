import { expect, test } from '@playwright/test';

import { signIn } from './auth';

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('dashboard exposes real allocation and category badges from the seeded account', async ({
  page,
}) => {
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Asset allocation', { exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Asset allocation details' })).toContainText(
    'Equity',
  );
  await expect(page.getByRole('list', { name: 'Asset allocation details' })).toContainText('Gold');
  await expect(page.getByLabel('Equity asset class')).toBeVisible();
  await expect(page.getByLabel('Gold asset class')).toBeVisible();
  await expect(page.getByLabel('Food & Dining category')).toBeVisible();
  await expect(page.getByLabel('E2E Legacy custom category')).toBeVisible();
});

test('expense charts expose formatted legends and keyboard-readable summaries', async ({
  page,
}) => {
  await page.goto('/expenses');
  await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible();

  const categoryLegend = page.getByRole('list', { name: 'Category spending legend' });
  await expect(categoryLegend).toContainText('Food & Dining');
  await expect(categoryLegend).toContainText(/₹\s?7,200/);
  await expect(categoryLegend.getByLabel('E2E Legacy custom category')).toBeVisible();

  const trend = page.getByRole('figure', { name: 'Monthly income and spending trend' });
  await trend.focus();
  await expect(trend).toBeFocused();
  await expect(page.getByText(/income ₹\s?1,50,000.*spent ₹\s?27,054/i)).toBeVisible();

  const budgetSummary = page.getByRole('list', { name: 'Budget status summary' });
  await expect(budgetSummary).toContainText('Food & Dining');
  await expect(budgetSummary).toContainText('Overspent');
});

test('custom and imported categories use the semantic fallback badge', async ({ page }) => {
  await page.goto('/expenses');
  const categoryName = `E2E Custom ${Date.now()}`;
  await page.getByLabel('Category name').fill(categoryName);
  await page.getByRole('button', { name: 'Add category' }).click();

  await expect(page.getByLabel(`${categoryName} category`)).toBeVisible();
  await expect(page.getByLabel('E2E Imported category category')).toBeVisible();

  const customRow = page.getByLabel(`${categoryName} category`).locator('..');
  page.once('dialog', (dialog) => dialog.accept());
  await customRow.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText(categoryName, { exact: true })).toHaveCount(0);
});

test('AI Insights retains saved content and reports offline, allowance, and server errors', async ({
  page,
  context,
}) => {
  await page.goto('/insights');
  await expect(page.getByText('Monthly health', { exact: true })).toBeVisible();
  await expect(page.getByText(/Income covers spending/)).toBeVisible();

  await context.setOffline(true);
  await page.getByRole('button', { name: /How is my overall financial health/ }).click();
  await expect(page.getByText(/Connect to the internet|Chat is offline/i)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByPlaceholder('Ask about your finances')).toBeEnabled();

  await page.route('**/functions/v1/ai-insights', async (route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'budget_exceeded',
        message: 'Monthly AI allowance used. Try again next month.',
      }),
    });
  });
  await page.getByPlaceholder('Ask about your finances').fill('Check my allowance');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Monthly allowance used')).toBeVisible();
  await page.unroute('**/functions/v1/ai-insights');

  await page.route('**/functions/v1/ai-insights', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'provider_error', message: 'Provider unavailable.' }),
    });
  });
  await page.getByPlaceholder('Ask about your finances').fill('Try once more');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Could not answer')).toBeVisible();
});

test('dead-man settings hydrate and preview an unsaved draft without sending email', async ({
  page,
}) => {
  let deliveryCalls = 0;
  await page.route('**/functions/v1/deadman-check', async (route) => {
    deliveryCalls += 1;
    await route.abort();
  });

  await page.goto('/settings');
  await expect(page.getByText('Inactivity monitor enabled')).toBeVisible();
  await expect(page.getByLabel('Inactivity threshold')).toHaveValue('30');
  await expect(page.getByText('E2E Trusted Contact')).toBeVisible();

  const note = 'E2E unsaved local preview note';
  await page.getByLabel('Disclosure note').fill(note);
  await page.getByRole('button', { name: 'Preview notices' }).click();
  await expect(page.getByText('Local notice preview')).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: note })).toBeVisible();
  expect(deliveryCalls).toBe(0);
});
