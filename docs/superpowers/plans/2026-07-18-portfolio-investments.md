# Portfolio + Investments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 5 portfolio vertical slice across shared schema/core/sync, web, Expo Go mobile, and the Phase 5.1 handoff.

**Architecture:** Reuse the Phase 3 `holdings`, `holding_events`, `valuations`, and `accounts` tables. Add strict shared contracts and provider parsers, keep FX/XIRR/analytics pure in `packages/core`, use UPDATE-then-INSERT local repositories, and let both clients derive from PowerSync queries.

**Tech Stack:** TypeScript 6 strict, Zod 4, Vitest 4, PowerSync, Supabase SQL migrations, Next.js App Router, Expo Router, NativeWind, Recharts/Victory Native XL, fetch-based Yahoo quote adapter.

## Global Constraints

- Do not rerun or edit `supabase/migrations/20260718000001_phase4_expenses.sql`.
- Preserve UPDATE-then-INSERT writes because PowerSync tables are SQLite views.
- Preserve `packages/core` for pure domain math and `packages/schema` for Zod contracts.
- Preserve local-first PowerSync reads/writes; UI has no direct network reads.
- Preserve float rupees with `roundToPaise`, pinned dependency versions, and Expo Go compatibility.
- Preserve user-scoped RLS and add same-owner integrity for child rows.
- Do not claim Phase 5.1 complete unless real Chrome and real Expo Go evidence exists.

---

### Task 1: Lock portfolio semantics in strict shared contracts

**Files:**

- Create: `packages/schema/src/portfolio.ts`
- Create: `packages/schema/src/portfolio.test.ts`
- Modify: `packages/schema/src/index.ts`

**Interfaces:** `HoldingSchema`, `HoldingEventSchema`, `ValuationSchema`, `QuoteSchema`, `PortfolioImportRowSchema`, and their inferred types.

- [ ] Add failing tests for every asset type, strict unknown-field rejection, type-correlated metadata, required special metadata, event sign rules, zero-only vest events, per-event FX, valuations, quote observations, and import rows.
- [ ] Run `CI=true pnpm --filter @finmanager/schema test -- portfolio.test.ts`; confirm failure due to missing contracts.
- [ ] Implement strict schemas. Use holding-level discrimination or `superRefine` so RSU/ESOP, real estate, and EPF/PPF/NPS metadata matches the holding type. Add `currency` and nullable positive `fxRateToInr` to event/valuation contracts. Add manual/automatic quote fields to holdings.
- [ ] Export all contracts/types from `packages/schema/src/index.ts`.
- [ ] Run focused tests and `CI=true pnpm --filter @finmanager/schema typecheck`; confirm PASS.

### Task 2: Add the additive Phase 5 migration

**Files:**

- Create: `supabase/migrations/20260718000002_phase5_portfolio.sql`

- [ ] Add `holding_events.import_hash`, event/valuation FX columns, and holding manual/automatic quote columns with defaults that preserve existing rows.
- [ ] Add guarded checks for allowed types/kinds, quantity/price/value positivity, cash-flow signs, and zero-only vest events.
- [ ] Add same-owner constraints for event/valuation-to-holding and holding-to-account relationships, plus `(holding_id, occurred_on)`, `(holding_id, as_of desc)`, type, and import identity indexes.
- [ ] Run SQL formatting/static inspection and verify the migration does not reference or rerun Phase 4.

### Task 3: Harden XIRR and portfolio analytics

**Files:**

