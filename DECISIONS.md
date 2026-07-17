# Decision Log

Append-only log of product and technical decisions.
Newest entries at the bottom.
Format: date, decision, why, alternatives rejected.

---

## D-001: Tax jurisdiction - India first (2026-07-17)

Target Indian tax rules first: old vs new regime, 80C/80D/80CCD, HRA, EPF/NPS, RSU perquisite tax, surcharge + cess, monthly in-hand output.
Why: matches the primary user's situation and the "in-hand amount" framing.
Rejected: US-first; multi-country abstraction upfront (rules are still stored as data files keyed by FY, so other countries can be added later without a rewrite).

## D-002: Mobile via React Native (Expo) + separate Next.js web app (2026-07-17)

True native mobile app through Expo with app-store-grade UX, plus a Next.js web app, sharing business logic through monorepo packages.
Why: user explicitly wants an installed native-feeling app, not a mobile website; PWA limits on iOS were not acceptable.
Rejected: PWA-only (one codebase but weaker mobile UX); Capacitor wrapper (middle ground, but native UX was the priority).
Consequence: roughly 1.5-2x UI effort; mitigated by keeping all domain logic in shared pure-TS packages.

## D-003: Audience - personal + family first (2026-07-17)

Real auth and multi-user support, but optimized for a handful of users on free-tier hosting.
No billing, no marketing pages, no public onboarding.
Why: realistic scope for LLM-agent development under usage limits; can open up later.

## D-004: AI insights are server-side with owner-paid API key (2026-07-17)

A Supabase Edge Function proxies to the Anthropic API with the owner's key; clients never hold the key.
Why: simplest UX for family members; user chose this over BYOK.
Consequence: add a per-user monthly token budget guard to control cost.
Rejected: BYOK (each user pastes their own key).

## D-005: Backend on Supabase, offline-first sync via PowerSync (2026-07-17)

Supabase provides Postgres, Auth, Edge Functions, and pg_cron on the free tier.
PowerSync provides local SQLite on both platforms (expo-sqlite on mobile, wa-sqlite on web) with bidirectional sync.
Why: offline-first is a hard requirement for privacy and speed; this is a documented, supported combo; zero ops at family scale.
Rejected: custom sync from day one (kept as documented fallback in packages/sync if PowerSync free tier becomes a problem); WatermelonDB (weak web story); ElectricSQL (less mature Supabase integration at decision time).

## D-006: Monorepo with pnpm + Turborepo, domain logic as pure TS packages (2026-07-17)

Layout: apps/web, apps/mobile, packages/core (tax, XIRR, FIRE, projections), packages/schema (zod), packages/sync, packages/tokens.
Why: pure functions with exhaustive Vitest suites are the most reliable and token-efficient thing an LLM agent can build; UI phases then consume pre-tested logic.

## D-007: Session and phase protocol for LLM-agent development (2026-07-17)

Phases sized for 1-2 sessions, each ends green and committed.
Session start: read STATUS.md, HANDOFF.md, latest phases/briefing/phase-N.md; do not scan the repo broadly.
Session end: update STATUS.md and HANDOFF.md; phase end additionally writes phases/briefing/phase-N.md.
Why: 5-hour usage windows and weekly limits make cold-start context re-derivation the biggest waste; these files are the warm cache.

## D-008: Web starts on Next.js 16, not Next.js 15 (2026-07-17)

PRODUCTION_PLAN.md specified Next.js 15, but at Phase 0 execution time Next 16.2.10 was the stable `latest` and the 15.x line had moved to a maintenance `backport` dist-tag (15.5.20).
apps/web is pinned to Next 16.2.10 with React 19.2.3 (see D-013 for why React is not on its own latest).
Why: starting a greenfield repo one major behind on a maintenance-only line would have forced a major upgrade a few phases in, for no benefit. App Router and Tailwind v4 (the parts the plan actually depends on) are unchanged.
Decided by the project owner when the discrepancy surfaced.
Consequence: the plan text still says "Next.js 15"; this entry is the correction of record.

## D-009: TypeScript pinned to 6.0.3, not the stable 7.0.2 (2026-07-17)

