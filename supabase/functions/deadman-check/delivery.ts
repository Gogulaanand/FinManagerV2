import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.7';
import { sendEmail, type EmailMessage } from '../_shared/resend.ts';

export async function deliverOnce(
  admin: SupabaseClient,
  input: {
    userId: string;
    cycleId: string;
    stage: string;
    recipient: string;
    message: Omit<EmailMessage, 'to'>;
  },
): Promise<'sent' | 'cancelled'> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(
      `${input.userId}:${input.cycleId}:${input.stage}:${input.recipient.toLowerCase()}`,
    ),
  );
  const key = `deadman/${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  const { error: claimError } = await admin.from('deadman_deliveries').upsert(
    {
      delivery_key: key,
      user_id: input.userId,
      cycle_id: input.cycleId,
      kind: input.stage,
      recipient: input.recipient,
      payload: { to: input.recipient, ...input.message },
    },
    { onConflict: 'delivery_key', ignoreDuplicates: true },
  );
  if (claimError) throw claimError;
  const { data: claim, error } = await admin
    .from('deadman_deliveries')
    .select('*')
    .eq('delivery_key', key)
    .single();
  if (error || !claim) throw error ?? new Error('Delivery claim missing');
  if (claim.status === 'sent') return 'sent';
  // Never blindly resend after the provider has forgotten the key. Operator reconciliation is required.
  if (
    Date.now() - Date.parse(claim.created_at) >= 23 * 60 * 60 * 1000 ||
    claim.status === 'attention'
  ) {
    await admin
      .from('deadman_deliveries')
      .update({
        status: 'attention',
        last_error: 'Provider retry window expired; reconcile before any further send.',
      })
      .eq('delivery_key', key)
      .neq('status', 'sent');
    throw new Error('Delivery needs operator reconciliation; automatic retry refused.');
  }
  // Recheck server state immediately before calling the provider.
  const { data: runtime, error: runtimeError } = await admin
    .from('deadman_runtime')
    .select('armed_at,cycle_id')
    .eq('user_id', input.userId)
    .single();
  if (runtimeError) throw runtimeError;
  if (!runtime?.armed_at || runtime.cycle_id !== input.cycleId) return 'cancelled';
  const providerId = await sendEmail(claim.payload as EmailMessage, key);
  const { error: recordError } = await admin
    .from('deadman_deliveries')
    .update({ status: 'sent', provider_id: providerId, sent_at: new Date().toISOString() })
    .eq('delivery_key', key);
  if (recordError) throw recordError;
  // History is a display mirror; scheduling trusts only the server-controlled delivery row.
  const { error: historyError } = await admin.from('escalation_events').upsert(
    {
      user_id: input.userId,
      kind: input.stage,
      status: 'sent',
      recipient: input.recipient,
      delivery_key: key,
      sent_at: new Date().toISOString(),
      detail: { cycleId: input.cycleId, providerId },
    },
    { onConflict: 'delivery_key', ignoreDuplicates: true },
  );
  if (historyError) console.error('Delivery history mirror could not be recorded.');
  return 'sent';
}
