import { afterEach, expect, it, vi } from 'vitest';
import { emailDeliveryStatus } from '../_shared/resend';
import { receiptUpdate } from './receipts';

afterEach(() => vi.unstubAllGlobals());
it('only grants warning grace on delivery evidence and retains the first confirmation time', () => {
  const now = '2026-09-07T00:00:00Z';
  expect(receiptUpdate('sent', null, now).delivered_at).toBeNull();
  expect(receiptUpdate('delivery_delayed', null, now).delivered_at).toBeNull();
  expect(receiptUpdate('delivered', null, now).delivered_at).toBe(now);
  expect(receiptUpdate('opened', '2026-09-06T00:00:00Z', now).delivered_at).toBe(
    '2026-09-06T00:00:00Z',
  );
  expect(receiptUpdate('bounced', null, now).last_error).toContain('operator action');
  expect(receiptUpdate('complained', now, now).delivered_at).toBeNull();
});
it('uses a read-only provider lookup and rejects invalid, mismatched or unavailable evidence', async () => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-key' } });
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ id: 'mail-id', last_event: 'delivered' })));
  vi.stubGlobal('fetch', fetch);
  await expect(emailDeliveryStatus('mail-id')).resolves.toBe('delivered');
  expect(fetch.mock.calls[0]?.[0]).toBe('https://api.resend.com/emails/mail-id');
  expect(fetch.mock.calls[0]?.[1]).not.toHaveProperty('body');
  fetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ id: 'other', last_event: 'delivered' })),
  );
  await expect(emailDeliveryStatus('mail-id')).rejects.toThrow('invalid delivery evidence');
  fetch.mockResolvedValueOnce(new Response('', { status: 403 }));
  await expect(emailDeliveryStatus('mail-id')).rejects.toThrow('403');
});
