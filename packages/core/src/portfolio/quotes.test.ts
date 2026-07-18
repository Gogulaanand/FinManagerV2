import { describe, expect, it } from 'vitest';

import type { Holding } from '@finmanager/schema';

import { YahooFinanceQuoteProvider } from './quotes';

const holding: Holding = {
  id: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000099',
  name: 'Reliance',
  type: 'stock',
  identifier: 'RELIANCE.NS',
  accountId: null,
  currency: 'INR',
  quantity: 2,
  avgCost: 100,
  currentPrice: null,
  currentValue: null,
  manualPriceOverride: 120,
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

function response(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

describe('YahooFinanceQuoteProvider', () => {
  it('returns a quote for a listed symbol', async () => {
    const provider = new YahooFinanceQuoteProvider(async () =>
      response({
        chart: {
          result: [
            {
              meta: { regularMarketPrice: 1450, currency: 'INR', regularMarketTime: 1_784_000_000 },
            },
          ],
        },
      }),
    );
    const result = await provider.quoteFor(holding);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.quote.price).toBe(1450);
  });

  it('reports unsupported and timeout outcomes without throwing', async () => {
    const unsupported = new YahooFinanceQuoteProvider(async () => response({}));
    expect(
      (await unsupported.quoteFor({ ...holding, type: 'real_estate', identifier: null })).status,
    ).toBe('unsupported');
    const timeout = new YahooFinanceQuoteProvider(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    expect((await timeout.quoteFor(holding)).status).toBe('timeout');
  });
});
