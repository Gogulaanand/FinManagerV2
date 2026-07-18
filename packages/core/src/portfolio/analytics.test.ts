import { describe, expect, it } from 'vitest';

import type { Account, Holding, HoldingEvent, Valuation } from '@finmanager/schema';

import { calculatePortfolioSummary } from './analytics';

const holding: Holding = {
  id: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000099',
  name: 'Index fund',
  type: 'mutual_fund',
  identifier: 'INDEX',
  accountId: null,
  currency: 'INR',
  quantity: 10,
  avgCost: 100,
  currentPrice: 125,
  currentValue: 1250,
  manualPriceOverride: null,
  manualValueOverride: null,
  manualFxRateToInr: null,
  automaticPrice: null,
  automaticPriceAsOf: null,
  automaticPriceSource: null,
  automaticPriceProvider: null,
  automaticPriceFxRateToInr: null,
  metadata: null,
  isActive: true,
};

const events: HoldingEvent[] = [
  {
    id: '00000000-0000-4000-8000-000000000002',
    userId: holding.userId,
    holdingId: holding.id!,
    kind: 'buy',
    occurredOn: '2025-01-01',
    quantity: 10,
    price: 100,
    amount: -1000,
    currency: 'INR',
    fxRateToInr: 1,
    note: null,
    importHash: null,
  },
];

const valuation: Valuation = {
  id: '00000000-0000-4000-8000-000000000003',
  userId: holding.userId,
  holdingId: holding.id!,
  asOf: '2026-01-01',
  value: 1250,
  currency: 'INR',
  fxRateToInr: 1,
  source: 'manual',
};

describe('calculatePortfolioSummary', () => {
  it('aggregates invested/current value, gain, allocation, and XIRR', () => {
    const result = calculatePortfolioSummary([holding], events, [valuation]);

    expect(result.investedValue).toBe(1000);
    expect(result.currentValue).toBe(1250);
    expect(result.netWorth).toBe(1250);
    expect(result.gainLoss).toBe(250);
    expect(result.allocation).toEqual([{ assetClass: 'equity', value: 1250, percentage: 100 }]);
    expect(result.xirr.status).toBe('ok');
  });

  it('uses the latest valuation and excludes holdings without a value', () => {
    const result = calculatePortfolioSummary(
      [{ ...holding, currentValue: null, currentPrice: null }],
      events,
      [{ ...valuation, value: 1200, asOf: '2025-12-31' }, valuation],
    );

    expect(result.currentValue).toBe(1250);
    expect(result.missingValueCount).toBe(0);
  });

  it('prefers manual values, includes account balances, and marks missing FX incomplete', () => {
    const account: Account = {
      id: '00000000-0000-4000-8000-000000000004',
      userId: holding.userId,
      name: 'Salary account',
      type: 'bank',
      institution: 'Test Bank',
      currency: 'INR',
      currentBalance: 5000,
      isActive: true,
    };
    const manual = { ...holding, manualValueOverride: 1400, currentValue: 1250 };
    const manualResult = calculatePortfolioSummary([manual], events, [], [account]);
    expect(manualResult.currentValue).toBe(1400);
    expect(manualResult.netWorth).toBe(6400);

    const usdEvent = { ...events[0]!, currency: 'USD' as const, fxRateToInr: null };
    const incomplete = calculatePortfolioSummary([holding], [usdEvent], [valuation]);
    expect(incomplete.isComplete).toBe(false);
    expect(incomplete.missingFxCount).toBe(1);
  });
});
