import { fontFamily, typography } from '@finmanager/tokens';
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge only knows Tailwind's stock scales. Our type scale is custom,
// so without this it reads `text-display-lg` and `text-foreground` as two
// `text-*` utilities in one group and silently drops the font size, leaving
// every amount at 16px. Feeding it the token names keeps packages/tokens the
// single source of truth rather than restating the scale here.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: Object.keys(typography) }],
      'font-family': [{ font: Object.keys(fontFamily) }],
    },
  },
});

/**
 * Merges class names, letting later Tailwind utilities win over earlier ones
 * of the same kind. Without twMerge, `cn('p-2', 'p-4')` would emit both and
 * leave the winner to CSS source order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
