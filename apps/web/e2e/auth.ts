import { expect, type Page } from '@playwright/test';

import { requiredEnv } from './env';

export async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(requiredEnv('E2E_USER_EMAIL'));
  await page.getByLabel('Password').fill(requiredEnv('E2E_USER_PASSWORD'));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/');
}
