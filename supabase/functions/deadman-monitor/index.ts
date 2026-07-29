import { createClient } from 'npm:@supabase/supabase-js@2.110.7';

import { secretKey } from '../_shared/keys.ts';
import { sendEmail } from '../_shared/resend.ts';

const MAX_RUN_AGE_HOURS = 25;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret)
    return json({ error: 'Unauthorized.' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = secretKey();
  const ownerEmail = Deno.env.get('DEADMAN_MONITOR_EMAIL');
  if (!url || !serviceKey || !ownerEmail)
    return json({ error: 'Monitor environment is incomplete.' }, 500);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: latest, error } = await admin
    .from('cron_runs')
    .select('id,ran_at,enabled,processed,failed,detail,alert_sent_at')
    .eq('job_name', 'deadman-daily')
    .order('ran_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);

  const ageHours = latest
    ? (Date.now() - new Date(latest.ran_at).getTime()) / (60 * 60 * 1000)
    : Number.POSITIVE_INFINITY;
  const unhealthy = !latest || latest.failed > 0 || ageHours > MAX_RUN_AGE_HOURS;
  if (!unhealthy || latest?.alert_sent_at)
    return json({ status: unhealthy ? 'already_alerted' : 'healthy', ageHours });

  const reason = !latest
    ? 'No dead-man cron outcome exists.'
    : latest.failed > 0
      ? `${latest.failed} of ${latest.enabled} enabled accounts failed.`
      : `The latest outcome is ${ageHours.toFixed(1)} hours old.`;
  await sendEmail({
    to: ownerEmail,
    subject: 'FinManager dead-man monitor needs attention',
    text: `${reason}\n\nLatest detail:\n${JSON.stringify(latest?.detail ?? {}, null, 2)}`,
    html: `<p>${reason}</p><p>Open Supabase and inspect the latest <code>cron_runs</code> row.</p>`,
  });

  if (latest) {
    const { error: updateError } = await admin
      .from('cron_runs')
      .update({ alert_sent_at: new Date().toISOString() })
      .eq('id', latest.id);
    if (updateError) return json({ error: updateError.message }, 500);
  }
  return json({ status: 'alerted', reason });
});
