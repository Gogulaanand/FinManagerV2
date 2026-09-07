import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverOnce } from './delivery';
import { sendEmail } from '../_shared/resend';

vi.mock('../_shared/resend.ts', () => ({ sendEmail: vi.fn() }));
const input = {
  userId: 'owner',
  cycleId: 'cycle',
  stage: 'reminder_1',
  recipient: 'owner@example.invalid',
  message: { subject: 'Reminder', text: 'Check in', html: 'Check in' },
};
function database() {
  let claim: Record<string, unknown> | null = null;
  let armed = true;
  let failRecord = false;
  const from = (table: string) => {
    let update: Record<string, unknown> | undefined;
    let insert: Record<string, unknown> | undefined;
    const query = {
      upsert(value: Record<string, unknown>) {
        insert = value;
        return query;
      },
      update(value: Record<string, unknown>) {
        update = value;
        return query;
      },
      select() {
        return query;
      },
      eq() {
        return query;
      },
      neq() {
        return query;
      },
      single() {
        return query;
      },
      then(resolve: (value: unknown) => unknown) {
        if (table === 'deadman_runtime')
          return Promise.resolve(
            resolve({ data: { armed_at: armed ? 'now' : null, cycle_id: 'cycle' }, error: null }),
          );
        if (table === 'deadman_deliveries') {
          if (insert && !claim)
            claim = { ...insert, status: 'pending', created_at: new Date().toISOString() };
          if (update && failRecord) {
            failRecord = false;
            return Promise.resolve(resolve({ error: new Error('commit unavailable') }));
          }
          if (update && claim) Object.assign(claim, update);
          return Promise.resolve(resolve({ data: claim, error: null }));
        }
        return Promise.resolve(resolve({ error: null }));
      },
    };
    return query;
  };
  return {
    admin: { from } as unknown as Parameters<typeof deliverOnce>[0],
    disarm: () => {
      armed = false;
    },
    failNextRecord: () => {
      failRecord = true;
    },
    expire: () => {
      claim!.created_at = '2000-01-01T00:00:00Z';
    },
  };
}
afterEach(() => vi.resetAllMocks());
describe('durable delivery claim', () => {
  it('retries a lost commit with the identical provider key and original payload, then skips committed sends', async () => {
    const db = database();
    vi.mocked(sendEmail).mockResolvedValue('provider-1');
    db.failNextRecord();
    await expect(deliverOnce(db.admin, input)).rejects.toThrow('commit unavailable');
    await expect(
      deliverOnce(db.admin, { ...input, message: { ...input.message, text: 'Changed later' } }),
    ).resolves.toBe('sent');
    expect(vi.mocked(sendEmail).mock.calls[1]).toEqual(vi.mocked(sendEmail).mock.calls[0]);
    await deliverOnce(db.admin, input);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
  it('refuses uncertain retries outside the provider retention window', async () => {
    const db = database();
    vi.mocked(sendEmail).mockRejectedValue(new Error('timeout'));
    await expect(deliverOnce(db.admin, input)).rejects.toThrow('timeout');
    db.expire();
    await expect(deliverOnce(db.admin, input)).rejects.toThrow('operator reconciliation');
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
  it('does not send or report delivery after server disarming', async () => {
    const db = database();
    db.disarm();
    await expect(deliverOnce(db.admin, input)).resolves.toBe('cancelled');
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
