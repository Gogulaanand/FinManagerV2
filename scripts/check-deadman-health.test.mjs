import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertHealthyRun, checkHealth } from './check-deadman-health.mjs';

const now = Date.parse('2026-09-07T04:15:00Z');
const row = { ran_at: '2026-09-07T03:00:00Z', enabled: 4, processed: 4, failed: 0 };
test('external watchdog rejects missing, stale, partial, failed and future outcomes', () => {
  assert.match(assertHealthyRun(row, now), /healthy/);
  for (const invalid of [
    null,
    { ...row, ran_at: 'invalid' },
    { ...row, ran_at: '2026-09-06T03:00:00Z' },
    { ...row, processed: 3 },
    { ...row, failed: 1 },
    { ...row, ran_at: '2026-09-08T03:00:00Z' },
  ])
    assert.throws(() => assertHealthyRun(invalid, now));
});
test('provider outage and credential failures fail the independent check without exposing secrets', async () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid',
    SUPABASE_SECRET_KEY: 'private-test-key',
  };
  await assert.rejects(
    checkHealth(env, async (url, options) => {
      assert.equal(url.pathname, '/rest/v1/cron_runs');
      assert.equal(options.headers.apikey, 'private-test-key');
      assert.equal(options.method, undefined);
      return new Response('', { status: 503 });
    }),
    /503/,
  );
  await assert.rejects(
    checkHealth({}, async () => {
      throw new Error('Must not connect');
    }),
    /configuration/,
  );
});
