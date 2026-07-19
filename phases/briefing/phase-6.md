# Phase 6 Briefing: Goals + Retirement + FIRE

## Completed

Phase 6 adds the goals, FIRE, and retirement layer on top of the Phase 5 portfolio engine.
All business math lives in `packages/core` as pure, Vitest-covered functions; the web and mobile screens are thin readers over the shared PowerSync repositories.

The database layer required no new migration: `public.goals` and `public.fire_settings` (with RLS, indexes, and the `set_updated_at` trigger) already existed in `20260717000001_full_data_model.sql`, and the PowerSync client schema plus `JSON_COLUMNS` (`goals.linked_holding_ids`) were already declared in `packages/sync/src/schema.ts`.

The shared schema now validates:

- `Goal`: name, kind (`education | foreign_studies | marriage | retirement | custom`), target amount in today's rupees, optional target date, already-saved amount, optional expected-return/inflation (whole percentages), linked holding UUIDs, and notes.
- `FireSettings`: annual expenses, withdrawal rate (default 4%), expected return, inflation, current/retirement age, and lean/fat multipliers, with cross-field checks (retirement age not before current age, fat multiplier not below lean).

The shared core now contains a `goals` module:

- Goal engine: inflation-adjusted future cost, `currentFunding` (already-saved plus linked holding values via the portfolio's `effectiveHoldingValue` precedence), projected value at the target date, shortfall/surplus, the additional monthly SIP (ordinary-annuity solve) to close the gap, funding ratio, and on-track/off-track/achieved status. Falls back to default return/inflation when a goal omits them.
- FIRE engine: FIRE number (expenses / withdrawal rate), lean/fat numbers via multipliers, coast number (real-return discounted to retirement age), real return rate, months/years/age to FIRE (closed-form solve with a no-growth linear branch and an unreachable null), per-variant progress, and status. Includes `suggestAnnualExpenses` to annualise recent monthly spend.
- Retirement corpus: sums EPF/PPF/NPS holdings (plus explicitly earmarked investment holdings), grouped by type, counting unvalued/missing-FX holdings rather than treating them as zero.

The web and mobile apps replace the Phase 6 `ModulePlaceholder` with a full Goals & FIRE workspace: FIRE summary tiles (number, current corpus, monthly savings, coast), a path-to-FIRE card with lean/regular/fat variants, per-goal cards showing future cost, projected value, shortfall/surplus, the monthly SIP needed, and a funding bar, a retirement-corpus card, a goal create/edit form (with holding linking and per-kind template rates), and a FIRE settings form (expenses auto-suggested from Phase 4 spend until saved).

## Exact files added or changed

### Product and phase documentation

- `phases/briefing/phase-6.md`
- `STATUS.md`
- `HANDOFF.md`
- `DECISIONS.md`

### Shared schema

- `packages/schema/src/goals.ts`
- `packages/schema/src/goals.test.ts`
- `packages/schema/src/index.ts`

### Shared core

- `packages/core/src/goals/time.ts`
- `packages/core/src/goals/goals.ts`
- `packages/core/src/goals/goals.test.ts`
- `packages/core/src/goals/fire.ts`
- `packages/core/src/goals/fire.test.ts`
- `packages/core/src/goals/retirement.ts`
- `packages/core/src/goals/retirement.test.ts`
- `packages/core/src/goals/fixtures.ts`
- `packages/core/src/goals/index.ts`
- `packages/core/src/index.ts`

### PowerSync and persistence

- `packages/sync/src/goals.ts`
- `packages/sync/src/goals.test.ts`
- `packages/sync/src/index.ts`

No migration was added. The `goals` and `fire_settings` tables, RLS policies, indexes, and the PowerSync client schema/`JSON_COLUMNS` entries already existed from Phase 0/3 scaffolding.

### Web application

- `apps/web/src/lib/goals.ts`
- `apps/web/src/components/goals/goal-form.tsx`
- `apps/web/src/components/goals/fire-settings-form.tsx`
- `apps/web/src/components/goals/goals-workspace.tsx`
- `apps/web/src/app/goals/page.tsx`

### Mobile application

- `apps/mobile/lib/goals.ts`
- `apps/mobile/components/goals/goal-form.tsx`
- `apps/mobile/components/goals/fire-settings-form.tsx`
- `apps/mobile/app/(tabs)/goals.tsx`

### CI fix (unrelated to Phase 6 logic)

A repository-wide `prettier --write` fixed pre-existing formatting failures committed with the phase 5.2 merge that were breaking CI on `main`:
`apps/mobile/app/(tabs)/portfolio.tsx`, `apps/mobile/components/card.tsx`, `apps/mobile/components/motion.tsx`, `apps/web/src/components/motion/animated-page.tsx`, `apps/web/src/components/motion/skeleton.tsx`, `packages/sync/src/expenses.ts`, and `docs/superpowers/plans/2026-07-18-platform-native-motion.md`.

## Verification evidence

- `CI=true pnpm turbo run build test lint typecheck`: 21/21 tasks passed.
- `CI=true pnpm format:check`: "All matched files use Prettier code style!".
- New tests: schema +11 (23 total), core +28 (140 total), sync +7 (30 total).
- Web production build compiled and generated the static `/goals` route.

The Chrome and Expo Go interactive checklist for Phase 6 (create goals, verify SIP and status, save FIRE settings, offline write + reconnect) is not yet claimed as manually passed and is the first action for the next session.

## Next phase

### Phase 7: AI Insights

Estimated effort: 1-2 sessions.

- Edge Function `ai-insights`: assembles a compact financial digest (whole-account or per-module), calls Anthropic, streams back; per-user monthly token budget.
- Chat-style UI both platforms with scope picker (Everything / Expenses / Budget / Portfolio / Goals / Tax) and suggested prompts; a proactive monthly "financial health" summary card on the dashboard.

Exit criteria: ask "how am I doing on my budget this month?" and get a grounded, data-specific answer; briefing written.
