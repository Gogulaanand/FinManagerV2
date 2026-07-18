# Phase 4 Briefing: Expenses + Budgeting

## Outcome

Phase 4 is implemented on the `phase-4-expenses` branch. The app now has a
shared expenses domain across web and Expo mobile: accounts, seeded Indian
categories, positive-amount transactions with debit/credit direction, monthly
budgets, recurring sources, charts, and generic bank CSV import. All persisted
feature data continues to flow through PowerSync queries and repositories.

The feature is designed around a concrete monthly ledger. A transaction is a
real row with an account, category, date, amount, direction, merchant, note,
and optional recurrence metadata. A budget is a real category/month row. A
recurring source expands to concrete child transaction rows with deterministic
`occurrence_key` values, so devices converge on the same records rather than
calculating separate virtual copies.

## What was built

- Shared Zod contracts in `packages/schema/src/expenses.ts` and
  `packages/schema/src/csv.ts`.
- Indian default categories in `packages/core/src/expenses/categories.ts`.
- Monthly summary, category breakdown, budget progress, monthly trend, and
  budget-vs-actual chart series in `packages/core/src/expenses/analytics.ts`.
- Month-end-safe daily, weekly, monthly, and yearly recurrence expansion in
  `packages/core/src/expenses/recurrence.ts`.
- Quoted CSV parsing, debit/credit mapping, previews, and canonical import
  hashes in `packages/core/src/expenses/csv.ts`.
- Amount-first mobile keypad reducer in `packages/core/src/expenses/keypad.ts`.
- Vitest coverage for schema validation, analytics, recurrence, CSV parsing,
  and keypad behavior.
- Migration `supabase/migrations/20260718000001_phase4_expenses.sql` adds only
  the recurrence/import fields required by the existing tables and the synced
  profile mapping JSON column. RLS is unchanged.
- `packages/sync/src/expenses.ts` contains row mappers, UPDATE-then-INSERT
  repositories, category seeding, recurrence materialization, profile mapping
  persistence, and CSV deduplication.
- `packages/sync/src/schema.ts` mirrors the new fields and registers
  `profiles.csv_mappings` in `JSON_COLUMNS`.
- Web UI files:
  `apps/web/src/components/expenses/expenses-workspace.tsx`,
  `transaction-form.tsx`, `budget-section.tsx`, `expense-charts.tsx`, and
  `csv-import.tsx`; the route is `apps/web/src/app/expenses/page.tsx`.
- Mobile UI files:
  `apps/mobile/app/(tabs)/expenses.tsx`,
  `apps/mobile/components/expenses/amount-keypad.tsx`,
  `transaction-form.tsx`, `expense-charts.tsx`, and
  `apps/mobile/lib/expenses.ts`.
- Recharts is used on web and Victory Native XL on mobile; both consume the
  same chart config output from `packages/core`.
- `apps/web/src/components/client-providers.tsx` keeps the browser-only
  PowerSync provider out of SSR prerendering. This removes the pre-existing
  `a.execute is not a function` traces from the production build.
- `apps/mobile/nativewind-env.d.ts` declares CSS modules for the pinned
  TypeScript 6 mobile toolchain.

## Verification

- `pnpm turbo run build test lint typecheck`: 21/21 tasks successful.
- `pnpm format:check`: clean.
- Core: 97 tests passed.
- Sync: 14 tests passed, including UPDATE-then-INSERT and CSV hash
  deduplication.
- Web production build compiled and prerendered `/expenses` successfully.
- Expo iOS export completed successfully, including Victory Native XL.
- The Chrome connector was unavailable in this environment, so a live Chrome
  interaction check could not be completed. The production build and route
  generation are verified; do not treat that as a substitute for clicking
  through a signed-in month on Chrome.
- The iOS simulator has no touch input. The mobile bundle was verified, but a
  real-device Expo Go check is still required for keypad, edit/delete, and
  offline airplane-mode interaction.
- The app intentionally keeps the Phase 3 SQL.js mobile adapter in-memory;
  relaunch re-sync behavior is deferred to the Phase 9 OP-SQLite swap.
- The owner applied `20260718000001_phase4_expenses.sql` to Supabase. Remote
  migration history now matches the repository, and verification found all
  five recurrence columns, the profile JSON column, five constraints, four
  indexes, and RLS enabled on the five affected tables.

## Files touched in Phase 4

The complete implementation set is:

`apps/mobile/app/(tabs)/expenses.tsx`

`apps/mobile/components/expenses/amount-keypad.tsx`

`apps/mobile/components/expenses/expense-charts.tsx`

`apps/mobile/components/expenses/transaction-form.tsx`

`apps/mobile/lib/expenses.ts`

`apps/mobile/nativewind-env.d.ts`

`apps/mobile/package.json`

`apps/web/src/app/layout.tsx`

`apps/web/src/app/expenses/page.tsx`

`apps/web/src/components/client-providers.tsx`

`apps/web/src/components/expenses/budget-section.tsx`

`apps/web/src/components/expenses/csv-import.tsx`

`apps/web/src/components/expenses/expense-charts.tsx`

`apps/web/src/components/expenses/expenses-workspace.tsx`

`apps/web/src/components/expenses/transaction-form.tsx`

`apps/web/src/lib/expenses.ts`

`packages/core/src/expenses/analytics.test.ts`

`packages/core/src/expenses/analytics.ts`

`packages/core/src/expenses/categories.ts`

`packages/core/src/expenses/csv.test.ts`

`packages/core/src/expenses/csv.ts`

`packages/core/src/expenses/index.ts`

`packages/core/src/expenses/keypad.test.ts`

`packages/core/src/expenses/keypad.ts`

`packages/core/src/expenses/recurrence.test.ts`

`packages/core/src/expenses/recurrence.ts`

`packages/core/src/index.ts`

`packages/schema/src/csv.ts`

`packages/schema/src/expenses.test.ts`

`packages/schema/src/expenses.ts`

`packages/sync/src/expenses.test.ts`

`packages/sync/src/expenses.ts`

`packages/sync/src/index.ts`

`packages/sync/src/schema.ts`

`supabase/migrations/20260718000001_phase4_expenses.sql`

Supporting dependency/export paths are `apps/web/package.json`,
`packages/core/package.json`, `packages/schema/src/index.ts`,
`packages/sync/package.json`, `packages/sync/src/index.ts`, and
`pnpm-lock.yaml`. The design and execution records are
`docs/superpowers/specs/2026-07-18-expenses-budgeting-design.md` and
`docs/superpowers/plans/2026-07-18-expenses-budgeting.md`.

`DECISIONS.md`, `STATUS.md`, and `HANDOFF.md` were updated for the handoff.

## Next phase (copied verbatim from `PRODUCTION_PLAN.md`)

### Phase 5: Portfolio + Investments

Estimated effort: 2-3 sessions (the heaviest module).

- Holdings across all asset types including real estate (manual valuations), RSU/ESOP (grant/vest schedule, INR conversion), EPF/PPF/NPS.
- `holding_events` cash-flow ledger; XIRR in `packages/core` (per holding, per asset class, whole portfolio) with a hardened numeric implementation and edge-case tests.
- Brokerage summary: allocation, invested vs current, gain/loss; CSV import for common Indian broker/MF formats (Zerodha, CAMS/KFintech first).
- Price refresh for listed assets when online (manual-first; auto-refresh best-effort, manual override always wins).

Exit criteria: full net worth and true XIRR on one screen; briefing written.
