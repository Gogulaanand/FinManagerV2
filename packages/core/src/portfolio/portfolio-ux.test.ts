import { HoldingTypeSchema, type HoldingEvent, type Valuation } from '@finmanager/schema';
import { describe, expect, it } from 'vitest';

import {
  EVENT_KIND_LABELS,
  allowedEventKinds,
  mergeHoldingTimeline,
  showsQuantityPrice,
} from '../portfolio-ux.js';

describe('portfolio UX helpers', () => {
  it('provides plain-language labels for every holding event kind', () => {
    expect(EVENT_KIND_LABELS).toEqual({
      buy: 'Invested more',
      sell: 'Sold',
      vest: 'Shares vested',
      exercise: 'Options exercised',
      dividend: 'Dividend received',
      interest: 'Interest received',
      contribution: 'Contribution',
      withdrawal: 'Withdrawal',
    });
  });

  it('returns a non-empty enum subset for every asset type', () => {
    const allKinds = new Set(Object.keys(EVENT_KIND_LABELS));
    for (const assetType of HoldingTypeSchema.options) {
      const kinds = allowedEventKinds(assetType);
      expect(kinds.length, assetType).toBeGreaterThan(0);
      expect(
        kinds.every((kind) => allKinds.has(kind)),
        assetType,
      ).toBe(true);
    }
  });

  it('shows quantity and price for unit-priced assets only', () => {
    expect(HoldingTypeSchema.options.filter((type) => showsQuantityPrice(type))).toEqual([
      'mutual_fund',
      'stock',
      'foreign_stock',
      'rsu',
      'esop',
    ]);
  });

  it('merges events and valuations newest-first with entry tags', () => {
    const event = {
      id: '00000000-0000-4000-8000-000000000001',
      holdingId: '00000000-0000-4000-8000-000000000010',
      kind: 'buy',
      occurredOn: '2026-02-01',
      quantity: 1,
      price: 100,
      amount: -100,
      currency: 'INR',
      fxRateToInr: null,
      note: null,
      importHash: null,
    } satisfies HoldingEvent;
    const valuation = {
      id: '00000000-0000-4000-8000-000000000002',
      holdingId: event.holdingId,
      asOf: '2026-03-01',
      value: 120,
      currency: 'INR',
      fxRateToInr: null,
      source: null,
    } satisfies Valuation;

    expect(mergeHoldingTimeline([event], [valuation])).toEqual([
      { type: 'valuation', date: '2026-03-01', value: valuation },
      { type: 'event', date: '2026-02-01', value: event },
    ]);
  });
});
