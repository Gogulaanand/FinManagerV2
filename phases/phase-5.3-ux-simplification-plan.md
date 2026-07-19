# Phase 5.3 - UX Simplification (Expenses + Portfolio)

Status: IMPLEMENTED - interactive verification pending (2026-07-19).
Before implementing, re-run `git status` and re-verify every line reference below against the then-current code (Phase 6 ran in parallel with this planning session).

## Current checkpoint (2026-07-19)

Implementation is complete through Sequencing step 7. Core helpers and date ranges have Vitest coverage; the sync layer has window/page/count integration coverage; expense hooks and both expense screens use month-bounded growing-LIMIT pagination; mobile expenses use one owning `FlatList`; web and mobile portfolio hubs route to contextual holding detail screens; event/value forms are contextual; and special-asset metadata uses typed fields on both platforms.

Fresh automated evidence at this checkpoint:

- `CI=true pnpm turbo run build test lint`: 15/15 tasks passed.
- Core: 18 files / 150 tests passed.
- Sync: 6 files / 32 tests passed.
- Web production build includes dynamic `/portfolio/[holdingId]`.
- Web and mobile standalone typecheck + lint passed.

The phase is **not complete** until the Verification checklist below is exercised interactively. Do not write `phases/briefing/phase-5.3.md` or mark Phase 5.3 complete in STATUS.md before that pass.

### Pending interactive verification

Use the existing signed-in test account without printing or rotating credentials. Record commit SHA, browser/device, timestamps, screenshots, console errors, and observed row counts.

Chrome scenarios:

1. Portfolio hub: confirm there are no always-open event/value forms or ledger/valuation-history cards; Add holding remains available; Import is collapsed behind its toggle; every holding row preserves value/type information and opens `/portfolio/<holdingId>`.
2. INR mutual fund detail: confirm header/effective value/XIRR, edit toggle, collapsed Add event and Update value actions, and merged newest-first timeline. Add an event and verify plain-language kind labels, today-defaulted date, INR-defaulted amount, saved row, and per-entry delete.
3. USD RSU detail: confirm event kinds are asset-appropriate, currency + FX appear, FX is prefilled from the holding when available, quantity/price options work, and a saved event immediately appears in the timeline.
4. Update value: save an INR valuation with value + as-of date, then a non-INR valuation with currency/FX context; verify timeline amount and delete.
5. Typed metadata: edit RSU/ESOP grant date, grant price, source currency, and vest fields; edit real-estate purchase/location/area/source fields; edit EPF/PPF/NPS masked account/employer/rate/date fields. Confirm the persisted metadata objects match `metadataFor`/`HoldingSchema` exactly and no raw JSON editor appears.
6. Expense scale: use a month with at least 100 transactions. Confirm the list starts at 50, the button reads the correct showing/total count, each click grows the live-query LIMIT by 50 without duplicates or skipped newest rows, and the button disappears at the total.
7. Expense aggregates: confirm summary, budgets, and category totals use the full month rather than only the visible 50; confirm the trend still spans six months and all three web charts remain unchanged.
8. Offline Chrome path: disconnect/airplane mode, add a holding event from its detail route and add an expense, verify both appear immediately from local PowerSync state and no direct UI network read is attempted; reconnect and confirm both rows upload to Supabase and reappear in another signed-in session. Capture local-write, reconnect, sync-complete timestamps, and row IDs.

Expo Go scenarios:

1. Push a holding detail screen over the portfolio tab and pop back; confirm the tab bar is covered on detail and restored on back.
2. Add event and Update value both begin with the Phase-4 amount keypad; continue to details, verify kind labels and FX context, open More options, edit date/quantity/price as applicable, save, and delete from the merged timeline.
3. On small and large simulators/devices, confirm all charts fill their measured container; rotate and confirm they remeasure without a zero-width canvas.
4. Confirm Accounts and Categories are collapsed by default with correct count badges; expand them and confirm every category appears (no eight-item cap).
5. Use a 150-transaction month and confirm one continuous `FlatList` scroll, no nested scrollbar, and `onEndReached` grows the query until all rows are present.
6. Offline Expo path: while the live screen remains mounted, disconnect, add an event and expense, verify immediate local display, reconnect, and confirm Supabase sync. Do not claim relaunch persistence; SQL.js relaunch persistence remains deferred by D-021.

## Context

