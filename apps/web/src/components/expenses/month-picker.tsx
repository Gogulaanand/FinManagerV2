'use client';

import { clampMonth, monthLabel, monthNow, shiftMonth } from '@finmanager/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

const MIN_MONTH = '2015-01';
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export function MonthPicker({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const currentMonth = monthNow();
  const maxMonth = shiftMonth(currentMonth, 12);
  const selectedYear = Number(month.slice(0, 4));
  const [year, setYear] = useState(selectedYear);
  const minYear = 2015;
  const maxYear = Number(maxMonth.slice(0, 4));
  const monthOptions = useMemo(
    () => MONTHS.map((value) => `${year}-${String(value).padStart(2, '0')}`),
    [year],
  );

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

  function choose(next: string) {
    onChange(clampMonth(next, MIN_MONTH, maxMonth));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setYear(selectedYear);
          setOpen((value) => !value);
        }}
      >
        {monthLabel(month)}
      </Button>
      {open ? (
        <div
          role="dialog"
          aria-label="Choose expense month"
          className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-border bg-surface p-4 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous year"
              disabled={year <= minYear}
              onClick={() => setYear((value) => Math.max(minYear, value - 1))}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span className="font-display text-headline-md text-foreground">{year}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next year"
              disabled={year >= maxYear}
              onClick={() => setYear((value) => Math.min(maxYear, value + 1))}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {monthOptions.map((value) => {
              const disabled = value < MIN_MONTH || value > maxMonth;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  aria-pressed={value === month}
                  onClick={() => choose(value)}
                  className="rounded-md bg-surface-muted px-2 py-2 font-body text-label text-foreground hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {monthLabel(value).split(' ')[0]}
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={() => choose(currentMonth)}
          >
            This month
          </Button>
        </div>
      ) : null}
    </div>
  );
}
