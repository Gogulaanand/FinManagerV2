# Phase 4 Expenses + Budgeting Design

**Date:** 2026-07-18

**Status:** Approved by the project owner for planning.

## Goal

Deliver a usable offline-first Expenses module on web and mobile: accounts and
Indian-default categories, transaction CRUD, concrete recurring occurrences,
monthly category budgets, renderer-neutral charts, and generic bank CSV import
with mappings synced across the owner’s devices.

The phase must support the real-month path end to end: add, edit, and delete a
transaction; set a category budget; see actual progress and overspend; and view
the same numbers on web and mobile.

## Decisions confirmed during brainstorming

- Every stored amount is a positive rupee number. `direction` carries the
  meaning: `debit` is spending and `credit` is income. No negative transaction
  amounts are accepted.
- Recurring transactions become concrete transaction rows. They share a
  `recurring_id` and an occurrence key so ordinary lists, budgets, charts, and
  CSV exports can consume them.
- Saved CSV mappings sync across devices through a `profiles.csv_mappings`
  JSONB column. No import-mapping table is added.
- Account `current_balance` is an authoritative, manually entered balance.
  Transaction CRUD and CSV import never silently mutate it. Transaction data
  drives expense, income, budget, and chart calculations only.
- The Phase 3 foundation tables remain the persistence boundary. Phase 4 adds
  columns only where required; it does not add recurring-rule or import-mapping
  tables. Existing RLS policies remain unchanged.
- The delivery is four end-to-end slices: core persistence and transaction CRUD;
  budgets and analytics; recurrence; then CSV import.

## Architecture

### Shared schema

`packages/schema` owns Zod schemas and inferred types for Account, Category,
Transaction, Budget, recurrence metadata, CSV mapping records, and import
previews. SQLite row decoding is separate from domain validation: repositories
convert integer booleans, text dates, and JSON text before passing values into
the domain layer.

Transaction input validation requires a finite `amount > 0`, an INR currency
by default, a valid ISO date, and `direction` of `debit` or `credit`. Budget
input requires a finite positive amount and a first-of-month `periodStart`.

### Pure domain logic

`packages/core` contains all business math and deterministic transformations:

- Indian default category definitions and stable category keys.
- Monthly transaction totals for debit, credit, and net cash flow.
- Category breakdowns for a selected month, including rounded totals and
  renderer-neutral labels/colors/values.
- Budget progress with actual, remaining, ratio, and status. Statuses are
  `under` below 80%, `nearLimit` from 80% through 99.99%, and `overspent` at or
  above 100%. Progress ratios remain above 1 when overspent so charts can show
  the real amount.
- Monthly trend series and budget-versus-actual series with explicit ranges.
  Web and mobile adapters only translate these values into Recharts and Victory
  Native XL props; they do not recalculate them.
- Recurrence date expansion for daily, weekly, monthly, and yearly rules with a
  positive interval, end-date handling, and a deterministic
  `recurringId:YYYY-MM-DD` occurrence key.
- CSV parsing, header normalization, generic field mapping, canonical import
  hashes, and import preview rows. A mapped debit or credit is normalized into
  a positive amount plus `direction`.

Every aggregate, rate, or imported amount passes through `roundToPaise` before
being returned or stored. Core tests are written first and cover empty months,
partial months, refunds/income, overspend, leap dates, month-end recurrence,
quoted CSV fields, debit/credit columns, malformed rows, and duplicate hashes.

### Offline persistence

`packages/sync` owns SQL queries and repositories and remains React-free. It
adds query constants and UPDATE-then-INSERT repositories for accounts,
categories, transactions, and budgets. It also provides:

- idempotent per-user seeding of Indian default categories;
- transaction import deduplication by `import_hash`;
- recurring occurrence materialization guarded by `occurrence_key`;
- profile mapping read/write through the local PowerSync view; and
- row mapping helpers that validate and normalize SQLite values before core
  functions receive them.

All local writes include the authenticated `user_id`, `created_at`, and
`updated_at` values required by RLS. PowerSync tables are SQLite views, so no
repository uses `INSERT ... ON CONFLICT`. Duplicate prevention is explicit in
queries and deterministic keys, not dependent on a swallowed constraint error.

### Required migration and client-schema additions

One Phase 4 migration adds these fields without changing existing RLS:

- `profiles.csv_mappings jsonb not null default '{}'::jsonb`;
- `transactions.recurrence_frequency text`;
- `transactions.recurrence_interval integer not null default 1`;
- `transactions.recurrence_end_on date`;
- `transactions.recurrence_generated_through date`;
- `transactions.occurrence_key text`.

The migration adds checks for positive transaction/budget amounts, valid
debit/credit directions, positive recurrence intervals, and unique monthly
budgets per user/category/period start. It adds supporting indexes for
occurrence and import lookup. `packages/sync/src/schema.ts` mirrors each field;
`profiles.csv_mappings` is added to `JSON_COLUMNS`.

The existing `recurring_id` and `import_hash` columns remain the grouping and
dedupe fields respectively. A recurring source row is a normal transaction
with recurrence metadata. The repository materializes missing occurrences up
to the selected month and advances `recurrence_generated_through`; deleting a
previously generated occurrence does not recreate it because the generation
watermark has already passed it.

### Platform UI

The web `/expenses` route becomes a responsive expenses workspace with a month
selector, summary cards, transaction list, add/edit dialog, budget progress
cards, charts, account/category management, and CSV import preview/commit.
The web UI uses reactive PowerSync queries and renderer adapters only.

The mobile Expenses tab becomes thumb-first. The add flow opens on a large
amount display and an amount keypad, followed by debit/credit, category,
account, date, merchant/note, and recurring controls. Secondary fields remain
available without hiding the fast path. Lists, budget cards, and chart values
come from the same core outputs as web. Native dependency changes use `npx expo
install`; no dependency install runs while Metro or Next is running.

Both platforms seed categories after a signed-in local database is available.
Signed-out screens do not invent local finance rows because all synced data is
user-scoped by RLS.

## Error handling and offline behavior

- Validation errors stay inline in forms and never reach the repository.
- CSV import shows row-level errors and lets valid rows be reviewed before
  commit; duplicate import hashes are reported as skipped, not fatal.
- Local writes render immediately through `useQuery`; PowerSync queues them
  while disconnected and retries upload on reconnect.
- Sign-out continues to use the Phase 3 disconnect-and-clear behavior so one
  user cannot see another user’s local rows.
- The Expo Go SQL.js adapter is intentionally in-memory. Phase 4 verifies
  offline write/reconnect/sync behavior, but does not claim durable mobile
  offline relaunch; native persistent storage remains the Phase 9 task.

## Verification

1. Run the core/schema/sync Vitest suites with failing tests observed before
   each implementation slice.
2. Run `pnpm turbo run build test lint typecheck` and `pnpm format:check`.
3. Exercise web in Chrome: create an account/category, add/edit/delete debit
   and credit rows, set a budget, verify a chart, import a CSV, and test an
   offline write followed by reconnect/sync.
4. Exercise mobile in Expo Go: use the amount-first keypad, repeat the budget
   path, confirm matching chart values, and test offline reconnect where the
   simulator permits. The no-touch iOS simulator cannot prove interactive
   flows; a real device is required for that part of the acceptance evidence.
