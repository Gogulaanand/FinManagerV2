import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.7';
import { emailDeliveryStatus } from '../_shared/resend.ts';

export type DeliveryReceipt = {
  delivery_key: string;
  status: string;
  provider_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  delivery_status: string | null;
};

export function receiptUpdate(event: string, confirmedAt: string | null, now: string) {
  const delivered = ['delivered', 'opened', 'clicked'].includes(event);
  const failed = ['bounced', 'complained', 'failed', 'suppressed', 'canceled'].includes(event);
  return {
    delivery_status: event,
    delivered_at: delivered ? (confirmedAt ?? now) : null,
    last_error: failed
      ? 'Provider reported unsuccessful delivery; operator action required.'
      : null,
  };
}

export async function verifyDeliveryReceipts(admin: SupabaseClient, rows: DeliveryReceipt[]) {
  for (const row of rows) {
    if (row.status !== 'sent' || row.delivered_at) continue;
    if (!row.provider_id) throw new Error('Sent delivery has no provider reference.');
    // Keep this private-beta poll below the provider's default two requests per second.
    await new Promise((resolve) => setTimeout(resolve, 600));
    const event = await emailDeliveryStatus(row.provider_id);
    const update = receiptUpdate(event, row.delivered_at, new Date().toISOString());
    const { error } = await admin
      .from('deadman_deliveries')
      .update(update)
      .eq('delivery_key', row.delivery_key)
      .is('delivered_at', null);
    if (error) throw error;
    Object.assign(row, update);
    if (update.last_error) throw new Error(update.last_error);
    if (!update.delivered_at && (!row.sent_at || Date.now() - Date.parse(row.sent_at) >= 86400000))
      throw new Error('Delivery still unconfirmed after 24 hours; escalation held.');
  }
}