- Create: `packages/core/src/portfolio/xirr.ts`
- Create: `packages/core/src/portfolio/xirr.test.ts`
- Create: `packages/core/src/portfolio/analytics.ts`
- Create: `packages/core/src/portfolio/analytics.test.ts`
- Create: `packages/core/src/portfolio/index.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:** `calculateXirr`, `normalizeCashFlowsToInr`, `buildHoldingCashFlows`, `effectiveHoldingValue`, `calculatePortfolioSummary`, `assetClassForType`.

- [ ] Add failing Excel-benchmark tests for a known annual return, irregular dates, same-date flows, one-date histories, sign-diversity failure, missing FX, multiple-root policy, and no-convergence.
- [ ] Run `CI=true pnpm --filter @finmanager/core test -- portfolio`; confirm failure before implementation.
- [ ] Implement actual/365, same-date aggregation, bounded Newton/bisection, typed result states, and conventional root selection. Keep all rates strictly above -1 and never return NaN.
- [ ] Add analytics tests for INR conversion, effective value precedence, manual override protection, account-inclusive net worth, credit-card liabilities, cash double-count prevention, allocation, gain/loss, incomplete counts, and per-holding/class/portfolio XIRR.
- [ ] Implement pure analytics with one common report-date terminal flow per open holding and round all aggregates through `roundToPaise`.
- [ ] Build schema first, then run core tests/typecheck and refactor only while green.

### Task 4: Implement provider-specific portfolio CSV parsers

**Files:**

- Create: `packages/core/src/portfolio/import.ts`
- Create: `packages/core/src/portfolio/import.test.ts`
- Create: `packages/core/src/portfolio/fixtures/zerodha-tradebook.csv`
- Create: `packages/core/src/portfolio/fixtures/cams-statement.csv`
- Create: `packages/core/src/portfolio/fixtures/kfintech-statement.csv`
- Modify: `packages/core/src/portfolio/index.ts`

**Interfaces:** `parsePortfolioCsv`, `canonicalPortfolioImportHash`, `PortfolioImportPreview`, provider parser errors/warnings.

- [ ] Add failing fixture tests for Zerodha tradebook and CAMS/KFintech CSV exports, supported date/header variants, row-level warnings, and unsupported-format errors.
- [ ] Run the focused import tests; confirm failure before implementation.
- [ ] Implement parser dispatch by explicit source, semantic identity hashing using provider/account/instrument/transaction/date/kind/quantity/price/amount/currency, and normalized event rows. Never use row position as identity.
- [ ] Run import tests and core typecheck.

### Task 5: Implement PowerSync repositories and atomic import

**Files:**

- Modify: `packages/sync/src/schema.ts`
- Modify: `packages/sync/src/schema.test.ts`
- Create: `packages/sync/src/portfolio.ts`
- Create: `packages/sync/src/portfolio.test.ts`
- Create: `packages/sync/src/portfolio.integration.test.ts`
- Modify: `packages/sync/src/index.ts`

**Interfaces:** `HOLDINGS_QUERY`, `HOLDING_EVENTS_QUERY`, `VALUATIONS_QUERY`, row mappers, resolved-ID save/delete methods, `commitPortfolioImport`.

- [ ] Add failing schema/repository tests for new columns, JSON metadata round-trip, boundary parsing, update-then-insert, resolved IDs, user-scoped deletes, child cleanup, and repeated/reordered imports.
- [ ] Run focused sync tests; confirm failure before implementation.
- [ ] Extend AppSchema with all migration columns and keep `holdings.metadata` in `JSON_COLUMNS`.
- [ ] Implement repositories with Zod parsing, UPDATE-then-INSERT, `db.writeTransaction`, deterministic holding IDs, semantic hash checks, and atomic holding/event writes.
- [ ] Run sync unit/integration tests and typecheck.

### Task 6: Implement concrete quote refresh

**Files:**

- Create: `packages/core/src/portfolio/quotes.ts`
- Create: `packages/core/src/portfolio/quotes.test.ts`
- Modify: `packages/core/src/portfolio/index.ts`
- Modify: `packages/sync/src/portfolio.ts`

**Interfaces:** `PriceQuoteProvider`, `YahooFinanceQuoteProvider`, `refreshQuotes`, persisted automatic quote result.

- [ ] Add failing tests for supported/unsupported symbols, timeout/offline, stale quotes, partial success, and manual override precedence.
- [ ] Run focused quote tests; confirm failure before implementation.
- [ ] Implement an injected-fetch Yahoo adapter for listed symbols, bounded timeout, quote-date/source persistence, and per-holding results. Automatic writes never modify manual override columns.
- [ ] Run quote tests and sync tests.

### Task 7: Web portfolio workspace

**Files:**

- Create: `apps/web/src/lib/portfolio.ts`
- Create: `apps/web/src/components/portfolio/portfolio-workspace.tsx`
- Create: `apps/web/src/components/portfolio/holding-form.tsx`
- Create: `apps/web/src/components/portfolio/holding-event-form.tsx`
- Create: `apps/web/src/components/portfolio/valuation-form.tsx`
- Create: `apps/web/src/components/portfolio/portfolio-import.tsx`
- Modify: `apps/web/src/app/portfolio/page.tsx`

- [ ] Implement local queries for accounts/holdings/events/valuations and core-derived summary with sign-in gating.
- [ ] Implement responsive net-worth/completeness/XIRR/allocation/holding UI and manual override clear/refresh states.
- [ ] Implement holding/event/valuation forms using shared schemas and import preview/commit using core parsers; keep all network activity inside the quote provider action.
- [ ] Run web typecheck/lint/build and inspect the generated `/portfolio` route.

### Task 8: Expo Go mobile portfolio workspace

**Files:**

- Create: `apps/mobile/lib/portfolio.ts`
- Create: `apps/mobile/components/portfolio/holding-form.tsx`
- Create: `apps/mobile/components/portfolio/holding-event-form.tsx`
- Create: `apps/mobile/components/portfolio/valuation-form.tsx`
- Create: `apps/mobile/components/portfolio/portfolio-import.tsx`
- Modify: `apps/mobile/app/(tabs)/portfolio.tsx`

- [ ] Implement the same local query/core API and sign-in/offline states as web.
- [ ] Implement summary, allocation, holding CRUD, event/valuation forms, CSV preview/commit, manual override clear, and refresh result list with existing Expo Go-safe components.
- [ ] Run mobile typecheck and Expo iOS export.

### Task 9: Remote verification, combined Phase 5.1 evidence, and handoff

**Files:**

- Modify: `STATUS.md`
- Modify: `HANDOFF.md`
- Create: `phases/briefing/phase-5.md`
- Modify: `DECISIONS.md` when a non-obvious decision is made

- [ ] Run `pnpm turbo run build test lint typecheck`, `pnpm format:check`, web production build, and Expo iOS export.
- [ ] Validate and apply the new migration through the established operator workflow; verify remote migration history, columns, checks, indexes, RLS, and PowerSync stream schema. Do not rerun Phase 4.
- [ ] Verify a real holding/event/valuation/import row uploads and downloads through the connector.
- [ ] Execute one combined Phase 4 + Phase 5 Chrome/Expo prompt covering account/test data, Phase 4 CRUD/budgets/charts/CSV dedup/offline sync, Phase 5 holding/event/valuation/XIRR/allocation/incomplete state/import dedup/manual override/auto-refresh failure/offline sync, expected results, and evidence.
- [ ] If real Chrome or real Expo Go is unavailable, record Phase 5.1 outstanding and do not mark the phase exit criterion complete.
- [ ] Write the Phase 5 briefing with exact paths and verbatim next-phase text, update STATUS/HANDOFF, run `git diff --check`, and commit only after fresh verification.
