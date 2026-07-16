import { describe, expect, it } from 'vitest';

import { space, spacing } from './spacing';

describe('spacing tokens', () => {
  it('resolves a token to its pixel value', () => {
    expect(space('md')).toBe(16);
  });

  it('exposes a scale that increases monotonically', () => {
    const values = Object.values(spacing);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
  });
});