Phases 1-3 are fine.
Phases 4 (expenses) and 5 (portfolio) over-complicated the UX.
The portfolio ledger, add-event, and manual-valuation flows have a steep learning curve; the expenses screen needs mobile chart optimization, collapsible Accounts/Categories on mobile, and a scalable pattern for months with 100s of transactions.
Broker CSV import and add-manual-holding are considered OK.
Goal: simple and easy to use, still feature rich - UI and query-layer changes only.

## Owner decisions (locked)

1. Hub ledger/valuation history + global form cards: remove from render, but keep the code as dead code - drop the imports/JSX from the hub components; do NOT delete the components (event/valuation forms get reworked and reused in holding detail; the global history cards simply stop being imported).
2. Mobile portfolio forms: reuse the amount-first keypad from expenses (`apps/mobile/components/expenses/amount-keypad.tsx`).
3. Categories on mobile: collapsible, no cap - remove `slice(0, 8)`, show all when expanded.
4. Bookkeeping: run as Phase 5.3 noted in STATUS.md Current State (not a new tracker row).

## Global design decisions

- Holding-centric navigation via dedicated detail routes on both platforms (not expandable panels):
  - Web: `apps/web/src/app/portfolio/[holdingId]/page.tsx` (App Router).
  - Mobile: `apps/mobile/app/holding/[id].tsx` - root `_layout.tsx` already renders a `Stack` wrapping `(tabs)`, so a sibling stack screen pushes over the tab bar with back nav for free.
- No schema/DB migrations. All 8 event kinds, `enforceEventSign`, and metadata shapes stay. UI + packages/core helpers + packages/sync query changes only.
- No new dependencies. RN core `FlatList` (not FlashList), existing reanimated 4.5 for the collapsible, keep victory-native (mobile) and recharts (web).
- Transactions at scale: NO nested max-height infinite scroll (nested scrolling fights the outer scroll gesture on mobile - poor UX). Instead: virtualized FlatList owning the main scroll (mobile) and month-bounded query with growing LIMIT + "Load more" (web).

---

## A) Portfolio simplification

### A1. Pure helpers in packages/core (write first, with Vitest)

New `packages/core/src/portfolio-ux.ts`, exported from `packages/core/src/index.ts`, tests alongside existing suites:

- `EVENT_KIND_LABELS: Record<HoldingEventKind, string>` - plain language: buy → "Invested more", sell → "Sold", vest → "Shares vested", exercise → "Options exercised", dividend → "Dividend received", interest → "Interest received", contribution → "Contribution", withdrawal → "Withdrawal".
- `allowedEventKinds(assetType)` - subset of the 8 kinds per the 13 asset types (`packages/schema/src/portfolio.ts`): tradeable → buy/sell/dividend; rsu/esop → vest/exercise/sell/dividend; epf/ppf/nps → contribution/interest/withdrawal; real_estate → buy/sell; etc. Test: every asset type returns a non-empty subset within the enum.
- `showsQuantityPrice(assetType)` - stock/mutual_fund/foreign_stock/rsu/esop true; drives default visibility of Quantity/Price.
- `mergeHoldingTimeline(events, valuations)` - merged date-desc entries tagged `'event' | 'valuation'`. Test ordering + tagging.

### A2. Web

- `apps/web/src/components/portfolio/portfolio-workspace.tsx` (rework, ~lines 258-345): stop importing/rendering `HoldingEventForm`, `ValuationForm`, "Ledger history" and "Valuation history" cards (dead code stays). Keep summary tiles, allocation, holdings list, add-holding toggle; put `PortfolioImport` behind a toggle button like add-holding. Holdings rows become `<Link href={'/portfolio/' + id}>` keeping value/XIRR chips.
- New `apps/web/src/app/portfolio/[holdingId]/page.tsx` → new `apps/web/src/components/portfolio/holding-detail.tsx`:
  - Header: name, type, effective value (`effectiveHoldingValue`/`valuationValueInr`), XIRR, edit-holding (reuses `HoldingForm`).
  - Two primary buttons: "Add event" and "Update value", each toggling its contextual form (collapsed by default).
  - Ledger: `mergeHoldingTimeline` timeline with plain-language labels, `Amount`, per-entry delete. Data from existing `usePortfolio()` (`apps/web/src/lib/portfolio.ts`) filtered by holdingId - reads stay via packages/sync.
