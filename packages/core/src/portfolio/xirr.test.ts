import { describe, expect, it } from 'vitest';

import { calculateXirr } from './xirr';

describe('calculateXirr', () => {
  it('calculates a ten percent return over one year', () => {
    const result = calculateXirr([
      { date: '2025-01-01', amount: -1000 },
      { date: '2026-01-01', amount: 1100 },
    ]);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.rate).toBeCloseTo(0.1, 8);
  });

  it('uses actual days for irregular cash flows and supports duplicate dates', () => {
    const result = calculateXirr([
      { date: '2025-01-01', amount: -1000 },
      { date: '2025-07-01', amount: -100 },
      { date: '2026-01-01', amount: 1210 },
      { date: '2026-01-01', amount: 0.01 },
    ]);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(Number.isFinite(result.rate)).toBe(true);
  });

  it('returns a typed insufficient-sign result without NaN for one-sided cash flows', () => {
    const result = calculateXirr([
      { date: '2025-01-01', amount: 100 },
      { date: '2026-01-01', amount: 200 },
    ]);

    expect(result).toEqual({ status: 'insufficient-sign-diversity', rate: null, iterations: 0 });
  });

  it('returns typed invalid-input and insufficient-date-span results', () => {
    expect(
      calculateXirr([
        { date: '2025-01-01', amount: -100 },
        { date: 'bad-date', amount: 200 },
      ]).status,
    ).toBe('invalid-input');
    expect(
      calculateXirr([
        { date: '2025-01-01', amount: -100 },
        { date: '2025-01-01', amount: 200 },
      ]).status,
    ).toBe('insufficient-date-span');
  });
});
