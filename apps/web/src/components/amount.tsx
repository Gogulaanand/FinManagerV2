'use client';

import { directionOf, formatDelta, formatInr } from '@finmanager/core';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';

gsap.registerPlugin(useGSAP);

const directionClass = {
  up: 'text-gain',
  down: 'text-loss',
  flat: 'text-foreground-muted',
} as const;

const directionGlyph = {
  up: '▲',
  down: '▼',
  flat: '',
} as const;

export interface DeltaProps {
  /** A ratio, not a percentage: 0.024 renders as +2.4%. */
  ratio: number;
  className?: string;
}

/**
 * A percentage change, e.g. "▲ 2.4%".
 *
 * The glyph is not decoration. gain and loss sit at nearly the same luminance,
 * so color alone does not survive greyscale or red-green colorblindness - the
 * glyph and the sign are what actually carry the meaning.
 */
export function Delta({ ratio, className }: DeltaProps) {
  const direction = directionOf(ratio);
  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-1 font-body text-label',
        directionClass[direction],
        className,
      )}
    >
      {directionGlyph[direction] && <span aria-hidden="true">{directionGlyph[direction]}</span>}
      {formatDelta(ratio)}
    </span>
  );
}

export interface AmountProps {
  /** Rupees. Rounded to paise before display, per D-014. */
  value: number;
  /** Color and sign the amount by its direction. Off for neutral balances. */
  signed?: boolean;
  paise?: boolean;
  size?: 'hero' | 'section' | 'row';
  className?: string;
}

const sizeClass = {
  hero: 'text-display-lg',
  section: 'text-display-md',
  row: 'text-title-md',
} as const;

/**
 * A rupee figure. Always Manrope, always tabular, so amounts align down a
 * column of transactions regardless of their digits.
 */
export function Amount({
  value,
  signed = false,
  paise = false,
  size = 'row',
  className,
}: AmountProps) {
  const direction = directionOf(value);
  const [displayValue, setDisplayValue] = useState(value);
  const counter = useRef({ value });
  const previousValue = useRef(0);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add({ reduceMotion: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
        const start = previousValue.current;
        previousValue.current = value;
        if (conditions?.reduceMotion) {
          counter.current.value = value;
          setDisplayValue(value);
          return;
        }
        gsap.fromTo(
          counter.current,
          { value: start },
          {
            value,
            duration: 0.65,
            ease: 'power2.out',
            onUpdate: () => setDisplayValue(counter.current.value),
          },
        );
      });
      return () => media.revert();
    },
    { dependencies: [value], revertOnUpdate: true },
  );

  return (
    <span
      className={cn(
        'tabular font-display',
        sizeClass[size],
        signed ? directionClass[direction] : 'text-foreground',
        className,
      )}
    >
      {formatInr(displayValue, { paise, signed })}
    </span>
  );
}
