import { describe, expect, it } from 'vitest';
import { AccountSchema, HoldingSchema, ValuationSchema } from '@finmanager/schema';
import { calculatePortfolioSummary } from '../portfolio/analytics';
import { buildDisclosureMessage, disclosureSummaryFromPortfolio } from './messages';

const holdingId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
describe('trusted summary', () => {
  it('uses dated FX and manual overrides, deduplicates cash, and preserves debt', () => {
    const holdings = [
      HoldingSchema.parse({
        id: holdingId,
        name: 'Foreign stock',
        type: 'foreign_stock',
        currency: 'USD',
        currentValue: 9,
        manualValueOverride: 100,
        manualFxRateToInr: 80,
      }),
      HoldingSchema.parse({
        id: accountId,
        name: 'Linked cash',
        type: 'cash',
        currentValue: 500,
        accountId,
      }),
    ];
    const accounts = [
      AccountSchema.parse({ id: accountId, name: 'Bank', type: 'bank', currentBalance: 500 }),
      AccountSchema.parse({
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Card',
        type: 'credit_card',
        currentBalance: 2000,
      }),
    ];
    const entries = disclosureSummaryFromPortfolio(
      calculatePortfolioSummary(holdings, [], [], accounts),
    );
    expect(entries.reduce((sum, row) => sum + row.value, 0)).toBe(6500);
    expect(entries.find((row) => row.type === 'net_accounts')?.value).toBe(-2000);
    expect(
      buildDisclosureMessage({ userName: 'Owner', scope: 'summary', note: null, summary: entries })
        .text,
    ).toContain('INR -2,000');
    const dated = ValuationSchema.parse({
      holdingId,
      asOf: '2026-09-01',
      currency: 'USD',
      value: 50,
      fxRateToInr: 90,
    });
    const noOverride = { ...holdings[0]!, manualValueOverride: null, manualFxRateToInr: null };
    expect(
      disclosureSummaryFromPortfolio(calculatePortfolioSummary([noOverride], [], [dated], []))[0]
        ?.value,
    ).toBe(4500);
  });
  it('refuses missing FX or unvalued holdings instead of silently omitting money', () => {
    for (const partial of [{ currency: 'USD', currentValue: 100 }, { currentValue: null }]) {
      const holding = HoldingSchema.parse({
        id: holdingId,
        name: 'Incomplete',
        type: 'stock',
        ...partial,
      });
      expect(() =>
        disclosureSummaryFromPortfolio(calculatePortfolioSummary([holding], [], [])),
      ).toThrow('unavailable');
    }
  });
});
