import { describe, expect, it } from 'vitest';

import { makeHolding } from './fixtures.js';
import { calculateRetirementCorpus } from './retirement.js';

const uuid = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`;

describe('calculateRetirementCorpus', () => {
  const holdings = [
    makeHolding({ id: uuid(1), name: 'EPF', type: 'epf', currentValue: 500_000 }),
    makeHolding({ id: uuid(2), name: 'PPF', type: 'ppf', currentValue: 300_000 }),
    makeHolding({ id: uuid(3), name: 'NPS', type: 'nps' }), // unvalued
    makeHolding({ id: uuid(4), name: 'Index Fund', type: 'mutual_fund', currentValue: 1_000_000 }),
  ];

  it('sums EPF/PPF/NPS holdings and counts unvalued ones', () => {
    const corpus = calculateRetirementCorpus(holdings, []);
    expect(corpus.total).toBe(800_000);
    expect(corpus.missingValueCount).toBe(1);
    expect(corpus.byType[0]).toEqual({ type: 'epf', value: 500_000 });
    expect(corpus.rows).toHaveLength(2);
  });

  it('excludes ordinary investment holdings by default', () => {
    const corpus = calculateRetirementCorpus(holdings, []);
    expect(corpus.rows.some((row) => row.type === 'mutual_fund')).toBe(false);
  });

  it('folds in explicitly earmarked investment holdings', () => {
    const corpus = calculateRetirementCorpus(holdings, [], { extraHoldingIds: [uuid(4)] });
    expect(corpus.total).toBe(1_800_000);
    expect(corpus.rows.some((row) => row.type === 'mutual_fund')).toBe(true);
  });

  it('ignores inactive holdings', () => {
    const withInactive = [
      ...holdings,
      makeHolding({
        id: uuid(5),
        name: 'Old EPF',
        type: 'epf',
        currentValue: 999_999,
        isActive: false,
      }),
    ];
    const corpus = calculateRetirementCorpus(withInactive, []);
    expect(corpus.total).toBe(800_000);
  });
});
