import { describe, expect, it } from 'vitest';

import { dark, light } from './color';
import { toTailwindCss } from './css';

const css = toTailwindCss();

/** Strips comments so prose about @theme cannot satisfy a structural test. */
const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('toTailwindCss', () => {
  it('declares @theme exactly once, at the top level', () => {
    expect(code.match(/@theme/g)).toHaveLength(1);
  });

  /**
   * The Phase 0 bug, as an executable guard. Tailwind v4 does not error on
   * @theme inside @media - it silently merges the block into the base theme
   * and light mode disappears. Nothing else catches this.
   */
  it('never nests @theme inside @media', () => {
    const mediaBlocks = code.match(/@media[^{]*\{[\s\S]*?\n\}/g) ?? [];
    expect(mediaBlocks.length).toBeGreaterThan(0);
    for (const block of mediaBlocks) {
      expect(block).not.toContain('@theme');
    }
  });

  it('puts light values in @theme and keeps dark out of it', () => {
    const theme = code.match(/@theme\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(theme).toContain(`--color-background: ${light.background};`);
    expect(theme).not.toContain(dark.background);
  });

  it('overrides dark values on plain CSS variables under prefers-color-scheme', () => {
    expect(code).toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\.light\)\s*\{/);
    expect(code).toContain(`--color-background: ${dark.background};`);
  });

  it('lets an explicit .dark class override the system preference', () => {
    const explicit = code.match(/:root\.dark\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(explicit).toContain(`--color-foreground: ${dark.foreground};`);
  });

  it('emits every semantic color role in both modes', () => {
    for (const role of Object.keys(light)) {
      const cssVar = `--color-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
      expect(code.match(new RegExp(`${cssVar}:`, 'g'))?.length).toBe(3);
    }
  });

  it('sets the spacing base so Tailwind derives the 4px grid', () => {
    expect(code).toContain('--spacing: 4px;');
  });
});
