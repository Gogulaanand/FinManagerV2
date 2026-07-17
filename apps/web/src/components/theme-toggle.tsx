'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ThemeChoice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'finmanager-theme';

const options: ReadonlyArray<{ value: ThemeChoice; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

/**
 * Applies the choice by toggling `.light`/`.dark` on <html>. Those classes are
 * what packages/tokens' emitted CSS keys off: `.dark` forces dark, `.light`
 * opts out of the prefers-color-scheme override, and neither means "follow the
 * system".
 */
function apply(choice: ThemeChoice): void {
  const root = document.documentElement;
  root.classList.toggle('dark', choice === 'dark');
  root.classList.toggle('light', choice === 'light');
}

// The stored theme is genuinely external state - another tab can change it, and
// the server cannot see it at all - so it is read through useSyncExternalStore
// rather than mirrored into component state via an effect.
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Keeps sibling tabs in step.
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function getSnapshot(): ThemeChoice {
  return (localStorage.getItem(STORAGE_KEY) as ThemeChoice | null) ?? 'system';
}

/** The server cannot know the choice; themeScript corrects the DOM before paint. */
function getServerSnapshot(): ThemeChoice {
  return 'system';
}

function choose(next: ThemeChoice): void {
  localStorage.setItem(STORAGE_KEY, next);
  apply(next);
  emit();
}

export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5"
      role="group"
      aria-label="Color theme"
    >
      {options.map(({ value, label, Icon }) => (
        <Button
          key={value}
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={choice === value}
          onClick={() => choose(value)}
          className={cn(
            'size-8 rounded-full',
            choice === value && 'bg-primary text-primary-foreground hover:bg-primary',
          )}
        >
          <Icon />
        </Button>
      ))}
    </div>
  );
}

/**
 * Runs before first paint to apply the stored choice, so a dark-mode user does
 * not get a white flash on every navigation. Inlined in <head>; must stay
 * dependency-free and synchronous.
 */
export const themeScript = `(function(){try{var c=localStorage.getItem('${STORAGE_KEY}');if(c==='dark')document.documentElement.classList.add('dark');else if(c==='light')document.documentElement.classList.add('light');}catch(e){}})();`;