- `apps/web/src/components/portfolio/holding-event-form.tsx` (simplify): required `holding` prop, drop the Holding select; kinds = `allowedEventKinds(holding.type)` with `EVENT_KIND_LABELS`; date defaults today; currency defaults `holding.currency`; Currency+FX fields render only when holding currency ≠ INR (`fxRateToInrForCurrency` pre-fills); Quantity/Price visible only when `showsQuantityPrice`, else inside a "More options" disclosure. Use the existing `CurrencyField` primitive (`apps/web/src/components/ui/input.tsx:65`) for amount.
- `apps/web/src/components/portfolio/valuation-form.tsx` (simplify): same contextual treatment - holding prop; visible fields for INR holdings: value + as-of date (default today). Retitle "Update value".
- `apps/web/src/components/portfolio/holding-form.tsx`: replace the raw "Special-asset metadata (JSON)" textarea (~lines 237-258) with typed field groups keyed by asset type (RSU/ESOP grant fields + vest schedule, real_estate, epf/ppf/nps), initialized from `metadataFor()` defaults, validated by existing `HoldingSchema` superRefine. Read `packages/schema/src/portfolio.ts:71-139` for exact keys. No schema edits.

### A3. Mobile

- New `apps/mobile/app/holding/[id].tsx` (`useLocalSearchParams`) → new `apps/mobile/components/portfolio/holding-detail.tsx` mirroring web (header, two action buttons, merged timeline, delete). Uses `apps/mobile/lib/portfolio.ts` hook.
- `apps/mobile/app/(tabs)/portfolio.tsx` (rework): stop rendering inline event/valuation forms and history cards (imports removed, code kept); holding rows `router.push('/holding/' + id)`; keep summary, allocation, add-holding full-screen swap, import.
- `apps/mobile/components/portfolio/holding-event-form.tsx` / `valuation-form.tsx`: contextual holding prop; restore the Date field (both, currently silently defaulted) and Quantity/Price (events) inside "More options"; kind picker via existing `Segmented`/`Choice` with `EVENT_KIND_LABELS`; amount entry via the Phase-4 amount keypad (amount first, details after, matching expenses).
- `apps/mobile/components/portfolio/holding-form.tsx`: same typed-metadata replacement as web.

---

## B) Expenses - mobile chart optimization

- `apps/mobile/components/expenses/expense-charts.tsx`: delete the hard-coded `chartSize = { width: 340, height: 220 }` (line 14). Add a small `useContainerWidth` hook (onLayout-measured wrapper width - more robust than `useWindowDimensions` minus guessed padding). Pass `explicitSize={{ width, height: clamp(180, width * 0.58, 240) }}`; pie size = `min(width, 240)`. Render a fixed-height placeholder until first layout (avoid 0-width Skia canvas).
- Charts stay stacked full-width in the FlatList footer (see D3).
- Web recharts already responsive (`ResponsiveContainer` in `h-56`) - no change.

## C) Collapsible Accounts & Categories (mobile)

- New `apps/mobile/components/collapsible.tsx`: reusable `<Collapsible title count defaultOpen={false}>` - pressable header with title, count badge, chevron rotating via reanimated `withTiming`; body conditionally mounted with reanimated entering/exiting transitions (pattern reference: `apps/mobile/components/choice.tsx` open/close state). Avoid RN `LayoutAnimation` (unreliable with reanimated 4 / new architecture).
- `apps/mobile/app/(tabs)/expenses.tsx`: wrap Accounts and Categories card bodies in `Collapsible` (counts = list lengths), default collapsed. Remove the categories `slice(0, 8)` cap - show all when expanded.
- Web keeps its inline grid (owner said web layout is OK).

## D) Transaction list scalability

### D1. Query layer - `packages/sync/src/expenses.ts`

Current `TRANSACTIONS_QUERY` (lines 33-37) selects ALL transactions with month filtering done in JS. Add (keep old export until both hooks migrate, then remove):

- `TRANSACTIONS_WINDOW_QUERY` - `WHERE occurred_on >= ? AND occurred_on < ? ORDER BY occurred_on DESC, created_at DESC`, used with a 6-month window because `buildMonthlyTrend(..., 6)` needs prior months (a current-month-only filter would flatten the trend chart).
- `TRANSACTIONS_MONTH_PAGE_QUERY` - month-bounded + `LIMIT ?`. Pagination = single live query with growing LIMIT (+50 per load), not OFFSET pages - offset is unstable under PowerSync live re-runs when rows insert at the top; growing LIMIT stays consistent and reactive via `useQuery` param changes.
- `TRANSACTIONS_MONTH_COUNT_QUERY` - `SELECT COUNT(*)` month-bounded, drives "Load more (X of M)".
- Date helpers `monthRange(month)` → `{ start, endExclusive }` and `trendWindowStart(month, months)` live in packages/core (next to `endOfMonthDate`) with Vitest: December rollover, leap February.
- Recurring queries untouched.

