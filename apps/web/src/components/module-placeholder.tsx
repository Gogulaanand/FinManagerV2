import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';

export interface ModulePlaceholderProps {
  title: string;
  /** The phase that builds this module, so the shell is honest about what it is. */
  phase: number;
  summary: string;
  icon: LucideIcon;
}

/**
 * The designed state for a module whose feature work lands in a later phase.
 *
 * Deliberately not a TODO: the Phase 1 shell is meant to be navigable and look
 * finished, and a real user reaching an unbuilt module should see something
 * considered rather than a blank route. Each of these is replaced wholesale by
 * the phase named in `phase`.
 */
export function ModulePlaceholder({ title, phase, summary, icon: Icon }: ModulePlaceholderProps) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-headline-lg text-foreground">{title}</h1>

      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-6" aria-hidden="true" />
        </span>

        <p className="max-w-sm font-body text-body-md text-foreground-muted">{summary}</p>

        <span className="rounded-full bg-surface-muted px-3 py-1 font-body text-caption text-foreground-muted">
          Arrives in Phase {phase}
        </span>
      </Card>
    </div>
  );
}
