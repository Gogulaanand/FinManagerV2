import { describe, expect, it } from 'vitest';

import {
  HoldingEventSchema,
  HoldingSchema,
  PortfolioImportRowSchema,
  ValuationSchema,
  type HoldingType,
} from './portfolio';

const holding = {
  name: 'HDFC Index Fund',
  type: 'mutual_fund' as const,
  identifier: 'INF179K01BB8',
  accountId: null,
  currency: 'INR' as const,
  quantity: 100,
  avgCost: 250,
  currentPrice: 285,
  currentValue: 28500,
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

function metadataFor(type: HoldingType) {
  if (type === 'rsu' || type === 'esop') {
    return {
      kind: type,
      grantDate: '2024-01-15',
      grantPrice: 10,
      sourceCurrency: 'USD' as const,
      vestSchedule: [{ date: '2026-01-15', quantity: 25, vested: true }],
    };
  }
  if (type === 'real_estate') {
    return {
      kind: 'real_estate' as const,
      purchaseDate: '2020-01-01',
      location: 'Pune',
      areaSqFt: 900,
      valuationSource: 'manual',
    };
  }
  if (type === 'epf' || type === 'ppf' || type === 'nps') {
    return {
      kind: type,
      accountNumberMasked: 'XXXX1234',
      employer: 'Acme',
      annualInterestRate: 8.15,
      lastUpdatedOn: '2026-07-01',
    };
  }
  return null;
}

describe('HoldingSchema', () => {
  it('accepts every supported asset type with correlated metadata', () => {
    const types = [
      'mutual_fund',
      'stock',
      'foreign_stock',
      'rsu',
      'esop',
      'epf',
      'ppf',
      'nps',
      'fd',
      'real_estate',
      'gold',
      'crypto',
      'cash',
    ] as const;

    for (const type of types) {
      expect(
        HoldingSchema.parse({ ...holding, name: type, type, metadata: metadataFor(type) }).type,
      ).toBe(type);
    }
  });

  it('validates RSU INR conversion metadata and rejects unknown fields', () => {
    const result = HoldingSchema.parse({
      ...holding,
      name: 'Acme RSUs',
      type: 'rsu',
      currency: 'USD',
      metadata: {
        kind: 'rsu',
        grantDate: '2024-01-15',
        grantPrice: 10,
        sourceCurrency: 'USD',
        vestSchedule: [{ date: '2026-01-15', quantity: 25, vested: true }],
      },
    });

    expect(result.metadata?.kind).toBe('rsu');
    expect(() => HoldingSchema.parse({ ...holding, unexpected: true })).toThrow();
  });

  it('rejects negative quantities, values, and missing special metadata', () => {
    expect(() => HoldingSchema.parse({ ...holding, quantity: -1 })).toThrow();
    expect(() => HoldingSchema.parse({ ...holding, currentValue: -1 })).toThrow();
    expect(() =>
      HoldingSchema.parse({ ...holding, type: 'real_estate', metadata: null }),
    ).toThrow();
  });
});

describe('HoldingEventSchema', () => {
  const base = {
    holdingId: '00000000-0000-4000-8000-000000000001',
    occurredOn: '2025-01-01',
    quantity: 10,
    price: 100,
    currency: 'INR' as const,
    fxRateToInr: 1,
    note: 'Initial purchase',
    importHash: null,
  };

  it('enforces signed cash-flow semantics and allows zero only for vest', () => {
    expect(HoldingEventSchema.parse({ ...base, kind: 'buy', amount: -1000 }).amount).toBe(-1000);
    expect(HoldingEventSchema.parse({ ...base, kind: 'vest', amount: 0 }).amount).toBe(0);
    expect(() => HoldingEventSchema.parse({ ...base, kind: 'buy', amount: 1000 })).toThrow();
    expect(() => HoldingEventSchema.parse({ ...base, kind: 'dividend', amount: -100 })).toThrow();
    expect(() => HoldingEventSchema.parse({ ...base, kind: 'vest', amount: 1 })).toThrow();
    expect(() =>
      HoldingEventSchema.parse({
        ...base,
        kind: 'buy',
        amount: -100,
        currency: 'USD',
        fxRateToInr: null,
      }),
    ).toThrow();
  });
});

describe('ValuationSchema and PortfolioImportRowSchema', () => {
  it('requires a positive manual valuation with dated FX', () => {
    expect(() =>
      ValuationSchema.parse({
        holdingId: '00000000-0000-4000-8000-000000000001',
        asOf: '2026-07-18',
        value: 0,
        currency: 'USD',
        fxRateToInr: null,
      }),
    ).toThrow();
    expect(() =>
      ValuationSchema.parse({
        holdingId: '00000000-0000-4000-8000-000000000001',
        asOf: '2026-07-18',
        value: 100,
        currency: 'USD',
        fxRateToInr: null,
      }),
    ).toThrow();
    expect(
      ValuationSchema.parse({
        holdingId: '00000000-0000-4000-8000-000000000001',
        asOf: '2026-07-18',
        value: 100,
        currency: 'USD',
        fxRateToInr: 83,
      }).fxRateToInr,
    ).toBe(83);
  });

  it('normalizes a broker import row while retaining its canonical hash', () => {
    const row = PortfolioImportRowSchema.parse({
      source: 'zerodha',
      accountId: null,
      name: 'Reliance Industries',
      type: 'stock',
      identifier: 'RELIANCE',
      currency: 'INR',
      occurredOn: '2026-07-17',
      kind: 'buy',
      quantity: 2,
      price: 1450,
      amount: -2900,
      fxRateToInr: 1,
      note: 'CNC',
      importHash: 'zerodha:2026-07-17:RELIANCE:2:-2900',
    });
    expect(row.source).toBe('zerodha');
    expect(row.amount).toBe(-2900);
  });
});
