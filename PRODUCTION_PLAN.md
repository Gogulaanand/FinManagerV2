# FinManager V2 - Production Plan

## Context

A personal finance super app for personal + family use, covering tax calculation (India), expense tracking and budgeting, investment portfolio with XIRR, goal planning (child education, marriage, foreign studies), retirement and FIRE tracking, AI insights, and an inactivity dead-man switch that alerts trusted contacts.
It runs on web and mobile with equal priority, where mobile is a true installed app (Expo/React Native), is offline-first for privacy, and has production-grade design (Stitch + shadcn/ui design system).
Development is done with LLM coding agents under 5-hour usage windows and weekly limits, so the plan is phased into session-sized units with a briefing handoff protocol so every session starts warm without re-scanning the codebase.

## Locked Decisions

See DECISIONS.md for the full log.
Summary: India tax first, Expo mobile + Next.js web in a pnpm/Turborepo monorepo, Supabase backend, PowerSync offline-first sync, server-side Anthropic AI, personal + family scale.

## Product View

One sentence pitch: a private, family-scale money OS that answers "how am I doing financially?" in one place.

| Module            | End-user question it answers                                              |
| ----------------- | ------------------------------------------------------------------------- |
| Tax calculator    | "What is my in-hand salary, and which regime saves me more?"              |
| Expenses + budget | "Where does my money go each month, and am I within budget?"              |
| Portfolio         | "What is everything I own worth, and what is my real return (XIRR)?"      |
| Goals             | "Will I be able to fund my kid's education / marriage / foreign studies?" |
| Retirement + FIRE | "When can I stop working, and am I on track?"                             |
| AI insights       | "Look at all of it and tell me what I should change."                     |
| Inactivity switch | "If something happens to me, my family finds out what exists and where."  |

Priority order for delivery (value first, dependencies second): tax calculator (standalone, instant value, no backend needed), then expenses (daily habit loop), then portfolio, then goals/FIRE (derived from portfolio), then AI (needs data from all modules), then the dead-man switch (needs auth + contacts + email infra).

UX references: the Vercel-hosted Indian salary/tax calculator (clean multi-config comparison UI) and the Dimensions expense app (fast entry, strong charting).
Design bar: production-grade, pixel-conscious, dark mode from day one, mobile ergonomics first-class (thumb-reachable entry, haptics, biometric lock).

## Architecture

### Monorepo layout

```
finmanager/
  apps/
    web/            Next.js 15 (App Router), Tailwind v4, shadcn/ui
    mobile/         Expo (expo-router), NativeWind, react-native-reusables
  packages/
    core/           Pure TS domain logic: tax engine, XIRR, FIRE math, projections (zero platform deps, heavily unit-tested)
    schema/         Zod schemas + shared TypeScript types for all entities
    sync/           PowerSync client setup, local DB schema, sync helpers shared by web + mobile
    tokens/         Design tokens (colors, spacing, type scale) consumed by Tailwind (web) and NativeWind (mobile)
  supabase/         Migrations, Edge Functions (AI proxy, dead-man cron), seed data
  phases/briefing/  Per-phase handoff briefings
```

Tooling: pnpm workspaces + Turborepo, TypeScript strict everywhere, Vitest for packages, ESLint + Prettier, GitHub Actions CI.

### Stack decisions and why

- **Backend: Supabase** (Postgres + Auth + Edge Functions + pg_cron). One managed service covers auth, database, serverless functions, and scheduled jobs on the free tier. Fits family scale with zero ops.
- **Offline-first sync: PowerSync** on top of Supabase Postgres. Real SQLite on device (expo-sqlite on mobile, wa-sqlite/OPFS on web), background bidirectional sync, identical on both platforms. The app reads/writes local SQLite always, so it is fully usable offline and fast; sync is eventual.
  - Fallback if PowerSync free tier becomes a problem: swap to a thin custom sync (local SQLite + last-write-wins push/pull over Supabase). The `packages/sync` abstraction keeps this swappable.
- **Domain math in `packages/core` as pure functions**: tax slabs as data-driven rule sets keyed by financial year and regime, XIRR via Newton-Raphson with bisection fallback, FIRE/goal projections. Pure TS is the sweet spot for LLM-agent development: fast to generate, trivially unit-testable, no platform flakiness.
- **AI: Supabase Edge Function proxying to the Anthropic API** (claude-sonnet-5 default). The function assembles the user's financial context (scoped to the module asked about, or a full cross-module digest), applies a system prompt, and streams the response. The API key stays server-side; add a monthly per-user token budget guard.
- **Email (dead-man switch + escalations): Resend** free tier, triggered by a pg_cron scheduled Edge Function.
- **Charts**: Recharts on web, Victory Native XL on mobile. Chart configs (series, ranges) computed in `packages/core` so both platforms render the same numbers.
- **Design pipeline**: Stitch MCP to generate screen designs and a design system, exported as DESIGN.md + tokens into `packages/tokens`, then implemented with shadcn/ui (web) and NativeWind + react-native-reusables (mobile) so both platforms share one visual language.
- **Deployment**: web on Vercel; mobile via EAS Build with internal distribution (Android APK / TestFlight). No public store listing needed at family scale.
- **Security for financial data**: Supabase RLS on every table (user_id scoped), biometric/PIN app lock on mobile, encrypted local storage where the platform allows, no third-party analytics.

