import { describe, expect, it } from 'vitest';

import { dark, light, toRgbChannels } from './color';
import { nativeWindTheme, toNativeWindCss } from './nativewind';
import { radius } from './radius';
import { spacing } from './spacing';

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

describe('NativeWind token generation', () => {
  const css = toNativeWindCss();
  const theme = nativeWindTheme();

  it('keeps light and dark semantic roles in parity with web tokens', () => {
    for (const [role, value] of Object.entries(light)) {
      const variable = `--color-${kebab(role)}: ${toRgbChannels(value)};`;
      expect(css).toContain(variable);
    }
    for (const [role, value] of Object.entries(dark)) {
      const variable = `--color-${kebab(role)}: ${toRgbChannels(value)};`;
      expect(css).toContain(variable);
    }
  });

  it('exposes the same semantic color role names through the Tailwind theme', () => {
    expect(Object.keys(theme.colors).sort()).toEqual(Object.keys(light).map(kebab).sort());
  });

  it('keeps typography, radius, and spacing on generated theme data', () => {
    expect(theme.fontFamily).toMatchObject({
      display: ['Sora_700Bold'],
      body: ['Manrope_400Regular'],
      utility: ['PublicSans_400Regular'],
      data: ['PublicSans_400Regular'],
    });
    expect(theme.borderRadius.md).toBe(`${radius.md}px`);
    expect(theme.borderRadius.lg).toBe(`${radius.lg}px`);
    expect(theme.borderRadius.xl).toBe(`${radius.xl}px`);
    expect(theme.spacing[4]).toBe(`${spacing[4]}px`);
    expect(theme.fontSize['headline-sm']).toEqual(['16px', { lineHeight: '24px' }]);
  });
});
