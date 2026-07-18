/**
 * Currency formatting for Indian rupees.
 *
 * Lives here rather than in either app because web and mobile must render the
 * same amount identically, and because the lakh/crore grouping is easy to get
 * wrong: ₹12,45,678 is correct, ₹1,245,678 is not. `en-IN` gets this right
 * natively, so we lean on Intl rather than hand-rolling the grouping.
 */
import { roundToPaise } from './money.js';

export interface FormatInrOptions {
  /**
   * Show paise. Defaults to false: dashboards read better in whole rupees,
   * and a transaction list of `.00` suffixes is noise.
   */
  paise?: boolean;
  /** Prefix a `+` on positive amounts. Deltas want it; balances do not. */
  signed?: boolean;
}

/**
 * Formats a rupee amount for display, e.g. `₹12,45,678`.
 *
 * The amount is rounded to paise first: floats accumulate error, and an
 * unrounded aggregate can render a stray `₹1,00,000.00000001` (see D-014).
 */
export function formatInr(amount: number, options: FormatInrOptions = {}): string {
  const { paise = false, signed = false } = options;
  const rounded = roundToPaise(amount);
  const digits = paise ? 2 : 0;

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(rounded));

  if (rounded < 0) return `-${formatted}`;
  return signed ? `+${formatted}` : formatted;
}

/**
 * Formats a ratio as a signed percentage, e.g. `+2.4%`.
 *
 * Takes a ratio (0.024), not a percentage (2.4), so callers cannot forget to
 * multiply. Always signed: a delta without a sign is ambiguous.
 */
export function formatDelta(ratio: number, fractionDigits = 1): string {
  const percent = ratio * 100;
  const sign = percent > 0 ? '+' : percent < 0 ? '-' : '';
  return `${sign}${Math.abs(percent).toFixed(fractionDigits)}%`;
}

/** Converts storage-style enum labels into readable UI copy. */
export function formatChoiceLabel(value: string): string {
  return value
    .split('_')
    .map((word) => (word ? `${word[0]!.toUpperCase()}${word.slice(1)}` : word))
    .join(' ');
}

/**
 * The direction of a change, for choosing a glyph and a color.
 *
 * Gain and loss are never signalled by color alone - the design system
 * requires a glyph or sign too, because the gain and loss hues sit at nearly
 * the same luminance and are indistinguishable to a colorblind user.
 */
export type Direction = 'up' | 'down' | 'flat';

/** Classifies an amount or ratio into a direction. */
export function directionOf(value: number): Direction {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}
