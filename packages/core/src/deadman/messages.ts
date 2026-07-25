/**
 * Dead-man switch message templates and summary presentation.
 *
 * These are pure so both callers can share one source of truth: the apps render
 * the preview locally from the unsaved draft, and the `deadman-check` Edge
 * Function renders the message it actually sends. A preview that disagreed with
 * the delivered message would be worse than no preview at all.
 *
 * This module must stay free of imports. The Edge Function pulls it in by
 * relative path through Deno's bundler, which cannot resolve the NodeNext `.js`
 * specifiers the rest of `packages/core` uses.
 */

export type DisclosureScope = 'existence' | 'summary';
export type EscalationStage = 'reminder_1' | 'reminder_2' | 'reminder_3' | 'disclosure';

/** Days of inactivity past the user's threshold at which each stage fires. */
export const STAGE_OFFSETS: readonly {
  readonly stage: EscalationStage;
  readonly offset: number;
}[] = [
  { stage: 'reminder_1', offset: 0 },
  { stage: 'reminder_2', offset: 7 },
  { stage: 'reminder_3', offset: 14 },
  { stage: 'disclosure', offset: 21 },
];

/** One asset class in the coarse disclosure summary, before presentation. */
export type SummaryEntry = {
  readonly source: 'holding' | 'account';
  readonly type: string;
  readonly value: number;
};

export type EmailMessage = { subject: string; text: string; html: string };

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

/** Renders a day count with correct agreement, e.g. `1 day` / `15 days`. */
export function describeDays(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

/**
 * Whole days from now until `stage`'s successor becomes due, or null when
 * `stage` is the final one.
 *
 * The reminders exist to tell someone how long they have, so this counts
 * forward from the *current* inactivity rather than restating the successor's
 * absolute threshold - those differ whenever a reminder fires late.
 */
export function daysUntilNextStage(
  thresholdDays: number,
  stage: EscalationStage,
  inactiveDays: number,
): number | null {
  const next = STAGE_OFFSETS[STAGE_OFFSETS.findIndex((item) => item.stage === stage) + 1];
  if (!next) return null;
  return Math.max(0, thresholdDays + next.offset - inactiveDays);
}

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
 * Totals holdings and accounts into asset classes.
 *
 * The two are keyed separately because their type vocabularies overlap on
 * `cash`; merging them would silently combine an unrelated holding with a bank
 * account.
 */
export function buildSummary(
  holdings: readonly { readonly type: string; readonly value: number }[],
  accounts: readonly { readonly type: string; readonly value: number }[],
): SummaryEntry[] {
  const totals = new Map<string, SummaryEntry>();
  const add = (source: 'holding' | 'account', type: string, amount: number) => {
    const key = `${source}:${type}`;
    const existing = totals.get(key);
    totals.set(key, { source, type, value: (existing?.value ?? 0) + amount });
  };
  for (const row of holdings) add('holding', row.type, Number(row.value) || 0);
  for (const row of accounts) add('account', row.type, Number(row.value) || 0);
  return [...totals.values()].map((entry) => ({ ...entry, value: Math.max(0, entry.value) }));
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

export function buildReminderMessage(input: {
  readonly userName: string;
  readonly stage: EscalationStage;
  readonly inactiveDays: number;
  readonly thresholdDays: number;
  readonly contactNames: readonly string[];
}): EmailMessage {
  const remaining = daysUntilNextStage(input.thresholdDays, input.stage, input.inactiveDays);
  const when =
    remaining === null || remaining === 0
      ? 'today'
      : remaining === 1
        ? 'tomorrow'
        : `in ${describeDays(remaining)}`;
  const what =
    input.stage === 'reminder_3'
      ? 'we will notify your trusted contacts'
      : 'we will remind you again';
  const names =
    input.stage === 'reminder_3'
      ? ` The contacts who will receive that message are ${
          input.contactNames.join(', ') || 'your active trusted contacts'
        }.`
      : '';
  const text = `Hello ${input.userName},\n\nFinManager inactivity reminder\n\nWe have not seen you open FinManager for ${describeDays(
    input.inactiveDays,
  )}. If you do not open the app, ${what} ${when}.${names}\n\nOpening the app cancels the escalation.`;
  return {
    subject: `FinManager inactivity reminder (${input.stage.replace('_', ' ')})`,
    text,
    html: escapeHtml(text),
  };
}

export function buildDisclosureMessage(input: {
  readonly userName: string;
  readonly scope: DisclosureScope;
  readonly note: string | null;
  readonly summary: readonly SummaryEntry[];
}): EmailMessage {
  const lines = presentableSummary(input.summary);
  const body =
    input.scope === 'summary'
      ? `Coarse financial summary by asset class:\n${
          lines
            .map((item) => `- ${item.label}: INR ${item.value.toLocaleString('en-IN')}`)
            .join('\n') || '- No summary is available.'
        }`
      : 'Financial records exist in FinManager. Please contact the user or their chosen support person before taking any action.';
  const note = input.note?.trim() ? `Message from the user:\n${input.note.trim()}\n\n` : '';
  const text = `FinManager trusted-contact notice for ${input.userName}\n\n${body}\n\n${note}This message contains no transaction history. Please handle it sensitively.`;
  return { subject: 'FinManager trusted-contact notice', text, html: escapeHtml(text) };
}