Tests: extend `packages/sync/src/expenses.integration.test.ts` (in-memory DB exists) - seed ~120 transactions across 3 months; assert window exclusion, LIMIT + ordering, count.

### D2. Hooks - `apps/web/src/lib/expenses.ts` and `apps/mobile/lib/expenses.ts`

Replace the single `useQuery(TRANSACTIONS_QUERY)` (web:114, mobile:112) with three parameterized `useQuery(sql, params)` calls: window (feeds trend/budget/summary/category aggregates), month page (limit state, initial 50, exposes `loadMoreTransactions()` / `hasMoreTransactions`), count. Compute month aggregates in one pass (fixes repeated `.filter`). Reset limit to 50 on month change. New API: `monthTransactions`, `monthTransactionCount`, `hasMoreTransactions`, `loadMoreTransactions`.

### D3. Mobile screen - `apps/mobile/app/(tabs)/expenses.tsx`

Restructure the single ScrollView into a `FlatList`:

- `data` = `monthTransactions`; `renderItem` = row extracted from lines 313-379 into new memoized `apps/mobile/components/expenses/transaction-row.tsx`.
- `ListHeaderComponent`: header, month nav, summary cards, add-transaction form toggle.
- `ListFooterComponent`: budgets, Collapsible Accounts, Collapsible Categories, charts.
- `onEndReached={loadMoreTransactions}`, `onEndReachedThreshold={0.4}`, `ListEmptyComponent`.
- FlatList over FlashList: simple rows, hundreds not thousands per month, no new native dep in Expo Go.

### D4. Web - `apps/web/src/components/expenses/expenses-workspace.tsx`

Keep the plain `<ul>` (lines 170-239) fed by `monthTransactions`; add a "Load more (showing X of M)" `Button` below, hidden when `!hasMoreTransactions`. No virtualization library - a few hundred `<li>`s are fine.

---

## Sequencing

1. Core helpers + tests (A1, D1 date helpers) - `pnpm turbo run test` green.
2. Sync query constants + integration tests (D1).
3. Hooks migration web+mobile (D2), existing UI still compiling.
4. Mobile expenses pass in one sweep over `expenses.tsx`: FlatList restructure (D3) + Collapsible (C) + chart sizing (B).
5. Web load-more (D4).
6. Web portfolio (A2): detail route, contextual forms, workspace trim, typed metadata.
7. Mobile portfolio (A3): stack route, keypad forms, workspace trim.
8. Session-protocol docs: STATUS.md (Phase 5.3 note in Current State), HANDOFF.md, DECISIONS.md entries (growing-LIMIT pagination; FlatList over FlashList; routes over panels; dead-code retention of hub history cards), commit per CLAUDE.md (no agent co-author).

## Verification checklist

- `pnpm turbo run build test lint` green (run in background).
- Web (Chrome): portfolio hub has no always-open forms; click holding → detail; add event on an INR mutual fund (3 visible fields: kind, date, amount); add event on a USD/RSU holding (currency + FX appear, FX pre-filled); update value; delete a timeline entry; edit holding metadata via typed fields, confirm saved shape matches `metadataFor`. Expenses: a month with 100+ rows shows 50 + working "Load more" with correct count; trend chart still spans 6 months; summary/budgets unchanged.
- Mobile (Expo Go): push/pop holding detail over tabs; keypad-first add event / update value including "More options" date/qty/price; charts fill width on small and large simulators (rotate to confirm re-measure); Accounts/Categories collapsed by default with counts; scroll a 150-transaction month - single continuous scroll, onEndReached loads more, no nested scrollbar.
- Offline path: airplane mode → add holding event from detail + add a transaction → immediate local UI update → reconnect → both rows visible in Supabase (Phase 5 E2E procedure; Expo Go relaunch persistence stays deferred per D-021).

## Phase-end deliverables

- `phases/briefing/phase-5.3.md` (what was built with exact paths, union of files touched, next phase section).
- STATUS.md updated, HANDOFF.md rewritten, DECISIONS.md appended, all committed.
