import { describe, expect, it } from 'vitest';

import { reduceKeypad } from './keypad';

describe('amount keypad reducer', () => {
  it('appends digits without allowing more than two paise digits', () => {
    expect(reduceKeypad('12.5', { type: 'digit', value: '0' })).toBe('12.50');
    expect(reduceKeypad('12.50', { type: 'digit', value: '1' })).toBe('12.50');
  });

  it('handles decimal and backspace actions', () => {
    expect(reduceKeypad('', { type: 'decimal' })).toBe('0.');
    expect(reduceKeypad('12.50', { type: 'backspace' })).toBe('12.5');
    expect(reduceKeypad('0', { type: 'backspace' })).toBe('');
  });
});
