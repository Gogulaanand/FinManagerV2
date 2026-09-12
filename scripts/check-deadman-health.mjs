import { pathToFileURL } from 'node:url';

export function assertHealthyRun(row, now = Date.now()) {
  if (!row || !Number.isFinite(Date.parse(row.ran_at)))
    throw new Error('No valid inactivity cron outcome found.');
  const age = now - Date.parse(row.ran_at);
  if (age < -5 * 60 * 1000 || age >= 24 * 60 * 60 * 1000)
    throw new Error('Latest inactivity cron outcome is stale or has an invalid timestamp.');
  if (
    !Number.isInteger(row.enabled) ||
    row.enabled < 0 ||
    row.failed !== 0 ||
    row.processed !== row.enabled
  )
    throw new Error('Inactivity cron did not successfully process every enabled account.');
  return `Inactivity cron healthy at ${row.ran_at}; ${row.processed} accounts processed.`;
}

export async function checkHealth(env = process.env, request = fetch) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase health-check configuration is missing.');
  const endpoint = new URL('/rest/v1/cron_runs', url);
  endpoint.search = new URLSearchParams({
    select: 'ran_at,enabled,processed,failed',
    job_name: 'eq.deadman-daily',
    order: 'ran_at.desc',
    limit: '1',
  }).toString();
  const response = await request(endpoint, {
    headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Inactivity health lookup failed (${response.status}).`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Invalid inactivity health response.');
  return assertHealthyRun(rows[0]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(await checkHealth());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