TypeScript 7.0.2 (the native port) is the published `latest`, but `typescript-eslint@8.64.0` declares a peer range of `typescript >=4.8.4 <6.1.0`, so TS 7 breaks the lint pipeline that every phase must exit green on.
TypeScript 6.0.3 is pinned instead: it sits inside that peer range and is also the version Expo SDK 57 expects (`expo install --check` explicitly asks for `~6.0.3`), so it satisfies both constraints at once.
Why: the lint gate is a hard exit criterion; a toolchain that cannot lint is not a foundation.
Revisit TS 7 when typescript-eslint ships a release that peers it. The pin lives in the root package.json and each workspace package's devDependencies.

## D-010: pnpm uses a hoisted node linker, configured in pnpm-workspace.yaml (2026-07-17)

`pnpm-workspace.yaml` sets `nodeLinker: hoisted`.
Why: Metro (React Native) does not reliably resolve pnpm's default isolated symlink layout. Verified concretely: with the isolated linker, `expo export` failed to resolve `whatwg-fetch` from `@expo/metro-runtime`; with hoisting it bundles clean.
This setting MUST live in pnpm-workspace.yaml. It was first written to `.npmrc` as `node-linker=hoisted`, which pnpm 11 silently ignores - `pnpm config get node-linker` returned `undefined` and installs stayed isolated with no warning. The `.npmrc` has been deleted so it cannot mislead a future session.
Consequence: loses pnpm's strict dependency isolation, so a package can import something it did not declare. Accepted because a working mobile bundler is worth more than that guard at this scale.

## D-011: ESLint pinned to 9.39.5, not 10 (2026-07-17)

ESLint 10.7.0 is the published `latest`, but `@typescript-eslint/scope-manager@8.64.0` does not implement `addGlobals`, an API ESLint 10 calls whenever a config declares globals on a TypeScript-parsed file.
apps/web hit this immediately (`TypeError: scopeManager.addGlobals is not a function`); the pure-TS packages did not, because they only exercise the espree parser path.
Why: typescript-eslint 8.64 advertises `eslint ^10` in its peer range but is not actually ESLint 10-ready for the TS parser path, and eslint-config-next depends on typescript-eslint. ESLint 9.39.5 is fully supported by both.
Revisit alongside [D-009]; the same typescript-eslint release will likely unblock TS 7 and ESLint 10 together.

## D-012: ESLint runs without type-aware rules for now (2026-07-17)

Root eslint.config.mjs uses typescript-eslint's syntactic `recommended`, not `recommended-type-checked`.
Why: type-aware linting across a monorepo needs project-service wiring that is fragile to set up before the packages hold real logic; Phase 0's job is a green, trustworthy pipeline.
Type-only import discipline is instead enforced by the compiler via `verbatimModuleSyntax` in tsconfig.base.json. A `consistent-type-imports` lint rule was tried and removed: it silently requires type information and so contradicts this decision.
Revisit in Phase 2, when packages/core carries the tax engine and type-aware rules start earning their cost.

## D-013: React pinned to 19.2.3 across both apps (2026-07-17)

React and react-dom are pinned to 19.2.3 in apps/web and apps/mobile, though 19.2.7 is published.
Why: Expo SDK 57 expects exactly 19.2.3, and 19.2.3 satisfies Next 16's `^19.0.0` peer range, so one version serves both. Under the hoisted linker (D-010) both apps share a single physical React copy, so they cannot disagree - React must be a workspace-wide decision, not a per-app one.
Consequence: any future React bump has to clear Expo first. `npx expo install --check` in apps/mobile is the authority.

## D-014: Money is a floating-point number of rupees, with mandatory rounding (2026-07-17)

Monetary amounts are JS `number` values in major units (rupees), validated by `MoneySchema` (packages/schema) and rounded to whole paise by `roundToPaise` (packages/core).
This was implicit in the Phase 0 placeholder code; recorded here explicitly because the tax engine (Phase 2) and XIRR/aggregations (Phase 5) bake the representation in deeply.
Rule: every aggregation or rate calculation (sums, interest, tax slab math, XIRR cash flows) must pass through `roundToPaise` before being stored or displayed; never store unrounded intermediate results.
Why: decimal rupees keep rate math and display conversion simple, and with the rounding rule the drift risk is contained; XIRR and projections are approximate by nature anyway.
Rejected: integer paise (safer against drift, but makes every percentage calculation and display conversion noisier). Revisit only if Phase 5 aggregation tests show real drift.
Consequence: `roundToPaise` is paise-accurate up to about 1e10 rupees (1,000 crore) due to its `toPrecision(12)` float correction; fine for personal finance.
