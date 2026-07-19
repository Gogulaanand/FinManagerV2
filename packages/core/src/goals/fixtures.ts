import type { Holding, HoldingType, Valuation } from '@finmanager/schema';

/** Builds an INR holding with sensible nulls; override only what a test needs. */
export function makeHolding(overrides: Partial<Holding> & { id: string }): Holding {
  return {
    userId: undefined,
    name: overrides.name ?? 'Holding',
    type: (overrides.type ?? 'mutual_fund') as HoldingType,
    identifier: null,
    accountId: null,
    currency: 'INR',
    quantity: 0,
    avgCost: null,
    currentPrice: null,
    currentValue: null,
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
    ...overrides,
  };
}

export function makeValuation(overrides: Partial<Valuation> & { holdingId: string }): Valuation {
  return {
    userId: undefined,
    asOf: '2026-01-01',
    value: 0,
    currency: 'INR',
    fxRateToInr: null,
    source: null,
    ...overrides,
  };
}
