/**
 * Typography tokens for the FinManager design system.
 *
 * Manrope carries headlines and every currency figure; Inter carries body,
 * labels, and table content. Currency always renders in Manrope with tabular
 * numerals so that digits align down a column of transactions.
 */

export const fontFamily = {
  display: 'Manrope',
  body: 'Inter',
} as const;

export type FontFamilyToken = keyof typeof fontFamily;

/** A single type level. Sizes and line heights are px; RN has no `rem`. */
export interface TypeLevel {
  family: (typeof fontFamily)[FontFamilyToken];
  size: number;
  lineHeight: number;
  weight: number;
  /** Tracking in em. Large display sizes need negative tracking to stay tight. */
  letterSpacing: number;
}

export const typography = {
  /** The hero number on a dashboard card. Nothing else uses this. */
  'display-lg': {
    family: fontFamily.display,
    size: 40,
    lineHeight: 48,
    weight: 800,
    letterSpacing: -0.02,
  },
  /** Section-leading figures: a portfolio total, a tax liability. */
  'display-md': {
    family: fontFamily.display,
    size: 30,
    lineHeight: 38,
    weight: 700,
    letterSpacing: -0.02,
  },
  /** Screen titles. */
  'headline-lg': {
    family: fontFamily.display,
    size: 24,
    lineHeight: 32,
    weight: 700,
    letterSpacing: -0.01,
  },
  /** Card titles. */
  'headline-md': {
    family: fontFamily.display,
    size: 18,
    lineHeight: 26,
    weight: 700,
    letterSpacing: -0.01,
  },
  /** Amounts inside list rows and table cells. */
  'title-md': {
    family: fontFamily.display,
    size: 16,
    lineHeight: 24,
    weight: 600,
    letterSpacing: 0,
  },
  'body-lg': {
    family: fontFamily.body,
    size: 16,
    lineHeight: 24,
    weight: 400,
    letterSpacing: 0,
  },
  'body-md': {
    family: fontFamily.body,
    size: 14,
    lineHeight: 20,
    weight: 400,
    letterSpacing: 0,
  },
  /** Field labels, tab bar text, button text. */
  label: {
    family: fontFamily.body,
    size: 13,
    lineHeight: 16,
    weight: 500,
    letterSpacing: 0.01,
  },
  /** Timestamps and secondary metadata. */
  caption: {
    family: fontFamily.body,
    size: 12,
    lineHeight: 16,
    weight: 400,
    letterSpacing: 0.01,
  },
} as const satisfies Record<string, TypeLevel>;

export type TypeToken = keyof typeof typography;

/** Resolves a type level token to its full definition. */
export function type(token: TypeToken): TypeLevel {
  return typography[token];
}

/**
 * Type levels that render currency. These must always pair with tabular
 * numerals - `font-variant-numeric: tabular-nums` on web, `fontVariant:
 * ['tabular-nums']` on native - or columns of amounts will not align.
 */
export const currencyTypeTokens = [
  'display-lg',
  'display-md',
  'title-md',
] as const satisfies readonly TypeToken[];
