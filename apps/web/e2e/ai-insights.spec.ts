import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import { requiredEnv } from './env';

async function authorization(): Promise<{ accessToken: string; anonKey: string; url: string }> {
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: requiredEnv('E2E_USER_EMAIL'),
    password: requiredEnv('E2E_USER_PASSWORD'),
  });
  if (error || !data.session) throw error ?? new Error('E2E sign-in returned no session');
  return { accessToken: data.session.access_token, anonKey, url };
}

test('AI Insights rejects invalid scope before provider usage', async ({ request }) => {
  const auth = await authorization();
  const response = await request.post(`${auth.url}/functions/v1/ai-insights`, {
    headers: { Authorization: `Bearer ${auth.accessToken}`, apikey: auth.anonKey },
    data: { mode: 'chat', scope: 'invalid', question: 'Never call a provider', digest: {} },
  });
  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({ error: 'invalid_request' });
});

test('AI Insights rejects an exhausted allowance before provider usage', async ({ request }) => {
  const auth = await authorization();
  const response = await request.post(`${auth.url}/functions/v1/ai-insights`, {
    headers: { Authorization: `Bearer ${auth.accessToken}`, apikey: auth.anonKey },
    data: {
      mode: 'chat',
      scope: 'everything',
      question: 'Never call a provider',
      digest: { generatedAt: new Date().toISOString() },
    },
  });
  expect(response.status()).toBe(429);
  await expect(response.json()).resolves.toMatchObject({ error: 'budget_exceeded' });
});
