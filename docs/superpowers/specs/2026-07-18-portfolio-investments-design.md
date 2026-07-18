# Portfolio + Investments Design

## Goal

Deliver an offline-first portfolio workspace on web and Expo Go mobile that
answers what the user owns, what it is worth, how it is allocated, and its true
cash-flow return. It reuses the existing Phase 3 portfolio tables and
PowerSync client schema, adding only an additive Phase 5 migration.

## Scope

- Support mutual fund, stock, foreign stock, RSU, ESOP, EPF, PPF, NPS, FD,
  real estate, gold, crypto, and cash holdings.
- Create/edit holdings with account, currency, quantity, cost, manual value or
  price overrides, automatic quote observations, and typed metadata.
- Support buy, sell, vest, exercise, dividend, interest, contribution, and
  withdrawal events. Buy/contribution/exercise are negative investor flows;
  sell/dividend/interest/withdrawal are positive; vest is a zero-value
  non-cash event unless explicitly configured as a synthetic acquisition.
- Support dated manual valuations, INR normalization for every dated event and
  valuation, provider-specific Zerodha/CAMS/KFintech CSV imports, and semantic
  duplicate detection.
- Compute holding, asset-class, and whole-portfolio XIRR, allocation,
  invested/current value, gain/loss, completeness, and account-inclusive net
  worth in `packages/core`.
- Deliver the same local-first flow at web `/portfolio` and the existing mobile
  Portfolio tab, including import preview and price-refresh results.

## Architecture

### Shared contracts

`packages/schema/src/portfolio.ts` owns strict Zod schemas for asset types,
type-correlated RSU/ESOP, real-estate, and retirement metadata, holdings,
events, valuations, quotes, and import rows. Every event and valuation carries
its own currency and `fxRateToInr`; missing FX for a non-INR flow makes derived
XIRR incomplete rather than assuming 1. Event schemas enforce cash-flow signs
by kind, allow zero only for non-cash vest events, and require positive
quantity/price when present.

### Domain math

`packages/core/src/portfolio/xirr.ts` uses actual/365 day fractions, combines
same-date flows, and applies bounded Newton-Raphson with bisection fallback.
Its typed result distinguishes `ok`, invalid input, insufficient sign
diversity/date span, no bracket, and no convergence. Non-conventional
multi-root histories use the first valid root found from the conventional
0.1 starting guess and are labelled by the result contract. `analytics.ts`
normalizes dated flows to INR, appends one terminal effective current value on
a common report date per open holding, and returns `isComplete`, missing FX,
unvalued counts, allocation, gain/loss, and net-worth summaries. All monetary
aggregates pass through `roundToPaise`.

Net worth includes active account snapshots; credit-card balances are
liabilities. A cash holding linked to an account is excluded from the account
sum to avoid double counting. “Tracked portfolio value” is used when accounts
are not supplied.

### Persistence and sync

`packages/sync/src/portfolio.ts` maps the existing SQLite columns plus Phase 5
columns to shared contracts. Repositories validate at the boundary, return
resolved IDs, use UPDATE-then-INSERT, scope deletes, and clean up child
events/valuations in one local write transaction. Import uses deterministic
holding identity and semantic event hashes in one transaction. PowerSync
continues to carry holding metadata as JSON through `JSON_COLUMNS`.

The new `supabase/migrations/20260718000002_phase5_portfolio.sql` adds event
FX/import columns, quote provenance/manual override columns, kind/sign/value
checks, same-owner integrity constraints, lookup indexes, and unique import
keys. It does not alter or rerun the Phase 4 migration. Existing Phase 3 RLS
remains enabled and is supplemented by same-owner foreign-key checks.

### Price refresh

The platform-neutral `PriceQuoteProvider` has a concrete Yahoo Finance adapter
for listed symbols, with injected fetch and timeout handling. It reports
offline, unsupported, stale, timeout, and partial-success states. Automatic
quotes persist in automatic-only columns. Effective value precedence is:
latest manual total value, manual unit price times quantity, latest successful
automatic quote times quantity, existing current value/price fallback, then
missing. Auto-refresh never overwrites manual data; the UI can clear manual
overrides.

### Import

Core owns provider-specific CSV parsing and sanitized fixtures for Zerodha
tradebook plus CAMS/KFintech CSV exports. Each parser declares supported
headers/date formats and returns normalized rows with warnings/errors. Import
identity hashes provider, account, instrument identity, transaction ID when
available, date, kind, quantity, price, amount, and currency, never row
position. The repository commits a complete statement atomically.

### UI and data flow

Both clients query local PowerSync SQLite, validate rows, derive the same core
summary, and write locally through repositories. The web and mobile workspaces
show net worth/XIRR, completeness, allocation, holding rows, event/valuation
forms, CSV preview, manual override controls, and per-holding refresh results.
UI contains formatting and event wiring only.

## Error handling

- Invalid rows become row-level import errors.
- XIRR renders explicit status copy and never NaN.
- Missing FX and missing prices/valuations are visible through incomplete
  counts and excluded from complete totals rather than treated as zero.
- Network refresh failures preserve manual values and identify failed holdings.
- PowerSync remains local-first and delegates retry/discard behavior to the
  existing connector.

## Testing and verification

- Write failing schema, XIRR benchmark, analytics, provider-parser,
  quote-provider, repository, transactional import, and deduplication tests.
- Run focused red/green cycles, then `pnpm turbo run build test lint typecheck`
  and `pnpm format:check`, web production build, and Expo iOS export.
- Execute the combined Phase 4 + Phase 5 checklist in real Chrome and on a
  real Expo Go device. If either surface is unavailable, record Phase 5.1 as
  outstanding; builds are not substitutes.
- Preserve the D-021 SQL.js limitation: verify offline write/reconnect,
  Supabase confirmation, and second-device sync, but do not claim persistent
  offline relaunch under Expo Go.
