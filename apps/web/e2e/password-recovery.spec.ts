import { expect, test } from '@playwright/test';

import { establishVercelBypass } from './auth';

// Intercept the recovery endpoint: these UI checks must never send real email.
test('password recovery stays public and acknowledges without revealing account existence', async ({
  page,
}) => {
  let requested = false;
  await page.route('**/auth/v1/recover*', async (route) => {
    requested = true;
    expect(route.request().postDataJSON().email).toBe('recovery-test@example.invalid');
    expect(new URL(route.request().url()).searchParams.get('redirect_to')).toContain(
      '/reset-password',
    );
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  // Pass deployment protection without signing into the application.
  await establishVercelBypass(page);
  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill('recovery-test@example.invalid');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('If this address has an eligible account');
  expect(requested).toBe(true);
  await page.goto('/reset-password');
  await expect(page.getByRole('link', { name: 'Request a new reset link' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update password' })).toHaveCount(0);
});
