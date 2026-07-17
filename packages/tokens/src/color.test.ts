import { describe, expect, it } from 'vitest';

import { color, colorFor, dark, light, type ColorScheme } from './color';

/** sRGB relative luminance, per WCAG 2.1. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG 2.1 contrast ratio, 1..21. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const modes: ReadonlyArray<[string, ColorScheme]> = [
  ['light', light],
  ['dark', dark],
];

describe('color tokens', () => {
  it('resolves a semantic role in a given mode', () => {
    expect(colorFor('dark', 'gain')).toBe(dark.gain);
  });

  it('defines the same roles in both modes', () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });

  it('uses six-digit hex everywhere, so the RN and CSS consumers agree', () => {
    for (const [, scheme] of modes) {
      for (const value of Object.values(scheme)) {
        expect(value).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });

  describe.each(modes)('%s mode contrast', (_name, scheme) => {
    it('clears AA (4.5:1) for body text on the canvas', () => {
      expect(contrast(scheme.foreground, scheme.background)).toBeGreaterThanOrEqual(4.5);
    });

    it('clears AA for body text on raised surfaces', () => {
      expect(contrast(scheme.foreground, scheme.surface)).toBeGreaterThanOrEqual(4.5);
    });

    it('clears AA for secondary text on raised surfaces', () => {
      expect(contrast(scheme.foregroundMuted, scheme.surface)).toBeGreaterThanOrEqual(4.5);
    });

    /** Money colors carry meaning, so they are held to text contrast, not UI contrast. */
    it('clears AA for gain and loss on raised surfaces', () => {
      expect(contrast(scheme.gain, scheme.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(scheme.loss, scheme.surface)).toBeGreaterThanOrEqual(4.5);
    });

    it('clears AA for text on a primary fill', () => {
      expect(contrast(scheme.primaryForeground, scheme.primary)).toBeGreaterThanOrEqual(4.5);
    });

    /**
     * gain and loss differ by hue, not luminance (they sit ~1.2:1 apart), so
     * they are indistinguishable in greyscale and to a red-green colorblind
     * user. That is expected and is not fixable in the palette: it is why the
     * design system requires a sign or a ▲/▼ glyph on every amount. This test
     * only pins that they are not literally the same value.
     */
    it('gives gain and loss distinct values, leaving meaning to the glyph', () => {
      expect(scheme.gain).not.toBe(scheme.loss);
    });
  });

  it('exposes both modes on the color object', () => {
    expect(Object.keys(color)).toEqual(['light', 'dark']);
  });
});
