import { describe, expect, it } from 'vitest';

import { daysSince, dueStages, hasCurrentEvent } from './logic';

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
});
