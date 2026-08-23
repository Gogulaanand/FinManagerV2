import { expect, test as unauthenticatedTest } from '@playwright/test';

import { establishVercelBypass } from './auth';
import { expect as authenticatedExpect, test as authenticatedTest } from './fixtures';

const signedOutTest = unauthenticatedTest.extend({
  storageState: async ({ baseURL: _baseURL }, provide) => {
    await provide({ cookies: [], origins: [] });
  },

  page: async ({ page }, provide) => {
    await establishVercelBypass(page);
    await provide(page);
  },
});

signedOutTest(
  'signed-out visitors see the landing page without product navigation',
  async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: "Your family's money, finally in one calm place." }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Make it yours in three steps.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Bring a little more calm to the money conversation.' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toHaveAttribute(
      'href',
      '/login',
    );
    await expect(page.locator('aside')).toHaveCount(0);
    await expect(page.getByLabel('Email address')).toBeVisible();
  },
);

signedOutTest(
  'signed-out visitors can read privacy and discover it from the landing page',
  async ({ page }) => {
    await page.goto('/privacy');

    await expect(
      page.getByRole('heading', { name: 'Privacy & data, in plain language.' }),
    ).toBeVisible();
    await expect(page.getByText(/wa-sqlite backed by IndexedDB/)).toBeVisible();
    await expect(page.locator('aside')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'FinManager home page' })).toHaveAttribute(
      'href',
      '/',
    );

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Privacy & data' })).toHaveCount(1);
  },
);

signedOutTest(
  'beta request validation and generic success work at mobile width',
  async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/rest/v1/rpc/request_beta_access', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"ok":true}',
      });
    });
    await page.goto('/');

    const form = page.locator('form');
    await page.getByLabel('Email address').fill('not-an-email');
    await form.getByRole('button', { name: 'Request access' }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText('Enter a valid email address.');

    await page.getByLabel('Email address').fill('  beta@example.invalid ');
    await form.getByRole('button', { name: 'Request access' }).click();
    await expect(page.getByRole('status')).toHaveText(/your request is on file/i);
    await expect(page.locator('main[data-reveal]')).toHaveCSS('animation-name', 'none');
    await expect(
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).resolves.toBe(true);
  },
);

signedOutTest('signed-out product routes redirect to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  await page.goto('/expenses');
  await expect(page).toHaveURL(/\/login\?next=%2Fexpenses/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

signedOutTest('private-beta signup rejection is shown as friendly copy', async ({ page }) => {
  await page.route('**/auth/v1/signup', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'private_beta',
        msg: 'FinManager is currently in a private beta. Request access first, then try again after approval.',
      }),
    });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.getByLabel('Email').fill('unlisted@example.invalid');
  await page.getByLabel('Password').fill('not-a-real-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText(
    'FinManager is currently in a private beta. Request access first, then try again after approval.',
  );
});

authenticatedTest(
  'signed-in visitors see the landing at root and dashboard at /dashboard',
  async ({ page }) => {
    await page.goto('/');
    await authenticatedExpect(
      page.getByRole('heading', { name: "Your family's money, finally in one calm place." }),
    ).toBeVisible();
    await authenticatedExpect(page.locator('aside')).toHaveCount(0);

    await page.goto('/dashboard');
    await authenticatedExpect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await authenticatedExpect(page.locator('aside')).toBeVisible();
    await authenticatedExpect(
      page.getByRole('heading', { name: "Your family's money, finally in one calm place." }),
    ).toHaveCount(0);
  },
);

authenticatedTest(
  'signed-in visitors can open public privacy and discover it in Settings',
  async ({ page }) => {
    await page.goto('/privacy');
    await authenticatedExpect(
      page.getByRole('heading', { name: 'Privacy & data, in plain language.' }),
    ).toBeVisible();
    await authenticatedExpect(page.locator('aside')).toHaveCount(0);

    await page.goto('/settings');
    await authenticatedExpect(
      page.getByRole('heading', { name: 'Settings', exact: true }),
    ).toBeVisible();
    await authenticatedExpect(
      page.getByRole('link', { name: 'Read the privacy & data guide' }),
    ).toHaveAttribute('href', '/privacy');
  },
);
