import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.110.7';

import { publishableKey, secretKey } from '../_shared/keys.ts';
import { summaryFor } from './summary.ts';
import { deliverOnce } from './delivery.ts';
import { sendEmail } from '../_shared/resend.ts';
import {
  buildDisclosureMessage,
  buildReminderMessage,
  type SummaryEntry,
} from '../../../packages/core/src/deadman/messages.ts';
import { daysSince, dueStages, hasCurrentEvent, nextStageAfterGrace, type Stage } from './logic.ts';

type Scope = 'existence' | 'summary';
type Contact = {
  id: string;
  name: string;
  email: string | null;
  relationship: string | null;
  disclosure_scope: Scope;
  is_active: boolean;
  priority: number;
};
type Settings = {
  user_id: string;
  is_enabled: boolean;
  threshold_days: number;
  disclosure_note: string | null;
};
type Event = {
  id: string;
  kind: string;
  status: string;
  recipient: string | null;
  created_at: string;
  sent_at: string | null;
  detail: Record<string, unknown> | null;
};

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
};
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function reminderContent(
  userName: string,
  kind: Stage,
  inactiveDays: number,
  thresholdDays: number,
  contactNames: string[],
): { subject: string; text: string; html: string } {
  return buildReminderMessage({
    userName,
    stage: kind,
    inactiveDays,
    thresholdDays,
    contactNames,
    nextActionDays: 7,
  });
}
function disclosureContent(
  userName: string,
  scope: Scope,
  note: string | null,
  summary: readonly SummaryEntry[],
): { subject: string; text: string; html: string } {
  return buildDisclosureMessage({ userName, scope, note, summary });
}

async function runtimeFor(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from('deadman_runtime')
    .select('armed_at,last_check_in_at,cycle_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    armed_at: string | null;
    last_check_in_at: string | null;
    cycle_id: string;
  } | null;
}
async function settingsFor(admin: SupabaseClient, userId: string): Promise<Settings | null> {
  const { data, error } = await admin
    .from('deadman_settings')
    .select('user_id,is_enabled,threshold_days,disclosure_note')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Settings | null;
}
async function contactsFor(admin: SupabaseClient, userId: string): Promise<Contact[]> {
  const { data, error } = await admin
    .from('trusted_contacts')
    .select('id,name,email,relationship,disclosure_scope,is_active,priority')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('priority')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Contact[];
}
async function deliverStage(
  admin: SupabaseClient,
  userId: string,
  stage: Stage,
  recipient: string,
  message: { subject: string; text: string; html: string },
  detail: Record<string, unknown>,
): Promise<void> {
  const { data: pending, error: insertError } = await admin
    .from('escalation_events')
    .insert({ user_id: userId, kind: stage, status: 'pending', recipient, detail })
    .select('id')
    .single();
  if (insertError) throw insertError;
  try {
    await sendEmail({ to: recipient, ...message });
    const { error } = await admin
      .from('escalation_events')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', pending.id);
    if (error) throw error;
  } catch (error) {
    await admin
      .from('escalation_events')
      .update({ status: 'failed', detail: { ...detail, error: String(error) } })
      .eq('id', pending.id);
    throw error;
  }
}
async function processUser(
  admin: SupabaseClient,
  user: User,
): Promise<{ events: unknown[]; inactiveDays: number }> {
  const settings = await settingsFor(admin, user.id);
  if (!settings?.is_enabled) return { events: [], inactiveDays: 0 };
  const contacts = await contactsFor(admin, user.id);
  const runtime = await runtimeFor(admin, user.id);
  const activity = runtime?.armed_at ? runtime.last_check_in_at : null;
  if (!activity || !Number.isFinite(Date.parse(activity)))
    throw new Error('Server-confirmed activity is required before inactivity processing.');
  const inactiveDays = daysSince(activity);
  const { data: deliveries, error: deliveryError } = await admin
    .from('deadman_deliveries')
    .select('kind,status,recipient,created_at,sent_at')
    .eq('user_id', user.id)
    .eq('cycle_id', runtime!.cycle_id);
  if (deliveryError) throw deliveryError;
  const events = (deliveries ?? []) as Event[];
  const output: unknown[] = [];
  const contactNames = contacts.map((contact) => contact.name);
  const nextStage = user.email ? nextStageAfterGrace(settings, activity, events, user.email) : null;
  for (const kind of nextStage ? [nextStage] : []) {
    if (kind === 'disclosure') {
      const currentSettings = await settingsFor(admin, user.id);
      const currentActivity = (await runtimeFor(admin, user.id))?.last_check_in_at;
      if (!currentSettings?.is_enabled || currentActivity !== activity)
        return { events: output, inactiveDays };
      const summary = contacts.some((contact) => contact.disclosure_scope === 'summary')
        ? await summaryFor(admin, user.id)
        : [];
      for (const contact of contacts) {
        if (
          !contact.email ||
          hasCurrentEvent(
            events.filter((event) => event.status === 'sent'),
            kind,
            contact.email,
            activity,
          )
        )
          continue;
        const message = disclosureContent(
          user.user_metadata?.full_name ?? user.email ?? 'your FinManager account',
          contact.disclosure_scope,
          settings?.disclosure_note ?? null,
          summary,
        );
        const result = await deliverOnce(admin, {
          userId: user.id,
          cycleId: runtime!.cycle_id,
          stage: kind,
          recipient: contact.email,
          message,
        });
        if (result === 'sent') output.push({ kind, recipient: contact.email });
      }
    } else if (
      user.email &&
      !hasCurrentEvent(
        events.filter((event) => event.status === 'sent'),
        kind,
        user.email,
        activity,
      )
    ) {
      const message = reminderContent(
        user.user_metadata?.full_name ?? user.email,
        kind,
        inactiveDays,
        settings?.threshold_days ?? 30,
        contactNames,
      );
      const result = await deliverOnce(admin, {
        userId: user.id,
        cycleId: runtime!.cycle_id,
        stage: kind,
        recipient: user.email,
        message,
      });
      if (result === 'sent') output.push({ kind, recipient: user.email });
    }
  }
  return { events: output, inactiveDays };
}

