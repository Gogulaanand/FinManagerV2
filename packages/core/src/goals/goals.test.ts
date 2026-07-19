import type { Goal } from '@finmanager/schema';
import { describe, expect, it } from 'vitest';

import { makeHolding } from './fixtures.js';
import { calculateGoalProjection, requiredMonthlySip, sumLinkedHoldingValue } from './goals.js';
import { growthFactor, yearsBetween } from './time.js';

const uuid = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`;

function makeGoal(overrides: Partial<Goal> & Pick<Goal, 'name' | 'kind' | 'targetAmount'>): Goal {
  return {
    targetDate: null,
    currentAmount: 0,
    expectedReturn: null,
    inflation: null,
    linkedHoldingIds: [],
    notes: null,
    ...overrides,
  };
}

describe('requiredMonthlySip', () => {
  it('returns zero when there is no gap', () => {
    expect(requiredMonthlySip(0, 12, 10)).toBe(0);
    expect(requiredMonthlySip(-500, 12, 10)).toBe(0);
  });

  it('splits the gap evenly when the return is zero', () => {
    expect(requiredMonthlySip(120_000, 0, 1)).toBe(10_000);
  });

  it('requires the whole gap up front when the horizon is non-positive', () => {
    expect(requiredMonthlySip(50_000, 12, 0)).toBe(50_000);
  });

  it('grows the annuity to exactly the gap', () => {
    const sip = requiredMonthlySip(1_000_000, 12, 10);
    const months = 120;
    const rate = 0.12 / 12;
    const futureValue = sip * ((Math.pow(1 + rate, months) - 1) / rate);
    expect(futureValue).toBeCloseTo(1_000_000, -1);
  });
});

describe('sumLinkedHoldingValue', () => {
  it('sums effective INR values for linked holdings only', () => {
    const holdings = [
      makeHolding({ id: uuid(1), currentValue: 200_000 }),
      makeHolding({ id: uuid(2), currentValue: 300_000 }),
      makeHolding({ id: uuid(3), currentValue: 999_999 }),
    ];
    const result = sumLinkedHoldingValue([uuid(1), uuid(2)], holdings, []);
    expect(result.value).toBe(500_000);
    expect(result.missingValueCount).toBe(0);
    expect(result.missingFxCount).toBe(0);
  });

  it('counts an unvalued linked holding instead of treating it as zero', () => {
    const holdings = [makeHolding({ id: uuid(1) })];
    const result = sumLinkedHoldingValue([uuid(1)], holdings, []);
    expect(result.value).toBe(0);
    expect(result.missingValueCount).toBe(1);
  });
});

describe('calculateGoalProjection', () => {
  it('marks an already-funded undated goal as achieved with no SIP', () => {
    const projection = calculateGoalProjection(
      makeGoal({
        name: 'Emergency',
        kind: 'custom',
        targetAmount: 100_000,
        currentAmount: 200_000,
      }),
    );
    expect(projection.status).toBe('achieved');
    expect(projection.gap).toBe(0);
    expect(projection.requiredMonthlySip).toBe(0);
    expect(projection.years).toBe(0);
  });

  it('inflates the target and requires a SIP when underfunded', () => {
    const asOf = '2025-01-01';
    const targetDate = '2035-01-01';
    const years = yearsBetween(asOf, targetDate);
    const projection = calculateGoalProjection(
      makeGoal({
        name: 'Child education',
        kind: 'education',
        targetAmount: 1_000_000,
        targetDate,
        currentAmount: 0,
        expectedReturn: 12,
        inflation: 6,
      }),
      { asOf },
    );
    expect(projection.inflatedTarget).toBeCloseTo(1_000_000 * growthFactor(6, years), 0);
    expect(projection.projectedValue).toBe(0);
    expect(projection.gap).toBeCloseTo(projection.inflatedTarget, 0);
    expect(projection.requiredMonthlySip).toBeGreaterThan(0);
    expect(projection.status).toBe('off_track');
  });

  it('is on track when current funding grows past the inflated target', () => {
    const projection = calculateGoalProjection(
      makeGoal({
        name: 'Marriage',
        kind: 'marriage',
        targetAmount: 1_000_000,
        targetDate: '2035-01-01',
        currentAmount: 900_000,
        expectedReturn: 12,
        inflation: 6,
      }),
      { asOf: '2025-01-01' },
    );
    expect(projection.gap).toBe(0);
    expect(projection.requiredMonthlySip).toBe(0);
    expect(projection.status).toBe('on_track');
    expect(projection.surplus).toBeGreaterThan(0);
  });

  it('folds linked holdings into current funding', () => {
    const holdings = [makeHolding({ id: uuid(4), currentValue: 500_000 })];
    const projection = calculateGoalProjection(
      makeGoal({
        name: 'Foreign studies',
        kind: 'foreign_studies',
        targetAmount: 2_000_000,
        currentAmount: 100_000,
        linkedHoldingIds: [uuid(4)],
      }),
      { holdings },
    );
    expect(projection.currentFunding).toBe(600_000);
  });

  it('falls back to default rates when the goal omits them', () => {
    const projection = calculateGoalProjection(
      makeGoal({ name: 'x', kind: 'custom', targetAmount: 1, targetDate: '2035-01-01' }),
      { asOf: '2025-01-01' },
    );
    expect(projection.expectedReturn).toBe(12);
    expect(projection.inflation).toBe(6);
  });
});
