/**
 * Corner radius tokens.
 *
 * 12px is the system default and covers cards, inputs, and buttons. `full` is
 * reserved for pills, badges, and avatars - using it on a card makes a
 * data-dense screen read as a toy.
 */
export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;

/** Resolves a radius token to its pixel value. */
export function rounded(token: RadiusToken): number {
  return radius[token];
}
