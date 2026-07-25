import { describe, expect, it } from 'vitest';

import {
  daysSince,
  daysUntilNextStage,
  describeDays,
  dueStages,
  hasCurrentEvent,
  presentableSummary,
  summaryLabel,
} from './logic';

const settings = { threshold_days: 30 };
const activity = '2026-07-23T00:00:00.000Z';
const recipient = 'user@example.com';

describe('dead-man escalation logic', () => {
  it('calculates inactivity using completed UTC days and clamps future activity to zero', () => {
    const now = Date.parse('2026-07-25T12:00:00.000Z');
    expect(daysSince('2026-07-23T00:00:00.000Z', now)).toBe(2);
    expect(daysSince('2026-07-26T00:00:00.000Z', now)).toBe(0);
  });

  it('selects each stage only at its configured boundary', () => {
    expect(dueStages(settings, 29)).toEqual([]);
    expect(dueStages(settings, 30)).toEqual(['reminder_1']);
    expect(dueStages(settings, 37)).toEqual(['reminder_1', 'reminder_2']);
    expect(dueStages(settings, 44)).toEqual(['reminder_1', 'reminder_2', 'reminder_3']);
    expect(dueStages(settings, 51)).toEqual([
      'reminder_1',
      'reminder_2',
      'reminder_3',
      'disclosure',
    ]);
  });

  it('suppresses fresh sent events newer than activity but retries failures and stale pending rows', () => {
    const now = Date.parse('2026-07-24T00:00:00.000Z');
    expect(
      hasCurrentEvent(
        [{ kind: 'reminder_1', status: 'sent', recipient, created_at: '2026-07-23T12:00:00.000Z' }],
        'reminder_1',
        recipient,
        activity,
        now,
      ),
    ).toBe(true);
    expect(
      hasCurrentEvent(
        [
          {
            kind: 'reminder_1',
            status: 'failed',
            recipient,
            created_at: '2026-07-23T12:00:00.000Z',
          },
        ],
        'reminder_1',
        recipient,
        activity,
        now,
      ),
    ).toBe(false);
    expect(
      hasCurrentEvent(
        [
          {
            kind: 'reminder_1',
            status: 'pending',
            recipient,
            created_at: '2026-07-22T00:00:00.000Z',
          },
        ],
        'reminder_1',
        recipient,
        activity,
        now,
      ),
    ).toBe(false);
  });

  it('detects an existing cancellation only when the recipient matches the stored row', () => {
    const now = Date.parse('2026-07-24T00:00:00.000Z');
    const cancelled = [
      { kind: 'cancelled', status: 'sent', recipient, created_at: '2026-07-23T12:00:00.000Z' },
    ];
    // The caller must pass the same recipient used when the cancellation was written
    // (user.email); passing null never matches, so the guard would re-fire every run.
    expect(hasCurrentEvent(cancelled, 'cancelled', recipient, activity, now)).toBe(true);
    expect(hasCurrentEvent(cancelled, 'cancelled', null, activity, now)).toBe(false);
  });

  it('agrees in number so a reminder never reads "1 days"', () => {
    expect(describeDays(1)).toBe('1 day');
    expect(describeDays(0)).toBe('0 days');
    expect(describeDays(15)).toBe('15 days');
  });

  it('counts forward from current inactivity, not the successor threshold', () => {
    const oneDay = { threshold_days: 1 };
    // At the moment reminder_1 fires, the next reminder is a week away - the
    // earlier copy said "in 8 days" here, which is the absolute threshold.
    expect(daysUntilNextStage(oneDay, 'reminder_1', 1)).toBe(7);
    expect(daysUntilNextStage(oneDay, 'reminder_2', 8)).toBe(7);
    expect(daysUntilNextStage(oneDay, 'reminder_3', 15)).toBe(7);
    expect(daysUntilNextStage(oneDay, 'disclosure', 22)).toBeNull();
  });

  it('never leaks an internal namespacing key into a disclosure', () => {
    // The live 2026-07-25 disclosure read "account:bank: INR 80,000".
    expect(summaryLabel({ source: 'account', type: 'bank', value: 1 })).toBe('Bank accounts');
    expect(summaryLabel({ source: 'holding', type: 'mutual_fund', value: 1 })).toBe('Mutual funds');
    // Holdings and accounts both have `cash` and must stay distinguishable.
    expect(summaryLabel({ source: 'holding', type: 'cash', value: 1 })).toBe('Cash');
    expect(summaryLabel({ source: 'account', type: 'cash', value: 1 })).toBe('Cash on hand');
    // An unmapped type degrades to something readable, never a raw key.
    expect(summaryLabel({ source: 'holding', type: 'sovereign_bond', value: 1 })).toBe(
      'Sovereign bond',
    );
  });

  it('omits empty asset classes and leads with the largest', () => {
    const entries = [
      { source: 'holding', type: 'stock', value: 0 } as const,
      { source: 'account', type: 'bank', value: 80_000 } as const,
      { source: 'holding', type: 'gold', value: 250_000 } as const,
    ];
    expect(presentableSummary(entries)).toEqual([
      { label: 'Gold', value: 250_000 },
      { label: 'Bank accounts', value: 80_000 },
    ]);
    // Everything empty yields nothing, so the caller can say so explicitly
    // rather than printing a list of zeroes.
    expect(presentableSummary([{ source: 'holding', type: 'stock', value: 0 }])).toEqual([]);
  });

  it('never promises a deadline in the past when a reminder fires late', () => {
    // Cron missed a day: inactivity is already past the successor's threshold.
    expect(daysUntilNextStage({ threshold_days: 1 }, 'reminder_1', 10)).toBe(0);
    expect(daysUntilNextStage({ threshold_days: 30 }, 'reminder_1', 34)).toBe(3);
  });
});
