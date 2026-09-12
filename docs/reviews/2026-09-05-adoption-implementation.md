# Adoption implementation — first batch, 5 September 2026

Implements a bounded first batch from the owner's `2026-09-05-adoption-review.md`. Base: `origin/main` at `18bb2c8266a4a644d70291b54955911c475dadfd`. Branch: `codex/adoption-correctness`. Worktree: `/private/tmp/finmanager-adoption-20260905`. The primary checkout and its untracked documents were preserved.

## Implemented

- Web initial-sync and local-query loading states expose recovery links and stop skeletons after 15 seconds. Auth readiness is published before awaiting the sync connection. Settings offers Retry when disconnected or never synced. Previously completed cached data remains usable with a global sync timestamp/status banner.
- Dashboard financial values are unavailable while their queries load or fail; incomplete portfolio totals are marked partial. PowerSync hooks use `isLoading` and `error` rather than treating an initial empty array as a completed query. Individual unvalued portfolio holdings no longer display zero. Routine actions precede the optional AI card.
- Employer NPS is included once in taxable salary before the permitted deduction. Cash salary remains separate for take-home. Full reference cases cover contributions below and above the old/new caps. The review's 14% example now yields taxable income INR 2,029,224 and tax INR 215,598.24 before statutory final rounding.
- Web and mobile event/valuation forms start a new dated FX rate blank. Unknown non-INR values remain incomplete; source-currency labels and conversion direction are explicit. Holding forms also use source-currency labels.
- Shared local-calendar date defaults replace UTC defaults in transaction and portfolio forms, goal projection anchors, and current-month selection for expenses/insights. Timestamp storage and explicit UTC parsing remain unchanged.

## Verification

- Workspace tests passed: core 217, sync 89, schema 43, tokens 27 (376 total). Schema/token runs reused unchanged Turbo cache; core/sync ran in this worktree.
- Workspace lint and typecheck passed, including web/mobile typechecks. Changed-file formatting and whitespace checks passed.
- Web production build passed after rerunning with network access for configured Google fonts; the sandboxed attempt stalled and was stopped.
- Independent read-only FX/calendar review found no actionable defects.
- Added `apps/web/e2e/sync-availability.spec.ts` for unavailable first sync. Not executed: it requires the authenticated seeded test fixture and provider environment. No hosted financial writes, restore, email, or deployment was performed.

## Operational evidence and remaining sequence

On September 5, GitHub repository secret names still omit `SUPABASE_DB_URL`, `SUPABASE_BACKUP_PASSPHRASE`, and `DISPOSABLE_SUPABASE_DB_URL`. Latest observed backup run [33951159141](https://github.com/Gogulaanand/FinManagerV2/actions/runs/33951159141) and restore rehearsal [33488654310](https://github.com/Gogulaanand/FinManagerV2/actions/runs/33488654310) report failure. No secret values were accessed.

1. Diagnose current deployed PowerSync connection/auth/worker behavior and run disposable first-sync, reload, second-browser and provider-outage acceptance. These UI changes do not establish provider recovery.
2. Configure existing backup secrets and prove encrypted backup plus disposable restore with meaningful record/totals comparisons.
3. Implement explicit investable FIRE corpus and expense-baseline confirmation/coverage. Label manual balance snapshots and salary-estimator scope. These findings remain open.
4. Reconcile one statement cycle alongside existing records after the relevant correctness/recovery checks pass.
5. Treat inactivity as a separate scope: agree the recipient package, then fix server-confirmed arming, warning grace, non-sending simulation, trusted summary valuation, idempotent delivery and independent monitoring. No inactivity acceptance is claimed.
6. Complete beta prerequisites: dependency patch pass, password recovery, omitted server/database CI tests, access/isolation and error-reporting evidence. Native/device acceptance remains separate.

This batch does not change the adoption review's overall No-Go for sole-record use or trusted inactivity handoff.
