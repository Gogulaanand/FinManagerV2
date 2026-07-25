export type Stage = 'reminder_1' | 'reminder_2' | 'reminder_3' | 'disclosure';

export type DeadmanLogicSettings = {
  threshold_days: number;
};

export type DeadmanLogicEvent = {
  kind: string;
  status: string;
  recipient: string | null;
  created_at: string;
};

export const stages: readonly { kind: Stage; offset: number }[] = [
  { kind: 'reminder_1', offset: 0 },
  { kind: 'reminder_2', offset: 7 },
  { kind: 'reminder_3', offset: 14 },
  { kind: 'disclosure', offset: 21 },
];

export function daysSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

export function isDue(settings: DeadmanLogicSettings, kind: Stage, inactiveDays: number): boolean {
  const stage = stages.find((item) => item.kind === kind);
  return stage !== undefined && inactiveDays >= settings.threshold_days + stage.offset;
}

export function dueStages(settings: DeadmanLogicSettings, inactiveDays: number): readonly Stage[] {
  return stages
    .filter((stage) => isDue(settings, stage.kind, inactiveDays))
    .map((stage) => stage.kind);
}

/** One asset class in the coarse disclosure summary, before presentation. */
export type SummaryEntry = {
  readonly source: 'holding' | 'account';
  readonly type: string;
  readonly value: number;
};

const HOLDING_LABELS: Readonly<Record<string, string>> = {
  mutual_fund: 'Mutual funds',
  stock: 'Stocks',
  foreign_stock: 'Foreign stocks',
  rsu: 'RSUs',
  esop: 'ESOPs',
  epf: 'EPF',
  ppf: 'PPF',
  nps: 'NPS',
  fd: 'Fixed deposits',
  real_estate: 'Real estate',
  gold: 'Gold',
  crypto: 'Crypto',
  cash: 'Cash',
};

const ACCOUNT_LABELS: Readonly<Record<string, string>> = {
  bank: 'Bank accounts',
  broker: 'Broker accounts',
  wallet: 'Wallets',
  cash: 'Cash on hand',
  credit_card: 'Credit cards',
};

/**
 * A human label for an asset class. Holdings and accounts are namespaced apart
 * internally because their type vocabularies overlap (both have `cash`), but
 * that namespacing must never reach the reader.
 */
export function summaryLabel(entry: SummaryEntry): string {
  const labels = entry.source === 'account' ? ACCOUNT_LABELS : HOLDING_LABELS;
  return (
    labels[entry.type] ??
    entry.type.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase())
  );
}

/**
 * Prepares the summary for a trusted contact: drops empty classes and orders by
 * size so the largest reads first.
 *
 * An unvalued holding renders as zero, and a line reading "Stocks: INR 0" tells
 * the reader nothing while making the whole notice look broken - in the one
 * message that most needs to be believed.
 */
export function presentableSummary(
  entries: readonly SummaryEntry[],
): { label: string; value: number }[] {
  return entries
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((entry) => ({ label: summaryLabel(entry), value: entry.value }));
}

/** Renders a day count with correct agreement, e.g. `1 day` / `15 days`. */
export function describeDays(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

/**
 * Whole days from now until `kind`'s successor becomes due, or null when
 * `kind` is the final stage.
 *
 * The reminders exist to tell someone how long they have, so this counts
 * forward from the *current* inactivity rather than restating the successor's
 * absolute threshold - those differ whenever a reminder fires late.
 */
export function daysUntilNextStage(
  settings: DeadmanLogicSettings,
  kind: Stage,
  inactiveDays: number,
): number | null {
  const next = stages[stages.findIndex((stage) => stage.kind === kind) + 1];
  if (!next) return null;
  return Math.max(0, settings.threshold_days + next.offset - inactiveDays);
}

export function hasCurrentEvent(
  events: readonly DeadmanLogicEvent[],
  kind: string,
  recipient: string | null,
  activity: string | null,
  now = Date.now(),
): boolean {
  return events.some((event) => {
    const pendingIsFresh =
      event.status !== 'pending' || now - new Date(event.created_at).getTime() < 86_400_000;
    return (
      event.kind === kind &&
      event.recipient === recipient &&
      event.status !== 'failed' &&
      pendingIsFresh &&
      (!activity || new Date(event.created_at) > new Date(activity))
    );
  });
}