### Core data model (summary)

`users`, `profiles` (PAN optional, FY preferences), `trusted_contacts`, `activity_log` (for the inactivity monitor),
`tax_scenarios` (saved calculator configurations), `accounts` (bank/broker/wallet), `transactions`, `categories`, `budgets`,
`holdings` (type: mutual_fund | stock | foreign_stock | rsu | esop | epf | ppf | nps | fd | real_estate | gold | crypto | cash), `holding_events` (buy/sell/vest/dividend cash flows that feed XIRR), `valuations` (point-in-time marks for illiquid assets like real estate),
`goals` (education/marriage/custom, target amount, target date, linked holdings, expected return, inflation assumption), `fire_settings` (expenses baseline, withdrawal rate, variants: lean/coast/fat).

All tables carry `user_id` + RLS, and sync via PowerSync bucket rules scoped per user.

## Execution Protocol for LLM-Agent Constraints

1. This plan has `### Phase N` sections. Every phase ends by writing `phases/briefing/phase-N.md` (what was built with exact file paths, files touched, next phase copied verbatim). Every new session starts by reading STATUS.md, HANDOFF.md, and the latest briefing, not by scanning the repo.
2. Phases are sized to roughly 1 to 2 focused sessions each. Each phase is independently shippable and ends green (typecheck, lint, tests pass) with a commit, so an expiring window never strands half-broken work.
3. Pure-logic phases (tax engine, XIRR, projections) are front-loaded and test-driven: cheap tokens, high certainty, no UI flakiness. UI phases consume the pre-built, pre-tested logic.
4. Long operations (pnpm install, EAS builds, test suites) run in background while the agent continues other work.
5. Vertical slices after the foundation: each feature phase delivers schema + sync rules + core logic + web UI + mobile UI for one module, so every phase ends with something usable.
6. STATUS.md is updated at every session end. DECISIONS.md is appended whenever a non-obvious technical or product decision is made. HANDOFF.md is rewritten at every session end with mid-phase state.
7. Learning nudges (owner is upskilling): whenever a phase introduces a non-trivial concept or makes a system-design choice worth understanding (e.g. offline-first sync, RLS, XIRR, indexing, auth flows), pause before or right after implementing it and check the owner's understanding. Briefly explain the concept and the design tradeoff in plain language, then ask whether it landed and whether they want to go deeper, before moving on. Prioritise concepts that transfer beyond this project.

## Phases

### Phase 0: Monorepo Foundation

Estimated effort: 1 session.

- pnpm + Turborepo workspace, TS strict base config, ESLint/Prettier, Vitest wiring.
- `apps/web` Next.js skeleton and `apps/mobile` Expo skeleton boot and render a placeholder screen.
- Empty `packages/core`, `packages/schema`, `packages/tokens` with build + test pipelines proven (one sample function + test).
- Git repo initialized + GitHub Actions CI (typecheck, lint, test on push).

Exit criteria: `pnpm turbo run build test lint` green; web runs locally; Expo app runs in Expo Go; briefing written.

### Phase 1: Design System

Estimated effort: 1-2 sessions.

- Use Stitch MCP: create project, generate design system + key screens (dashboard, expense entry, portfolio, tax calculator) for mobile and web.
- Extract tokens into `packages/tokens`; wire into Tailwind config (web) and NativeWind (mobile).
- shadcn/ui initialized on web with themed primitives; react-native-reusables equivalents on mobile.
- App shell both platforms: tab/side navigation for the six modules, dark/light mode, typography and spacing locked.

Exit criteria: navigable shell on both platforms that already looks production-grade; briefing written.

### Phase 2: Tax Calculator - India

Estimated effort: 1-2 sessions.

- `packages/core/tax`: FY 2025-26 (and 2024-25) rule sets as data; old vs new regime; salary decomposition (basic, HRA, allowances), 80C/80D/80CCD, standard deduction, surcharge + cess, professional tax; monthly in-hand output.
- Easy mode: CTC in, in-hand + regime comparison out. Advanced mode: full component-level configuration, multiple named scenarios side by side (the Vercel calculator reference UX).
- Exhaustive unit tests against hand-verified numbers before any UI.
- UI on web + mobile. Works fully offline and before login (scenarios persist locally; attach to account after auth exists).

