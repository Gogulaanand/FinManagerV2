/**
 * Placeholder spacing scale so the token pipeline is proven end to end.
 * Phase 1 replaces this with the real Stitch-derived design system.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export type SpacingToken = keyof typeof spacing;

/** Resolves a spacing token to its pixel value. */
export function space(token: SpacingToken): number {
  return spacing[token];
}
