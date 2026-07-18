import { describe, expect, it } from 'vitest';

import { directionOf, formatChoiceLabel, formatDelta, formatInr } from './format';

describe('formatChoiceLabel', () => {
  it('turns enum values into user-facing title case labels', () => {
    expect(formatChoiceLabel('buy')).toBe('Buy');
    expect(formatChoiceLabel('foreign_stock')).toBe('Foreign Stock');
  });
});

describe('formatInr', () => {
  it('groups with lakhs and crores, not thousands', () => {
    expect(formatInr(1245678)).toBe('₹12,45,678');
  });

  it('groups a crore correctly', () => {
    expect(formatInr(17000000)).toBe('₹1,70,00,000');
  });

  it('leaves amounts below a lakh ungrouped past the thousand', () => {
    expect(formatInr(48320)).toBe('₹48,320');
  });

  it('omits paise by default', () => {
    expect(formatInr(1234.56)).toBe('₹1,235');
  });

  it('shows paise on request', () => {
    expect(formatInr(1234.56, { paise: true })).toBe('₹1,234.56');
  });

  it('puts the minus outside the currency symbol', () => {
    expect(formatInr(-840)).toBe('-₹840');
  });

  it('signs positives only when asked', () => {
    expect(formatInr(145000, { signed: true })).toBe('+₹1,45,000');
    expect(formatInr(145000)).toBe('₹1,45,000');
  });

  it('does not sign zero as positive', () => {
    expect(formatInr(0, { signed: true })).toBe('+₹0');
  });

  it('rounds float drift before rendering, per D-014', () => {
    expect(formatInr(0.1 + 0.2, { paise: true })).toBe('₹0.30');
  });
});

describe('formatDelta', () => {
  it('always signs a positive change', () => {
    expect(formatDelta(0.024)).toBe('+2.4%');
  });

  it('signs a negative change', () => {
    expect(formatDelta(-0.12)).toBe('-12.0%');
  });

  it('leaves zero unsigned', () => {
    expect(formatDelta(0)).toBe('0.0%');
  });

  it('takes a ratio, not a percentage', () => {
    expect(formatDelta(1)).toBe('+100.0%');
  });

  it('honours the requested precision', () => {
    expect(formatDelta(0.02456, 2)).toBe('+2.46%');
  });
});

describe('directionOf', () => {
  it('classifies gains, losses, and no change', () => {
    expect(directionOf(12)).toBe('up');
    expect(directionOf(-12)).toBe('down');
    expect(directionOf(0)).toBe('flat');
  });
});