Exit criteria: compute and compare real in-hand salary on both platforms; tests green; briefing written.

### Phase 3: Auth + Offline-First Data Layer

Estimated effort: 2 sessions.

- Supabase project: Auth (email + Google), `profiles`, RLS policies, initial migrations for the full data model.
- PowerSync instance + bucket rules; `packages/sync` with local SQLite schema mirroring Postgres; integration on web (wa-sqlite) and mobile (expo-sqlite).
- Login/signup/session screens both platforms; mobile biometric/PIN app lock.
- Activity logging hook (every app open writes `activity_log`) - the dead-man switch's data source.

Exit criteria: sign in on both platforms, write a record offline in airplane mode, watch it sync when back online; briefing written.

### Phase 4: Expenses + Budgeting

Estimated effort: 2 sessions.

- Transactions CRUD with fast-entry UX (amount-first keypad on mobile), categories (seeded Indian defaults), accounts, recurring transactions.
- Monthly budgets per category with progress, overspend states.
- Charts: monthly trend, category breakdown, budget vs actual (Dimensions-style).
- CSV import for bank statements (generic mapper, saved mappings per bank).

Exit criteria: track a real month of expenses end to end on mobile; briefing written.

### Phase 5: Portfolio + Investments

Estimated effort: 2-3 sessions (the heaviest module).

- Holdings across all asset types including real estate (manual valuations), RSU/ESOP (grant/vest schedule, INR conversion), EPF/PPF/NPS.
- `holding_events` cash-flow ledger; XIRR in `packages/core` (per holding, per asset class, whole portfolio) with a hardened numeric implementation and edge-case tests.
- Brokerage summary: allocation, invested vs current, gain/loss; CSV import for common Indian broker/MF formats (Zerodha, CAMS/KFintech first).
- Price refresh for listed assets when online (manual-first; auto-refresh best-effort, manual override always wins).

Exit criteria: full net worth and true XIRR on one screen; briefing written.

### Phase 5.1: Cross-phase Chrome verification carryover

Complete alongside Phase 5's Chrome verification, using a real Chrome session
and a real Expo Go device where touch interaction is required.

- Re-run the Phase 4 Expenses verification: add/edit/delete concrete
  transactions, set a monthly category budget, confirm progress and overspend
  states, inspect all three charts, and import the same bank CSV twice to
  confirm canonical duplicate skipping.
- Verify the Phase 4 offline path: write a transaction while offline, reconnect,
  confirm it syncs to Supabase, and confirm the same row appears on another
  signed-in device.
- Verify the Phase 5 portfolio flow delivered by that phase, including its
  core screen and any offline/sync behavior in its exit criteria.
- When Phase 5 is complete, share one copy-paste Chrome verification prompt
  covering both Phase 4 and Phase 5, with explicit accounts, test data, steps,
  expected results, and evidence to report. Do not split this into separate
  prompts.

Exit criteria: the combined Phase 4 + Phase 5 Chrome verification prompt has
been shared and both phase checklists have been completed; findings are
recorded in the Phase 5 handoff.

### Phase 6: Goals + Retirement + FIRE

Estimated effort: 1-2 sessions.

- Goal engine in `packages/core`: inflation-adjusted future cost, required SIP, funding progress from linked holdings; templates for child education, foreign studies, marriage.
- FIRE: number from expense baseline (auto-suggested from Phase 4 data) and withdrawal rate; lean/coast/fat variants; projected FIRE date; progress tracking.
- Retirement corpus view combining EPF/NPS/PPF + linked investments.

Exit criteria: each goal shows on-track/off-track with the monthly amount needed to close the gap; briefing written.

### Phase 7: AI Insights

Estimated effort: 1-2 sessions.

- Edge Function `ai-insights`: assembles a compact financial digest (whole-account or per-module), calls Anthropic, streams back; per-user monthly token budget.
- Chat-style UI both platforms with scope picker (Everything / Expenses / Budget / Portfolio / Goals / Tax) and suggested prompts; a proactive monthly "financial health" summary card on the dashboard.

Exit criteria: ask "how am I doing on my budget this month?" and get a grounded, data-specific answer; briefing written.

### Phase 8: Inactivity Monitor (Dead-Man Switch)

Estimated effort: 1 session.

- Trusted contacts CRUD (name, email, what they may receive: existence-only note vs asset summary).
- pg_cron daily Edge Function: inactivity threshold (default 30 days) triggers escalation - reminder emails to the user at day 30/37/44, and only after no response, disclosure email to trusted contacts (via Resend) with the user-configured content. Every step logged and cancelable by any app open.
- Settings UI: threshold, contacts, preview of exactly what would be sent, test-send to yourself.

