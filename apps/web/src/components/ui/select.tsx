'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  id?: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  'aria-label'?: string;
}

export function Select<T extends string>({
  id,
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
}: SelectProps<T>) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listboxId = `${triggerId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  }

  function moveActive(direction: 1 | -1) {
    if (!options.length) return;
    setActiveIndex((current) => (current + direction + options.length) % options.length);
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        id={triggerId}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={!options.length}
        onClick={() => {
          setActiveIndex(selectedIndex);
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) setOpen(true);
            else moveActive(1);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) setOpen(true);
            else moveActive(-1);
          } else if (event.key === 'Home' && open) {
            event.preventDefault();
            setActiveIndex(0);
          } else if (event.key === 'End' && open) {
            event.preventDefault();
            setActiveIndex(Math.max(options.length - 1, 0));
          } else if ((event.key === 'Enter' || event.key === ' ') && open) {
            event.preventDefault();
            choose(activeIndex);
          }
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3',
          'font-body text-body-md text-foreground outline-none transition-colors',
          'focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/40',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        <span className={cn(!selectedOption && 'text-foreground-muted')}>
          {selectedOption?.label ?? 'Select an option'}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-foreground-muted transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={triggerId}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-surface p-1 shadow-lg"
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            const active = index === activeIndex;
            return (
              <div
                id={`${listboxId}-${index}`}
                key={option.value}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(index);
                }}
                className={cn(
                  'flex min-h-9 cursor-pointer items-center justify-between rounded-sm px-2 font-body text-body-md text-foreground',
                  active && 'bg-surface-muted',
                )}
              >
                <span>{option.label}</span>
                {selected ? <Check aria-hidden="true" className="size-4 text-primary" /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
