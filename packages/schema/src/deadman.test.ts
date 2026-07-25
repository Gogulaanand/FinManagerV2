import { describe, expect, it } from 'vitest';

import { DeadmanSettingsSchema, EscalationEventSchema, TrustedContactSchema } from './deadman';

const userId = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';

describe('dead-man schemas', () => {
  it('applies safe defaults to settings and contacts', () => {
    expect(DeadmanSettingsSchema.parse({ userId }).thresholdDays).toBe(30);
    expect(
      TrustedContactSchema.parse({ userId, name: 'Asha', email: 'asha@example.com' }),
    ).toMatchObject({
      disclosureScope: 'existence',
      isActive: true,
      priority: 0,
    });
  });

  it('rejects invalid disclosure scopes and unsafe thresholds', () => {
    expect(() =>
      TrustedContactSchema.parse({
        userId,
        name: 'Asha',
        email: 'asha@example.com',
        disclosureScope: 'transactions',
      }),
    ).toThrow();
    expect(() => DeadmanSettingsSchema.parse({ userId, thresholdDays: 0 })).toThrow();
  });

  it('parses an audit event with JSON detail', () => {
    const event = EscalationEventSchema.parse({
      id,
      userId,
      kind: 'disclosure',
      status: 'sent',
      recipient: 'asha@example.com',
      detail: { scope: 'existence', simulation: true },
      createdAt: '2026-07-22T00:00:00.000Z',
      sentAt: '2026-07-22T00:00:01.000Z',
    });
    expect(event.detail?.simulation).toBe(true);
  });
});
