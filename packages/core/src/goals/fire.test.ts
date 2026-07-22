import type { FireSettings } from '@finmanager/schema';
import { describe, expect, it } from 'vitest';

import {
  averageMonthlySavings,
  calculateFireProjection,
  monthlyExpenseTotals,
  suggestAnnualExpenses,
  swrMultiplier,
} from './fire.js';

function makeSettings(overrides: Partial<FireSettings> = {}): FireSettings {
  return {
    annualExpenses: 1_200_000,
    withdrawalRate: 4,
    expectedReturn: null,
    inflation: null,
    currentAge: null,
    retirementAge: null,
    leanMultiplier: null,
    fatMultiplier: null,
    monthlyInvestment: null,
    ...overrides,
  };
}

describe('calculateFireProjection', () => {
  it('computes the FIRE number as expenses divided by the withdrawal rate', () => {
    const projection = calculateFireProjection({ settings: makeSettings(), currentCorpus: 0 });
    expect(projection.fireNumber).toBe(30_000_000);
    expect(projection.leanNumber).toBe(21_000_000);
    expect(projection.fatNumber).toBe(45_000_000);
  });

  it('marks FIRE achieved when the corpus meets the number', () => {
    const projection = calculateFireProjection({
      settings: makeSettings(),
      currentCorpus: 30_000_000,
    });
    expect(projection.status).toBe('achieved');
    expect(projection.progress).toBe(1);
    expect(projection.monthsToFire).toBe(0);
  });

  it('solves months linearly when the real return is zero', () => {
    // expectedReturn == inflation -> real return 0, so it is pure accumulation.
    const projection = calculateFireProjection({
      settings: makeSettings({
        expectedReturn: 6,
        inflation: 6,
        currentAge: 30,
        retirementAge: 60,
      }),
      currentCorpus: 10_000_000,
      monthlyContribution: 100_000,
    });
    expect(projection.realReturnRate).toBeCloseTo(0, 10);
    // (30,000,000 - 10,000,000) / 100,000 = 200 months.
    expect(projection.monthsToFire).toBe(200);
    expect(projection.yearsToFire).toBeCloseTo(200 / 12, 6);
    expect(projection.fireAge).toBeCloseTo(30 + 200 / 12, 6);
    expect(projection.status).toBe('on_track');
  });

  it('coasts when the real return is zero: coast number equals the FIRE number', () => {
    const projection = calculateFireProjection({
      settings: makeSettings({
        expectedReturn: 6,
        inflation: 6,
        currentAge: 30,
        retirementAge: 55,
      }),
      currentCorpus: 30_000_000,
    });
    expect(projection.coastNumber).toBe(30_000_000);
    expect(projection.coastAchieved).toBe(true);
  });

  it('reaches FIRE sooner with a positive real return than without', () => {
    const withGrowth = calculateFireProjection({
      settings: makeSettings({ expectedReturn: 12, inflation: 6 }),
      currentCorpus: 10_000_000,
      monthlyContribution: 100_000,
    });
    const noGrowth = calculateFireProjection({
      settings: makeSettings({ expectedReturn: 6, inflation: 6 }),
      currentCorpus: 10_000_000,
      monthlyContribution: 100_000,
    });
    expect(withGrowth.monthsToFire).not.toBeNull();
    expect(noGrowth.monthsToFire).not.toBeNull();
    expect(withGrowth.monthsToFire!).toBeLessThan(noGrowth.monthsToFire!);
  });

  it('is off track and unreachable with no growth and no savings', () => {
    const projection = calculateFireProjection({
      settings: makeSettings({ expectedReturn: 6, inflation: 6 }),
      currentCorpus: 5_000_000,
      monthlyContribution: 0,
    });
    expect(projection.monthsToFire).toBeNull();
    expect(projection.status).toBe('off_track');
  });

  it('returns a zero FIRE number when expenses are unknown', () => {
    const projection = calculateFireProjection({
      settings: makeSettings({ annualExpenses: null }),
      currentCorpus: 1_000_000,
    });
    expect(projection.fireNumber).toBe(0);
    expect(projection.status).toBe('off_track');
  });

  it('has no required contribution without a retirement horizon', () => {
    const projection = calculateFireProjection({
      settings: makeSettings({ expectedReturn: 12, inflation: 6 }),
      currentCorpus: 5_000_000,
      monthlyContribution: 50_000,
    });
    expect(projection.requiredMonthlyContribution).toBeNull();
    expect(projection.contributionGap).toBeNull();
  });

  it('solves the required contribution linearly when the real return is zero', () => {
    const projection = calculateFireProjection({
      settings: makeSettings({
        expectedReturn: 6,
        inflation: 6,
        currentAge: 30,
        retirementAge: 55, // 300 months to grow the corpus into the FIRE number.
      }),
      currentCorpus: 10_000_000,
      monthlyContribution: 40_000,
    });
    // (30,000,000 - 10,000,000) / 300 months = 66,666.67 per month.
    expect(projection.realReturnRate).toBeCloseTo(0, 10);
    expect(projection.requiredMonthlyContribution).toBeCloseTo(66_666.67, 2);
    // Gap is required minus the current 40,000 savings rate.
    expect(projection.contributionGap).toBeCloseTo(26_666.67, 2);
  });

  it('funds the required contribution: corpus plus that SIP reaches FIRE by retirement', () => {
    const settings = makeSettings({
      expectedReturn: 12,
      inflation: 6,
      currentAge: 30,
      retirementAge: 60,
    });
    const projection = calculateFireProjection({ settings, currentCorpus: 5_000_000 });
    const required = projection.requiredMonthlyContribution;
    expect(required).not.toBeNull();
    // Feeding the solved SIP back in must reach FIRE within the 360-month horizon.
    const funded = calculateFireProjection({
      settings,
      currentCorpus: 5_000_000,
      monthlyContribution: required!,
    });
    expect(funded.monthsToFire).not.toBeNull();
    expect(funded.monthsToFire!).toBeLessThanOrEqual(360);
  });

  it('reports zero required contribution when growth alone clears the target', () => {
    const projection = calculateFireProjection({
      settings: makeSettings({
        expectedReturn: 12,
        inflation: 6,
        currentAge: 30,
        retirementAge: 60,
      }),
      // A large corpus compounds past the FIRE number on its own over 30 years.
      currentCorpus: 20_000_000,
      monthlyContribution: 10_000,
    });
    expect(projection.requiredMonthlyContribution).toBe(0);
    // Current savings already exceed the (zero) requirement, so no shortfall.
    expect(projection.contributionGap).toBeLessThanOrEqual(0);
  });
});

