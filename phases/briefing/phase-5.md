# Phase 5 Briefing: Portfolio + Investments

## Completed

Phase 5 is implemented on branch `phase-5-portfolio` in the existing
`phase-4-expenses` worktree. Phase 4 remains at commit
`742b65d1a24d5622d57e09d3b246a315efb442d3` as the branch base, and the Phase 4
migration was not rerun.

The shared schema now validates the supported holding types, strict metadata for
RSU/ESOP, real estate, and EPF/PPF/NPS, typed holding quote provenance, signed
holding events, dated FX rates, valuation history, quote results, and provider
import rows. Special holding metadata must match the holding type and unknown
keys are rejected.

The shared core now contains:

- Hardened XIRR with same-date cash-flow combination, actual/365 timing,
  Newton plus bisection solving, and typed invalid/incomplete/no-convergence
  statuses.
- Portfolio analytics for invested value, current value, gain/loss,
  account-inclusive net worth, allocation by asset class, per-holding XIRR,
  and whole portfolio XIRR.
- Explicit manual-value/manual-price/automatic-quote precedence, missing-FX
  incomplete states, credit-card liabilities, and cash-account double-count
  protection.
- Provider-specific Zerodha, CAMS, and KFintech CSV parsers with fixtures,
  field-level preview errors, semantic import hashes, and stable import rows.
- A runtime-injected online Yahoo quote provider with timeout, stale, offline,
  unsupported, and failed states plus provider/source/as-of provenance.

## Exact files added or changed

### Product and phase documentation

- `docs/superpowers/specs/2026-07-18-portfolio-investments-design.md`
- `docs/superpowers/plans/2026-07-18-portfolio-investments.md`
- `phases/briefing/phase-5.md`
- `STATUS.md`
- `HANDOFF.md`
- `DECISIONS.md`

### Shared schema

- `packages/schema/src/portfolio.ts`
- `packages/schema/src/portfolio.test.ts`
- `packages/schema/src/index.ts`

### Shared core

- `packages/core/src/portfolio/index.ts`
- `packages/core/src/portfolio/xirr.ts`
- `packages/core/src/portfolio/xirr.test.ts`
- `packages/core/src/portfolio/analytics.ts`
- `packages/core/src/portfolio/analytics.test.ts`
- `packages/core/src/portfolio/import.ts`
- `packages/core/src/portfolio/import.test.ts`
- `packages/core/src/portfolio/quotes.ts`
- `packages/core/src/portfolio/quotes.test.ts`
- `packages/core/src/portfolio/fixtures/zerodha-tradebook.csv`
- `packages/core/src/portfolio/fixtures/cams-statement.csv`
- `packages/core/src/portfolio/fixtures/kfintech-statement.csv`
- `packages/core/src/index.ts`

### PowerSync and persistence

- `packages/sync/src/schema.ts`
- `packages/sync/src/schema.test.ts`
- `packages/sync/src/portfolio.ts`
- `packages/sync/src/portfolio.test.ts`
- `packages/sync/src/index.ts`
- `supabase/migrations/20260718000002_phase5_portfolio.sql`

The migration is additive. It adds quote fields, event/valuation currency and
FX fields, import hashes, value/sign/type checks, same-user composite foreign
keys, indexes, and semantic import/valuation uniqueness. It contains no Phase 4
migration statement. A linked Supabase project was not available in this
worktree, so remote migration application and schema verification remain an
operator step.

### Web application

- `apps/web/src/lib/portfolio.ts`
- `apps/web/src/components/portfolio/holding-form.tsx`
- `apps/web/src/components/portfolio/holding-event-form.tsx`
- `apps/web/src/components/portfolio/valuation-form.tsx`
- `apps/web/src/components/portfolio/portfolio-import.tsx`
- `apps/web/src/components/portfolio/portfolio-workspace.tsx`
- `apps/web/src/app/portfolio/page.tsx`

The web route reads local PowerSync data, validates rows at the boundary, writes
with the existing UPDATE-then-INSERT repository pattern, supports CRUD and
transactional imports, and refreshes listed quotes only when online.

### Mobile application

- `apps/mobile/lib/portfolio.ts`
- `apps/mobile/components/portfolio/holding-form.tsx`
- `apps/mobile/components/portfolio/holding-event-form.tsx`
- `apps/mobile/components/portfolio/valuation-form.tsx`
- `apps/mobile/components/portfolio/portfolio-import.tsx`
- `apps/mobile/app/(tabs)/portfolio.tsx`

The Expo Go route uses the same shared schemas, core math, and sync repositories.
It provides native holding/event/valuation forms, CSV paste preview and commit,
and local quote refresh behavior without adding native dependencies.

## Verification evidence

- `CI=true pnpm --filter @finmanager/schema test`: 13 tests passed.
- `CI=true pnpm --filter @finmanager/core test`: 112 tests passed.
- `CI=true pnpm --filter @finmanager/sync test`: 21 tests passed.
- `CI=true pnpm turbo run build test lint typecheck`: 21/21 tasks passed.
- `CI=true pnpm format:check`: passed.
- `CI=true pnpm --filter @finmanager/mobile exec expo export --platform ios`: passed and exported `dist`.
- Web production build compiled and generated `/portfolio`.
- `git diff --check`: clean before final review.

The Chrome connector was unavailable and the simulator has no touch input, so
the real signed-in Chrome and Expo Go offline/sync checklist is not claimed as
passed. The single combined Phase 4 + Phase 5 copy-paste prompt, including
accounts, concrete data, expected results, offline/sync checks, and evidence,
is in `HANDOFF.md`.

## Next phase

### Phase 6: Goals + Retirement + FIRE

Estimated effort: 1-2 sessions.

- Goal engine in `packages/core`: inflation-adjusted future cost, required SIP, funding progress from linked holdings; templates for child education, foreign studies, marriage.
- FIRE: number from expense baseline (auto-suggested from Phase 4 data) and withdrawal rate; lean/coast/fat variants; projected FIRE date; progress tracking.
- Retirement corpus view combining EPF/NPS/PPF + linked investments.

Exit criteria: each goal shows on-track/off-track with the monthly amount needed to close the gap; briefing written.
