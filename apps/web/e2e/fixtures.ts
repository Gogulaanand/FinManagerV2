import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, test as base } from '@playwright/test';

import { signIn } from './auth';

type WorkerFixtures = {
  workerStorageState: string;
};

// PowerSync stores the web database in IndexedDB. Prime it once per worker and
// restore that state into each test's otherwise isolated browser context. This
// keeps the Preview E2E workflow enabled while avoiding a full initial sync for
// every page test.
export const test = base.extend<{}, WorkerFixtures>({
  storageState: ({ workerStorageState }, provide) => provide(workerStorageState),

  workerStorageState: [
    async ({ browser }, use, workerInfo) => {
      const fileName = path.resolve(
        workerInfo.project.outputDir,
        'e2e-auth',
        `${workerInfo.parallelIndex}.json`,
      );
      await fs.mkdir(path.dirname(fileName), { recursive: true });

      const baseURL = workerInfo.project.use.baseURL;
      if (!baseURL) throw new Error('Playwright baseURL is required for the E2E setup fixture');
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await signIn(page);

      // These routes exercise the main auto-subscribed tables before the
      // IndexedDB snapshot is captured. The full PowerSync stream is still
      // synced in the background, but these checks make the setup wait for the
      // seeded data needed by the page tests.
      await page.goto('/expenses');
      await expect(page.getByText('50 of 120 this month')).toBeVisible();
      await page.goto('/portfolio');
      await expect(page.getByText('E2E Index Fund')).toBeVisible();
      await page.goto('/goals');
      await expect(page.getByText('E2E Education Goal')).toBeVisible();

      await context.storageState({ path: fileName, indexedDB: true });
      await context.close();
      await use(fileName);
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
