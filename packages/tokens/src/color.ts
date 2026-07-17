/**
 * Semantic color tokens for the FinManager design system ("Calm Teal").
 *
 * Derived from the Stitch design system `assets/10681403320511857968`
 * (seed #0F766E, TONAL_SPOT). Every value is semantic, not literal: consumers
 * ask for `gain` or `surface`, never for "teal" or "#059669". That indirection
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
 * `background` is a tinted off-white rather than #FFFFFF so that white cards
 * separate from the canvas without needing a border on every element.
 */
export const light: ColorScheme = {
  background: '#F4F7F7',
  surface: '#FFFFFF',
  surfaceMuted: '#EDF2F1',
  border: '#DBE3E2',
  foreground: '#0B1512',
  foregroundMuted: '#5A6B68',
  primary: '#0F766E',
  primaryForeground: '#FFFFFF',
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
 * `primary` lightens to teal-400 here: the #0F766E seed does not clear AA
 * against a dark canvas, so the brand hue is preserved while the lightness is
 * re-picked for contrast. Same reasoning for `gain`/`loss`.
 */
export const dark: ColorScheme = {
  background: '#0A1211',
  surface: '#121C1A',
  surfaceMuted: '#1A2624',
  border: '#2A3937',
  foreground: '#ECF2F1',
  foregroundMuted: '#93A6A2',
  primary: '#2DD4BF',
  primaryForeground: '#04211E',
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
