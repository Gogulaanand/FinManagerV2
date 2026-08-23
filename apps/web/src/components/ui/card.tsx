import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * A raised surface. Carries no border by default: the tinted canvas already
 * separates it, and a border on every card makes a dense screen read as a grid
 * of boxes.
 */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-motion-card="true"
      className={cn(
        'rounded-[1.25rem] bg-surface p-4 shadow-[0_1px_2px_color-mix(in_srgb,var(--color-foreground)_5%,transparent)] ring-1 ring-border/55 md:p-6',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('font-display text-headline-md tracking-[-0.025em] text-foreground', className)}
      {...props}
    />
  );
}

/** A small caps-ish label above a figure. */
export function CardLabel({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      className={cn('font-utility text-label tracking-[0.01em] text-foreground-muted', className)}
      {...props}
    />
  );
}
