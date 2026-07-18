import type { Direction, RecurrenceFrequency } from '@finmanager/schema';

import { roundToPaise } from '../money.js';

export interface RecurrenceExpansionInput {
  readonly recurringId: string;
  readonly amount: number;
  readonly direction: Direction;
  readonly sourceDate: string;
  readonly frequency: RecurrenceFrequency;
  readonly interval: number;
  readonly endOn: string | null;
  readonly throughMonth: string;
}

export interface ExpandedOccurrence {
  readonly recurringId: string;
  readonly occurrenceKey: string;
  readonly occurredOn: string;
  readonly amount: number;
  readonly direction: Direction;
}

function parseDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new RangeError(`Invalid date: ${value}`);
  return parsed;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function endOfMonth(month: string): Date {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  return new Date(Date.UTC(year, monthNumber, 0));
}

function occurrenceDate(
  source: Date,
  index: number,
  frequency: RecurrenceFrequency,
  interval: number,
): Date {
  if (frequency === 'daily') {
    const date = new Date(source);
    date.setUTCDate(date.getUTCDate() + index * interval);
    return date;
  }
  if (frequency === 'weekly') {
    const date = new Date(source);
    date.setUTCDate(date.getUTCDate() + index * interval * 7);
    return date;
  }
  const sourceDay = source.getUTCDate();
  const targetMonth = source.getUTCMonth() + index * interval + (frequency === 'yearly' ? 0 : 0);
  const targetYear = source.getUTCFullYear() + (frequency === 'yearly' ? index * interval : 0);
  const targetMonthNumber = frequency === 'yearly' ? source.getUTCMonth() : targetMonth;
  const lastDay = new Date(Date.UTC(targetYear, targetMonthNumber + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonthNumber, Math.min(sourceDay, lastDay)));
}

export function expandOccurrences(input: RecurrenceExpansionInput): readonly ExpandedOccurrence[] {
  if (!Number.isInteger(input.interval) || input.interval < 1) {
    throw new RangeError('Recurrence interval must be a positive integer');
  }
  const source = parseDate(input.sourceDate);
  const through = endOfMonth(input.throughMonth);
  const endOn = input.endOn ? parseDate(input.endOn) : null;
  const occurrences: ExpandedOccurrence[] = [];
  for (let index = 1; ; index += 1) {
    const date = occurrenceDate(source, index, input.frequency, input.interval);
    if (date > through || (endOn && date > endOn)) break;
    const occurredOn = formatDate(date);
    occurrences.push({
      recurringId: input.recurringId,
      occurrenceKey: `${input.recurringId}:${occurredOn}`,
      occurredOn,
      amount: roundToPaise(input.amount),
      direction: input.direction,
    });
  }
  return occurrences;
}
