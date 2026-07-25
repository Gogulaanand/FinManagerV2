import { describe, expect, it } from 'vitest';

import { DEFAULT_CATEGORIES } from './categories.js';

describe('DEFAULT_CATEGORIES', () => {
  it('defines the 21 categories provisioned for every new user', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(21);
  });

  it('does not repeat a template key or initial name/kind pair', () => {
    expect(new Set(DEFAULT_CATEGORIES.map((category) => category.key)).size).toBe(
      DEFAULT_CATEGORIES.length,
    );
    expect(
      new Set(DEFAULT_CATEGORIES.map((category) => `${category.kind}:${category.name}`)).size,
    ).toBe(DEFAULT_CATEGORIES.length);
  });
});
