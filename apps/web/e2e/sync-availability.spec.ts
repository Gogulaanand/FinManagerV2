import fs from 'node:fs/promises';

import { expect, test } from './fixtures';

// Reuse only the disposable test account's authenticated session. Removing the
// fixture's IndexedDB snapshot reproduces a first visit with no financial data.
test('an unavailable first sync exposes recovery instead of zeros or endless skeletons', async ({
  browser,
  workerStorageState,
  baseURL,
}) => {
  const syncUrl = process.env.NEXT_PUBLIC_POWERSYNC_URL;
  test.skip(!syncUrl, 'NEXT_PUBLIC_POWERSYNC_URL is needed to block the configured sync provider.');
  const state = JSON.parse(await fs.readFile(workerStorageState, 'utf8'));
  const context = await browser.newContext({
    ...(baseURL ? { baseURL } : {}),
    storageState: {
      cookies: state.cookies,
      origins: state.origins.map(
        (origin: { origin: string; localStorage: { name: string; value: string }[] }) => ({
          origin: origin.origin,
          localStorage: origin.localStorage,
        }),
      ),
    },
  });
  try {
    const syncHost = new URL(syncUrl!).host;
    await context.route(
      (url) => url.host === syncHost,
      (route) => route.abort(),
    );
    await context.routeWebSocket(
      (url) => url.host === syncHost,
      (socket) => socket.close(),
    );
    // SharedWorker network traffic can bypass Playwright context routing.
    // Block its script too, so this test cannot silently complete a real sync.
    const syncWorker = '**/@powersync/worker/SharedSyncImplementation.umd.js*';
    await context.route(syncWorker, (route) => route.abort());
    const page = await context.newPage();
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Open sync settings' })).toBeVisible();
    await expect(page.getByText('Your data is not available yet.', { exact: false })).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByText('Total net worth', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Loading dashboard')).toHaveCount(0);
    for (const destination of ['expenses', 'portfolio', 'goals']) {
      await page.goto(`/${destination}`);
      await expect(page.getByRole('link', { name: 'Open sync settings' })).toBeVisible();
      await expect(
        page.getByText('Financial totals are unavailable', { exact: false }),
      ).toBeVisible();
    }
    await page.getByRole('link', { name: 'Open sync settings' }).click();
    await expect(page.getByText('Sync health', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry sync', exact: true })).toBeVisible();

    await context.unrouteAll();
    await page.goto('/dashboard');
    await expect(page.getByText('Total net worth', { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText('Your data is not available yet.', { exact: false })).toHaveCount(
      0,
    );
  } finally {
    await context.close();
  }
});