Exit criteria: simulate inactivity in staging (shortened thresholds) and watch the full escalation chain fire correctly; briefing written.

### Phase 9: Hardening + Release

Estimated effort: 1-2 sessions.

- E2E smoke tests: Playwright (web), Maestro (mobile) for the critical paths (auth, add expense offline, portfolio view, tax calc).
- Web to Vercel (production + preview), mobile via EAS Build: Android internal distribution + TestFlight for family iPhones.
- Error tracking (Sentry free tier), backup/export (full data export to JSON/CSV).
- Performance pass: cold start, list virtualization, chart render on mid-range Android.

**Carried-over items to revisit here (deferred from earlier phases):**

- [ ] **Auth email delivery** (from Phase 3, D-024): Supabase email confirmation is ON but the built-in mailer is rate-limited, so real signups cannot complete. Wire a real sender (Resend, already the planned email provider) or make a deliberate decision to disable confirmation. Until then, new accounts must be confirmed manually.
- [ ] **Mobile PowerSync adapter swap** (from Phase 3, D-021): replace the Expo Go `@powersync/adapter-sql-js` (in-memory, no at-rest encryption, alpha) with native `@powersync/op-sqlite` (persistent, SQLCipher). This is localized to `apps/mobile/lib/powersync.ts` via the `Constants.executionEnvironment` adapter switch, and needs a dev build (EAS/`expo run:ios`). Covers the plan's "encrypted local storage" security item.
- [ ] **Mobile offline round-trip verification** (from Phase 3): the interactive sign-in → offline write → reconnect → sync path could not be driven in the no-touch simulator. Verify on a real device or dev build (Maestro covers this once E2E is set up).
- [ ] **Google sign-in on mobile** (from Phase 3): only web has Google OAuth; mobile needs the expo-web-browser + deep-link flow. (Do sooner if wanted; parked here otherwise.)
- [ ] **Delete the Phase 3 web test account** `gogulaanand02+webtest@gmail.com` and its synced rows from Supabase once cross-platform sync is confirmed.
- [ ] **Mobile add/edit views as modal routes for edge-swipe back** (from Phase 5.3/7 UX review): the mobile add/edit forms (portfolio "Add holding", goals "New goal", expenses "Add transaction", and the contextual event/value forms) are currently conditional full-screen swaps (`if (showForm) return <Form/>`) inside a tab screen, not navigation routes. Because they are not on the navigation stack, the iOS/Android edge-swipe-back gesture has nothing to dismiss, so the only way out is the Cancel button. Convert these into modal/stack routes (mirroring `app/holding/[id].tsx`, which already gets native swipe-back) so the OS back-gesture dismisses them alongside Cancel. Needs ideation on route structure (dedicated `new`/`edit` routes vs a generic modal host) and simulator verification. No implementation yet.
- [ ] **Expenses arbitrary month/year navigation** (from Phase 5.3 UX review): the expenses month selector only steps one month at a time via left/right arrows, so reaching e.g. May last year or January 2024 takes many taps. Add a way to jump directly to any month/year (month-year picker, tap-the-label dropdown, or a compact year+month grid). Needs ideation and design work - what pattern fits the existing token/card language, how it behaves on mobile vs web, and how it interacts with the 6-month trend window. No implementation yet.

Exit criteria: family members installed and using it; CI + deploys automated; the carried-over items above resolved or consciously re-deferred; briefing written.

Total: roughly 14-18 focused sessions.

## Verification Approach

- Every `packages/core` module ships with exhaustive Vitest suites (tax numbers hand-verified against real payslips and online calculators; XIRR verified against Excel's XIRR on the same cash flows).
- Every phase exits only when `turbo run build test lint` is green and the feature was exercised manually on both web and a real phone.
- Offline-first is verified per feature: airplane-mode write, relaunch, reconnect, confirm sync and no data loss.
- Phase 8 is verified end to end in a staging project with shortened thresholds before enabling real schedules.
- E2E suites from Phase 9 run in CI thereafter.

## Risks and Mitigations

- **PowerSync/Supabase free-tier limits or service changes**: sync logic isolated in `packages/sync`; fallback custom sync documented above.
- **Indian tax rule drift (yearly budgets)**: rules are data files keyed by FY, so a new year is a new data file + tests, not a code change.
- **Market price data sources are unreliable for free**: manual valuation is the primary path; auto-refresh is an enhancement, never a dependency.
- **Dead-man switch false positives**: multi-step escalation with user-facing warnings first, disclosure only as the final step, everything cancelable and logged.
- **Scope creep across 7 modules**: the phase gates + briefing files are the guard; no phase starts until the previous one's briefing is written.
