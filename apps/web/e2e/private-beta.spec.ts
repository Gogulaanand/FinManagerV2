import { expect, test as unauthenticatedTest, type Locator, type Page } from '@playwright/test';

import { establishVercelBypass } from './auth';
import { expect as authenticatedExpect, test as authenticatedTest } from './fixtures';

type LayoutBox = { x: number; y: number; width: number; height: number };

function boxesOverlap(first: LayoutBox, second: LayoutBox): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

async function expectNoOverlap(first: Locator, second: Locator, description: string) {
  const [firstBox, secondBox] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(firstBox, `${description}: first box is measurable`).not.toBeNull();
  expect(secondBox, `${description}: second box is measurable`).not.toBeNull();
  if (!firstBox || !secondBox) throw new Error(`${description}: expected measurable boxes`);
  expect(boxesOverlap(firstBox, secondBox), description).toBe(false);
}

function flowLayoutTargets(page: Page): ReadonlyArray<readonly [string, Locator]> {
  return [
    ['spend', page.getByText('current · spend', { exact: true }).locator('..')],
    ['protect', page.getByText('current · protect', { exact: true }).locator('..')],
    ['cash flow', page.getByText('cash flow', { exact: true }).locator('..')],
    ['tax context', page.getByText('tax context', { exact: true }).locator('..')],
    ['reconciliation', page.getByText('reconciliation node', { exact: true }).locator('..')],
  ];
}

async function expectGrowCardClear(page: Page, viewport: string) {
  const growCard = page.getByText('current · grow', { exact: true }).locator('..');
  for (const [name, obstacle] of flowLayoutTargets(page)) {
    await expectNoOverlap(growCard, obstacle, `${viewport} grow card and ${name}`);
  }
}

async function flowLayoutGeometry(page: Page): Promise<LayoutBox[]> {
  const targets: ReadonlyArray<readonly [string, Locator]> = [
    ['grow', page.getByText('current · grow', { exact: true }).locator('..')],
    ...flowLayoutTargets(page),
  ];
  return Promise.all(
    targets.map(async ([name, locator]) => {
      const box = await locator.boundingBox();
      expect(box, `${name} box is measurable`).not.toBeNull();
      if (!box) throw new Error(`${name} box is not measurable`);
      return box;
    }),
  );
}

