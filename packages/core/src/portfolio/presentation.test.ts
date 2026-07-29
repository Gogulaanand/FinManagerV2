import { describe, expect, it } from 'vitest';

import { assetClassPresentation } from './presentation.js';

describe('assetClassPresentation', () => {
  it('provides deterministic, distinct presentation for every dashboard allocation class', () => {
    const classes = [
      'equity',
      'retirement',
      'fixed_income',
      'real_estate',
      'gold',
      'crypto',
      'cash',
    ] as const;
    const presentations = classes.map(assetClassPresentation);

    expect(presentations.map((item) => item.label)).toEqual([
      'Equity',
      'Retirement',
      'Fixed income',
      'Real estate',
      'Gold',
      'Crypto',
      'Cash',
    ]);
    expect(new Set(presentations.map((item) => item.color)).size).toBe(classes.length);
    expect(presentations.every((item) => item.icon.length > 0)).toBe(true);
  });

  it('keeps the accessible gain teal for cash', () => {
    expect(assetClassPresentation('cash')).toMatchObject({ color: '#047857' });
  });
});
