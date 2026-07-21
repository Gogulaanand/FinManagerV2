import { describe, expect, it } from 'vitest';

import { clampMonth, monthLabel, monthNow, shiftMonth } from './month.js';

describe('expense month helpers', () => {
  it('shifts across year boundaries', () => {
    expect(shiftMonth('2024-01', -1)).toBe('2023-12');
    expect(shiftMonth('2024-12', 1)).toBe('2025-01');
  });

  it('formats a month in the Indian locale', () => {
    expect(monthLabel('2024-01')).toBe('January 2024');
  });

  it('clamps months to inclusive bounds', () => {
    expect(clampMonth('2014-12', '2015-01', '2026-12')).toBe('2015-01');
    expect(clampMonth('2027-01', '2015-01', '2026-12')).toBe('2026-12');
    expect(clampMonth('2024-06', '2015-01', '2026-12')).toBe('2024-06');
  });

  it('returns the current UTC month', () => {
    expect(monthNow()).toMatch(/^\d{4}-\d{2}$/);
  });
});