async function authenticate(request: Request, url: string, anonKey: string): Promise<User | null> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data } = await client.auth.getUser();
  return data.user ?? null;
}

async function recordCronRun(
  admin: SupabaseClient,
  outcome: {
    enabled: number;
    processed: number;
    failed: number;
    results: unknown[];
    failures: unknown[];
  },
): Promise<void> {
  const { error } = await admin.from('cron_runs').insert({
    job_name: 'deadman-daily',
    enabled: outcome.enabled,
    processed: outcome.processed,
    failed: outcome.failed,
    detail: { results: outcome.results, failures: outcome.failures },
  });
  if (error) throw error;
}

async function pingHeartbeat(): Promise<void> {
  const heartbeatUrl = Deno.env.get('DEADMAN_HEARTBEAT_URL');
  if (!heartbeatUrl) return;
  try {
    await fetch(heartbeatUrl, { signal: AbortSignal.timeout(5_000) });
  } catch (error) {
    // A heartbeat provider outage must not turn a clean escalation run into a
    // failure. The missed ping will still be visible to that provider.
    console.error(`deadman-check: heartbeat failed: ${String(error)}`);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST')
    return json({ error: 'invalid_request', message: 'Use POST.' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = publishableKey();
  const serviceKey = secretKey();
  if (!url || !anonKey || !serviceKey)
    return json({ error: 'upstream', message: 'Dead-man switch is not configured.' }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const cronSecret = Deno.env.get('CRON_SECRET');
  const isCron = Boolean(cronSecret && request.headers.get('x-cron-secret') === cronSecret);
  if (isCron) {
    const { data: settingsRows, error } = await admin
      .from('deadman_settings')
      .select('user_id')
      .eq('is_enabled', true);
    if (error) {
      const outcome = {
        enabled: 0,
        processed: 0,
        failed: 1,
        results: [],
        failures: [{ stage: 'load_settings', message: error.message }],
      };
      try {
        await recordCronRun(admin, outcome);
      } catch (recordError) {
        console.error(`deadman-check: could not record failed run: ${String(recordError)}`);
      }
      return json({ mode: 'cron', ...outcome }, 500);
    }
    const enabled = settingsRows ?? [];
    const results = [];
    const failures: { userId: string; message: string }[] = [];
    for (const row of enabled) {
      // A user we cannot process is a silent non-escalation - no email, no
      // ledger row, nothing. That is the worst failure this feature has, so it
      // must never be reported as a clean run: collect it and fail the request.
      try {
        const { data: userData, error: userError } = await admin.auth.admin.getUserById(
          row.user_id,
        );
        if (userError) throw userError;
        if (!userData.user) throw new Error('no auth user record');
        results.push(await processUser(admin, userData.user));
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        console.error(`deadman-check: skipped user ${row.user_id}: ${message}`);
        failures.push({ userId: row.user_id, message });
      }
    }
    const outcome = {
      enabled: enabled.length,
      processed: results.length,
      failed: failures.length,
      results,
      failures,
    };
    try {
      await recordCronRun(admin, outcome);
    } catch (recordError) {
      console.error(`deadman-check: could not record run: ${String(recordError)}`);
      return json(
        {
          mode: 'cron',
          ...outcome,
          error: 'cron_run_not_recorded',
          message: String(recordError),
        },
        500,
      );
    }
    if (failures.length === 0) await pingHeartbeat();
    return json({ mode: 'cron', ...outcome }, failures.length > 0 ? 500 : 200);
  }
  const user = await authenticate(request, url, anonKey);
  if (!user)
    return json({ error: 'unauthorized', message: 'Sign in to manage the dead-man switch.' }, 401);
  let body: { action?: string; simulateInactiveDays?: number } = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_request', message: 'The request body must be valid JSON.' }, 400);
  }
  const action = body.action;
  if (action === 'status') {
    const state = await runtimeFor(admin, user.id);
    return json({
      armedAt: state?.armed_at ?? null,
      lastCheckInAt: state?.last_check_in_at ?? null,
    });
  }
  if (action === 'preview' || action === 'test_send') {
    const settings = await settingsFor(admin, user.id);
    const contacts = await contactsFor(admin, user.id);
    const summary =
      action === 'preview' && contacts.some((contact) => contact.disclosure_scope === 'summary')
        ? await summaryFor(admin, user.id)
        : [];
    const previews = contacts
      .filter((contact) => contact.email)
      .map((contact) => ({
        contactId: contact.id,
        recipient: contact.email,
        scope: contact.disclosure_scope,
        ...disclosureContent(
          user.user_metadata?.full_name ?? user.email ?? 'your FinManager account',
          contact.disclosure_scope,
          settings?.disclosure_note ?? null,
          summary,
        ),
      }));
    if (action === 'test_send') {
      if (!user.email)
        return json(
          { error: 'invalid_request', message: 'Your account has no email address.' },
          400,
        );
      const message = disclosureContent(
        user.user_metadata?.full_name ?? user.email,
        'existence',
        settings?.disclosure_note ?? null,
        [],
      );
      await deliverStage(admin, user.id, 'disclosure', user.email, message, {
        simulation: true,
        testSend: true,
      });
    }
    return json({ previews });
  }
  if (action === 'simulate') {
    const days = body.simulateInactiveDays;
    if (typeof days !== 'number' || !Number.isInteger(days) || days < 0 || days > 3650)
      return json(
        {
          error: 'invalid_request',
          message: 'simulateInactiveDays must be an integer from 0 to 3650.',
        },
        400,
      );
    const settings = await settingsFor(admin, user.id);
    const plannedStages = settings?.is_enabled ? dueStages(settings, days!) : [];
    return json({
      mode: 'simulate',
      dryRun: true,
      inactiveDays: days,
      plannedStages,
      events: [],
      message:
        'Hypothetical schedule only. No email, activity or escalation records were written. Delivery remains subject to server-confirmed arming and warning grace.',
    });
  }
  return json(
    { error: 'invalid_request', message: 'Choose preview, test_send, or simulate.' },
    400,
  );
});
