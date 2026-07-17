/**
 * Spacing scale for the FinManager design system.
 *
 * A 4px base grid. Keys are the multiplier, so `spacing[4]` is 16px - the
 * number in the name is the only thing you need to do the arithmetic, which
 * matters on dense finance screens where padding is chosen constantly.
 */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export type SpacingToken = keyof typeof spacing;

/** Resolves a spacing token to its pixel value. */
export function space(token: SpacingToken): number {
  return spacing[token];
}

/**
 * Card padding differs per platform: thumbs need less inset than cursors do,
 * and mobile screens cannot spare 24px on both edges.
 */
export const cardPadding = {
  mobile: spacing[4],
  desktop: spacing[6],
} as const;
