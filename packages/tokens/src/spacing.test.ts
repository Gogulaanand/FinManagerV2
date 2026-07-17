import { describe, expect, it } from 'vitest';

import { cardPadding, space, spacing } from './spacing';

describe('spacing tokens', () => {
  it('resolves a token to its pixel value', () => {
    expect(space(4)).toBe(16);
  });

  it('names every token after its multiple of the 4px base', () => {
    for (const [token, value] of Object.entries(spacing)) {
      expect(value).toBe(Number(token) * 4);
    }
  });

  it('exposes a scale that increases monotonically', () => {
    const values = Object.values(spacing);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
  });

  it('gives mobile cards a tighter inset than desktop', () => {
    expect(cardPadding.mobile).toBeLessThan(cardPadding.desktop);
  });
});
