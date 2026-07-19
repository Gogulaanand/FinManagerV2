import { describe, expect, it } from 'vitest';

import { expandOccurrences, monthRange, trendWindowStart } from './recurrence';

describe('month query ranges', () => {
  it('rolls December into the next year', () => {
    expect(monthRange('2025-12')).toEqual({ start: '2025-12-01', endExclusive: '2026-01-01' });
  });

  it('includes leap February in a six-month trend window', () => {
    expect(trendWindowStart('2024-07', 6)).toBe('2024-02-01');
    expect(monthRange('2024-02')).toEqual({ start: '2024-02-01', endExclusive: '2024-03-01' });
  });
});

describe('recurring transaction expansion', () => {
  it('expands monthly occurrences from a month-end source without invalid dates', () => {
    expect(
      expandOccurrences({
        recurringId: 'r',
        amount: 500,
        direction: 'debit',
        sourceDate: '2026-01-31',
        frequency: 'monthly',
        interval: 1,
        endOn: null,
        throughMonth: '2026-04',
      }).map((occurrence) => occurrence.occurredOn),
    ).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('stops at the recurrence end date', () => {
    expect(
      expandOccurrences({
        recurringId: 'r',
        amount: 500,
        direction: 'debit',
        sourceDate: '2026-07-01',
        frequency: 'weekly',
        interval: 1,
        endOn: '2026-07-15',
        throughMonth: '2026-07',
      }).map((occurrence) => occurrence.occurredOn),
    ).toEqual(['2026-07-08', '2026-07-15']);
  });
});
