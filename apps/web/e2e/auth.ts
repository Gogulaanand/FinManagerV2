import { expect, type Page } from '@playwright/test';

import { requiredEnv } from './env';

async function establishVercelBypass(page: Page): Promise<void> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!secret) return;

  const response = await page.request.get('/', {
    headers: {
      'x-vercel-protection-bypass': secret,
      'x-vercel-set-bypass-cookie': 'true',
    },
  });
  if (!response.ok()) {
    throw new Error(`Vercel automation bypass failed with HTTP ${response.status()}`);
  }
}

export async function signIn(page: Page): Promise<void> {
  await establishVercelBypass(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill(requiredEnv('E2E_USER_EMAIL'));
  await page.getByLabel('Password').fill(requiredEnv('E2E_USER_PASSWORD'));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/');
}