describe('suggestAnnualExpenses', () => {
  it('annualises the average monthly spend', () => {
    expect(suggestAnnualExpenses([50_000, 60_000, 40_000])).toBe(600_000);
  });

  it('returns null with no data', () => {
    expect(suggestAnnualExpenses([])).toBeNull();
  });
});

describe('monthly expense and savings helpers', () => {
  const transactions = [
    { direction: 'debit', amount: 100, occurredOn: '2026-07-02' },
    { direction: 'credit', amount: 500, occurredOn: '2026-07-08' },
    { direction: 'debit', amount: 50, occurredOn: '2026-06-02' },
    { direction: 'credit', amount: 200, occurredOn: '2026-06-08' },
  ] as const;

  it('groups the latest debit months and limits the window', () => {
    expect(monthlyExpenseTotals(transactions, 1)).toEqual([100]);
  });

  it('averages monthly net savings and floors negative results at zero', () => {
    expect(averageMonthlySavings(transactions)).toBe(275);
    expect(
      averageMonthlySavings([{ direction: 'debit', amount: 100, occurredOn: '2026-07-02' }]),
    ).toBe(0);
  });

  it('converts a withdrawal rate to its FIRE multiplier', () => {
    expect(swrMultiplier(4)).toBe(25);
    expect(swrMultiplier(0)).toBe(0);
  });
});
