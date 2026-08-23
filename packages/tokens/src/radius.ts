/**
 * Corner radius tokens.
 *
 * Calm Intelligence uses a confident 18px principal radius. The 20px and 22px
 * steps are reserved for larger cards and forecast panels, while `full` stays
 * reserved for pills, badges, and avatars - using it on a card makes a
 * data-dense screen read as a toy.
 */
export const radius = {
  none: 0,
  sm: 12,
  md: 18,
  lg: 20,
  xl: 22,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;

/** Resolves a radius token to its pixel value. */
export function rounded(token: RadiusToken): number {
  return radius[token];
}
