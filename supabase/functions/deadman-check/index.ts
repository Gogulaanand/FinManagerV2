import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.110.7';

import { sendEmail } from '../_shared/resend.ts';
import { daysSince, dueStages, hasCurrentEvent, type Stage } from './logic.ts';

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
function html(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', '<br>');
}
function reminderContent(
  userName: string,
  kind: Stage,
  inactiveDays: number,
  thresholdDays: number,
  contactNames: string[],
): { subject: string; text: string; html: string } {
  const next =
    kind === 'reminder_1'
      ? `in ${thresholdDays + 7} days`
      : kind === 'reminder_2'
        ? `in ${thresholdDays + 14} days`
        : 'to your trusted contacts';
  const names =
    kind === 'reminder_3'
      ? ` The contacts who will receive the next message are ${contactNames.join(', ') || 'your active trusted contacts'}.`
      : '';
  const text = `Hello ${userName},\n\nFinManager inactivity reminder\n\nWe have not seen you open FinManager for ${inactiveDays} days. If you do not open the app, the next step is ${next}.${names}\n\nOpening the app cancels the escalation.`;
  return {
    subject: `FinManager inactivity reminder (${kind.replace('_', ' ')})`,
    text,
    html: html(text),
  };
}
function disclosureContent(
  userName: string,
  scope: Scope,
  note: string | null,
  summary: readonly { type: string; value: number }[],
): { subject: string; text: string; html: string } {
  const body =
    scope === 'summary'
      ? `Coarse financial summary by asset class:\n${summary.map((item) => `- ${item.type}: INR ${item.value.toLocaleString('en-IN')}`).join('\n') || '- No summary is available.'}`
      : 'Financial records exist in FinManager. Please contact the user or their chosen support person before taking any action.';
  const text = `FinManager trusted-contact notice for ${userName}\n\n${body}\n\n${note ? `Message from the user:\n${note}\n\n` : ''}This message contains no transaction history. Please handle it sensitively.`;
  return { subject: 'FinManager trusted-contact notice', text, html: html(text) };
}

async function latestActivity(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from('activity_log')
    .select('occurred_at')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.occurred_at ?? null;
}
async function summaryFor(
  admin: SupabaseClient,
  userId: string,
): Promise<{ type: string; value: number }[]> {
  const [holdings, accounts] = await Promise.all([
    admin.from('holdings').select('type,current_value').eq('user_id', userId).eq('is_active', true),
    admin
      .from('accounts')
      .select('type,current_balance')
      .eq('user_id', userId)
      .eq('is_active', true),
  ]);
  if (holdings.error) throw holdings.error;
  if (accounts.error) throw accounts.error;
  const totals = new Map<string, number>();
  for (const row of holdings.data ?? [])
    totals.set(row.type, (totals.get(row.type) ?? 0) + Number(row.current_value ?? 0));
  for (const row of accounts.data ?? [])
    totals.set(
      `account:${row.type}`,
      (totals.get(`account:${row.type}`) ?? 0) + Number(row.current_balance ?? 0),
    );
  return [...totals].map(([type, value]) => ({ type, value: Math.max(0, value) }));
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
async function eventsFor(admin: SupabaseClient, userId: string): Promise<Event[]> {
  const { data, error } = await admin
    .from('escalation_events')
    .select('id,kind,status,recipient,created_at,detail')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Event[];
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
  simulatedDays?: number,
): Promise<{ events: unknown[]; inactiveDays: number }> {
  const settings = await settingsFor(admin, user.id);
  if (!settings?.is_enabled && simulatedDays === undefined) return { events: [], inactiveDays: 0 };
  const contacts = await contactsFor(admin, user.id);
  const activity = await latestActivity(admin, user.id);
  const inactiveDays = simulatedDays ?? (activity ? daysSince(activity) : Number.MAX_SAFE_INTEGER);
  const events = await eventsFor(admin, user.id);
  if (
    activity &&
    events.some(
      (event) => event.kind !== 'cancelled' && new Date(event.created_at) < new Date(activity),
    ) &&
    !hasCurrentEvent(events, 'cancelled', user.email ?? null, activity)
  ) {
    await admin.from('escalation_events').insert({
      user_id: user.id,
      kind: 'cancelled',
      status: 'sent',
      recipient: user.email,
      detail: { reason: 'app_open' },
      sent_at: new Date().toISOString(),
    });
  }
  const output: unknown[] = [];
  const contactNames = contacts.map((contact) => contact.name);
  for (const kind of dueStages(settings ?? ({ threshold_days: 30 } as Settings), inactiveDays)) {
    if (kind === 'disclosure') {
      const summary = await summaryFor(admin, user.id);
      for (const contact of contacts) {
        if (!contact.email || hasCurrentEvent(events, kind, contact.email, activity)) continue;
        const message = disclosureContent(
          user.user_metadata?.full_name ?? user.email ?? 'your FinManager account',
          contact.disclosure_scope,
          settings?.disclosure_note ?? null,
          summary,
        );
        await deliverStage(admin, user.id, kind, contact.email, message, {
          scope: contact.disclosure_scope,
          simulation: simulatedDays !== undefined,
          contactId: contact.id,
        });
        output.push({ kind, recipient: contact.email });
      }
    } else if (user.email && !hasCurrentEvent(events, kind, user.email, activity)) {
      const message = reminderContent(
        user.user_metadata?.full_name ?? user.email,
        kind,
        inactiveDays,
        settings?.threshold_days ?? 30,
        contactNames,
      );
      await deliverStage(admin, user.id, kind, user.email, message, {
        simulation: simulatedDays !== undefined,
      });
      output.push({ kind, recipient: user.email });
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST')
    return json({ error: 'invalid_request', message: 'Use POST.' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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
    if (error) return json({ error: 'database', message: error.message }, 500);
    const results = [];
    for (const row of settingsRows ?? []) {
      const { data: userData } = await admin.auth.admin.getUserById(row.user_id);
      if (userData.user) results.push(await processUser(admin, userData.user));
    }
    return json({ mode: 'cron', processed: results.length, results });
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
  if (action === 'preview' || action === 'test_send') {
    const settings = await settingsFor(admin, user.id);
    const contacts = await contactsFor(admin, user.id);
    const summary = action === 'preview' ? await summaryFor(admin, user.id) : [];
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
    if (!Number.isInteger(days) || days < 0 || days > 3650)
      return json(
        {
          error: 'invalid_request',
          message: 'simulateInactiveDays must be an integer from 0 to 3650.',
        },
        400,
      );
    return json({ mode: 'simulate', ...(await processUser(admin, user, days)) });
  }
  return json(
    { error: 'invalid_request', message: 'Choose preview, test_send, or simulate.' },
    400,
  );
});
