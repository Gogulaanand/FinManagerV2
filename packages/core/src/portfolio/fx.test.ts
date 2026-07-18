import { describe, expect, it } from 'vitest';

import { fxRateToInrForCurrency } from './fx';

describe('fxRateToInrForCurrency', () => {
  it('does not retain an FX rate for INR', () => {
    expect(fxRateToInrForCurrency('INR', '83')).toBeNull();
  });

  it('normalizes a positive non-INR rate', () => {
    expect(fxRateToInrForCurrency('USD', '83.25')).toBe(83.25);
  });

  it('rejects empty, zero, negative, and non-finite rates', () => {
    expect(fxRateToInrForCurrency('USD', '')).toBeNull();
    expect(fxRateToInrForCurrency('USD', 0)).toBeNull();
    expect(fxRateToInrForCurrency('USD', -1)).toBeNull();
    expect(fxRateToInrForCurrency('USD', Number.NaN)).toBeNull();
  });
});
