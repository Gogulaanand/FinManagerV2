import { describe, expect, it } from 'vitest';

import { roundToPaise } from './money';

describe('roundToPaise', () => {
  it('leaves already-rounded amounts untouched', () => {
    expect(roundToPaise(1234.56)).toBe(1234.56);
    expect(roundToPaise(0)).toBe(0);
  });

  it('rounds half away from zero', () => {
    expect(roundToPaise(1.005)).toBe(1.01);
    expect(roundToPaise(-1.005)).toBe(-1.01);
  });

  it('rounds down below the halfway point', () => {
    expect(roundToPaise(1.004)).toBe(1.0);
    expect(roundToPaise(99.994)).toBe(99.99);
  });

  it('survives float representation error', () => {
    expect(roundToPaise(0.1 + 0.2)).toBe(0.3);
  });

  it('rejects non-finite input', () => {
    expect(() => roundToPaise(Number.NaN)).toThrow(RangeError);
    expect(() => roundToPaise(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
