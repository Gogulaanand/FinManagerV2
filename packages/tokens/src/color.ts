/**
 * Semantic color tokens for the FinManager design system ("Calm Intelligence").
 *
 * Derived from the approved Stitch direction `10250399384858475183`.
 * Paper Mist and Porcelain keep the canvas warm and quiet; Deep Teal, Signal
 * Lime, and Forecast Lavender provide the one matte aurora forecast lens.
 * Every value is semantic, not literal: consumers ask for `gain` or `surface`,
 * never for "teal" or "#059669". That indirection
 * is what lets light and dark stay independently designed rather than one
 * being a mechanical inversion of the other.
 *
 * Light and dark are both first-class and must both meet WCAG AA.
 */

/** The palette roles available in every mode. */
export interface ColorScheme {
  /** App canvas. Subtly tinted, never pure white, so raised surfaces read. */
  background: string;
  /** Raised surface: cards, sheets, menus. */
  surface: string;
  /** Recessed surface: table stripes, inset wells, disabled fills. */
  surfaceMuted: string;
  /** Hairlines and dividers. */
  border: string;
  /** Primary text and the currency figures that headline every card. */
  foreground: string;
  /** Secondary text: labels, timestamps, captions. */
  foregroundMuted: string;
  /** Brand teal. Primary actions, active nav, selected states. Never large fills. */
  primary: string;
  /** Text/icons placed on top of `primary`. */
  primaryForeground: string;
  /** Signal Lime surface for a deliberate accent, never decorative gradients. */
  accent: string;
  /** Text/icons placed on top of `accent`. */
  accentForeground: string;
  /** Forecast Lavender surface for projections and planning guidance. */
  forecast: string;
  /** Text/icons placed on top of `forecast`. */
  forecastForeground: string;
  /** Money moving in: credits, gains, positive deltas. */
  gain: string;
  /** Money moving out: debits, losses, negative deltas. */
  loss: string;
  /** Focus rings. Must be visible against both `background` and `surface`. */
  focus: string;
}

/**
 * Light mode.
 *
 * Paper Mist is a warm canvas rather than #FFFFFF so Porcelain cards separate
 * without needing a border on every element.
 */
export const light: ColorScheme = {
  background: '#F4F3EE',
  surface: '#FFFEFA',
  surfaceMuted: '#ECEDE6',
  border: '#D7DDD6',
  foreground: '#17211D',
  foregroundMuted: '#53615C',
  primary: '#0F766E',
  primaryForeground: '#FFFEFA',
  accent: '#B8D84A',
  accentForeground: '#17211D',
  forecast: '#E7E2F6',
  forecastForeground: '#332D50',
  // emerald-700, not the emerald-600 (#059669) the design system names: 600 is
  // only 3.77:1 on white and fails AA. Gain/loss carry meaning, so they are
  // held to text contrast. See D-015.
  gain: '#047857',
  loss: '#E11D48',
  focus: '#0F766E',
};

/**
 * Dark mode.
 *
 * Dark values are designed independently. Deep Teal becomes a clearer teal
 * signal, while Signal Lime and Forecast Lavender stay legible as surfaces
 * against Ink without relying on a mechanical inversion of light mode.
 */
export const dark: ColorScheme = {
  background: '#101714',
  surface: '#18211E',
  surfaceMuted: '#22302B',
  border: '#36453F',
  foreground: '#F3F3EA',
  foregroundMuted: '#B8C3BD',
  primary: '#2DD4BF',
  primaryForeground: '#06221F',
  accent: '#C5E85C',
  accentForeground: '#17211D',
  forecast: '#4D456C',
  forecastForeground: '#F1EDFF',
  gain: '#34D399',
  loss: '#FB7185',
  focus: '#2DD4BF',
};

export const color = { light, dark } as const;

/** A color mode name. */
export type ColorMode = keyof typeof color;

/** The name of a single semantic color role. */
export type ColorRole = keyof ColorScheme;

/** Resolves a semantic color role in the given mode. */
export function colorFor(mode: ColorMode, role: ColorRole): string {
  return color[mode][role];
}

/**
 * Converts `#0F766E` to `15 118 110` - space-separated channels with no
 * `rgb()` wrapper.
 *
 * NativeWind themes through CSS variables and needs the channels bare so that
 * `rgb(var(--color-primary) / <alpha-value>)` can compose an alpha in. Passing
 * a hex string there would make every opacity utility silently no-op.
 */
export function toRgbChannels(hex: string): string {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!match?.[1]) {
    throw new RangeError(`toRgbChannels expects a six-digit hex color, received ${hex}`);
  }
  const value = match[1];
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)).join(' ');
}