function geometryMatches(first: LayoutBox[], second: LayoutBox[]): boolean {
  return (
    first.length === second.length &&
    first.every((box, index) => {
      const other = second[index];
      if (!other) return false;
      return (
        Math.abs(box.x - other.x) < 0.01 &&
        Math.abs(box.y - other.y) < 0.01 &&
        Math.abs(box.width - other.width) < 0.01 &&
        Math.abs(box.height - other.height) < 0.01
      );
    })
  );
}

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
    await page.setViewportSize({ width: 1440, height: 900 });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/');

    const hero = page.getByRole('heading', { level: 1 });
    await expect(hero).toHaveAccessibleName("Your family's money, finally in one calm place.");
    await expect(hero).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Make it yours in three steps.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Bring a little more calm to the money conversation.' }),
    ).toBeVisible();
    const signInLinks = page.getByRole('link', { name: 'Sign in' });
    await expect(signInLinks).toHaveCount(3);
    for (const index of [0, 1, 2]) {
      await expect(signInLinks.nth(index)).toHaveAttribute('href', '/login');
    }
    await expect(page.getByRole('link', { name: 'The three currents' })).toHaveAttribute(
      'href',
      '#values',
    );
    await expect(page.getByRole('link', { name: 'How it works' }).first()).toHaveAttribute(
      'href',
      '#how-it-works',
    );
    await expect(page.getByRole('link', { name: 'Request private beta access' })).toHaveAttribute(
      'href',
      '#request-access',
    );
    await expect(page.getByRole('link', { name: 'Privacy & data' })).toHaveAttribute(
      'href',
      '/privacy',
    );

    for (const current of ['01 / Spend', '02 / Protect', '03 / Grow']) {
      await expect(page.getByText(current, { exact: true })).toBeVisible();
    }
    for (const metric of [
      '₹3,42,000',
      '₹2,80,000',
      '₹62,000',
      '₹1,12,000',
      '₹85,000',
      '₹11,08,200',
      '₹1,45,000',
      '−₹82,600',
      '₹62,400',
    ]) {
      await expect(page.getByText(metric, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText(/FIRE 2035/).first()).toBeVisible();
    await expect(page.getByText(/₹18,42,600/).first()).toBeVisible();

    await expect(
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).resolves.toBe(true);
    await expect(page.locator('main[data-reveal]')).toHaveCSS('opacity', '1');
    await expectGrowCardClear(page, 'desktop');
    await page.getByRole('button', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveClass(/light/);
    await expect(page.locator('main[data-reveal]')).toHaveCSS('opacity', '1');
    const lightGeometry = await flowLayoutGeometry(page);
    await page.screenshot({ path: '/tmp/braided-horizons-desktop-light.png', fullPage: true });

    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('main[data-reveal]')).toHaveCSS('opacity', '1');
    const darkGeometry = await flowLayoutGeometry(page);
    if (!geometryMatches(lightGeometry, darkGeometry)) {
      await page.screenshot({ path: '/tmp/braided-horizons-desktop-dark.png', fullPage: true });
    }

    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
    expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([]);
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

    const totalInflowBox = await page.getByText('₹3,42,000', { exact: true }).boundingBox();
    const primarySourceLabelBox = await page
      .getByText('source · primary', { exact: true })
      .boundingBox();
    const secondarySourceLabelBox = await page
      .getByText('source · secondary', { exact: true })
      .boundingBox();
    expect(totalInflowBox).not.toBeNull();
    expect(primarySourceLabelBox).not.toBeNull();
    expect(secondarySourceLabelBox).not.toBeNull();
    if (!totalInflowBox || !primarySourceLabelBox || !secondarySourceLabelBox) {
      throw new Error('Expected mobile flow metric boxes to be measurable');
    }
    expect(boxesOverlap(totalInflowBox, primarySourceLabelBox)).toBe(false);
    expect(boxesOverlap(totalInflowBox, secondarySourceLabelBox)).toBe(false);
    await expectGrowCardClear(page, 'mobile');
    await expect(page.locator('main[data-reveal]')).toHaveCSS('opacity', '1');
    await page.getByRole('button', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveClass(/light/);
    await expect(page.locator('main[data-reveal]')).toHaveCSS('opacity', '1');
    const lightGeometry = await flowLayoutGeometry(page);
    await page.screenshot({ path: '/tmp/braided-horizons-mobile-light.png', fullPage: true });
    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('main[data-reveal]')).toHaveCSS('opacity', '1');
    const darkGeometry = await flowLayoutGeometry(page);
    if (!geometryMatches(lightGeometry, darkGeometry)) {
      await page.screenshot({ path: '/tmp/braided-horizons-mobile-dark.png', fullPage: true });
    }

    const form = page.locator('form');
    await page.getByLabel('Email address').fill('not-an-email');
    await form.getByRole('button', { name: 'Request access' }).click();
    const invalidMessage = page.getByText('Enter a valid email address.', { exact: true });
    await expect(invalidMessage).toHaveAttribute('role', 'alert');
    await expect(invalidMessage).toBeVisible();
    await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Email address').fill('  beta@example.invalid ');
    await form.getByRole('button', { name: 'Request access' }).click();
    await expect(page.getByRole('status')).toHaveText(/your request is on file/i);
    await expect(page.getByText('Enter a valid email address.', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Email address')).toHaveValue('');
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
    await authenticatedExpect(page.getByRole('link', { name: 'Open dashboard' })).toHaveCount(2);
    await authenticatedExpect(
      page.getByRole('link', { name: 'Open dashboard' }).first(),
    ).toHaveAttribute('href', '/dashboard');
    await authenticatedExpect(
      page.getByRole('link', { name: 'Open dashboard' }).last(),
    ).toHaveAttribute('href', '/dashboard');
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
