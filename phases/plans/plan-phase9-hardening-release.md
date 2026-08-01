# Plan: Phase 9 - Hardening + Release

Status: blocked (tracked implementation complete; account, production, and device release gates
pending; see `phases/briefing/phase-9.md`).
Priority: after Phase 8 (see plan-phase8-deadman-switch.md).
Four sub-phases, each sized to one agent session: 9a E2E harnesses, 9b web deploy + observability, 9c mobile native track, 9d export/import + release.
Implements the PRODUCTION_PLAN.md Phase 9 spec and resolves its carried-over items.

## Cross-doc dependencies

| Dependency                         | Produced by | Consumed by                                                         |
| ---------------------------------- | ----------- | ------------------------------------------------------------------- |
| Resend + Auth SMTP                 | Phase 8a    | 9b end-to-end signup verification (D-024)                           |
| Seeded E2E test data               | 9a          | 9b preview-deploy tests; closes the Phase 5.3/6/7 verification debt |
| EAS dev build                      | 9c          | op-sqlite adapter swap, Maestro on device, mobile Google sign-in    |
| Deployed web + native mobile build | 9b + 9c     | Monetization Path A shipping surface                                |

## R0 baseline — 2026-08-01

The implementation described by this plan is complete in the merged Phase 9 commit `38f3f63`.
The current `phase9-operator-audit-20260801` checkout adds operator-audit evidence and documentation;
those commits are tracked separately from the merged implementation.

### Implemented

- Deterministic user-scoped seed, Playwright critical paths, Maestro flows, strict expense-template
  import, versioned JSON/CSV export, web/native Sentry wiring, EAS profiles, Google OAuth flow,
  OP-SQLite/SQLCipher adapter, and cron observability.
- The release checklist and Phase 9 briefing record the exact implementation surface and deployment
  identifiers; this plan remains the historical implementation scope and dependency map.

### Automated evidence complete

- `CI=true pnpm turbo run build test lint typecheck` passes all 21 tasks with 323 unit tests;
  formatting and `git diff --check` pass.
- Both Expo JavaScript exports pass and the integrated Playwright suite collects 12 tests. Historical
  Preview E2E run `30188066854` passed; a fresh current-head CI/Preview run still needs evidence.

### External/manual evidence pending

- Production authentication/data sync and clean signup, Sentry event/source-map proof, dead-man
  approval/monitor/heartbeat, native persistence/SQLCipher/offline-relaunch, family distribution,
  target-device export/share-sheet use, and clean-account restore remain open.

### Explicitly deferred

- Public signup, payments, public app-store distribution, paid AI verification, and a production-ready
  dead-man switch are outside the personal-use MVP gate. See the canonical risk register for the
  current personal-MVP go/no-go decision.

---

## Sub-phase 9a: E2E harnesses (1 session)

### Concept: scripted E2E supersedes manual verification debt

The outstanding Phase 5.3/6/7 interactive scenarios keep slipping because they need a human, a seeded account, and a browser session.
Encoding them as Playwright/Maestro flows with a deterministic seed fixture pays the cost once and then runs in CI forever.
This sub-phase deliberately folds that debt in rather than re-running manual passes.

Scope:

- Seed fixture: a script (`e2e/seed.ts` or SQL) that provisions the E2E test account with a known dataset, including a 120+ transaction month (unlocks the D-048 load-more scale scenarios), holdings with events, a goal, and FIRE settings.
- Playwright (`apps/web/playwright.config.ts` + `apps/web/e2e/`): auth sign-in, add/edit/delete expense, month navigation (once plan-mobile-nav-and-month-picker.md sub-phase B lands), budget overspend, CSV import dedup (import twice, second run creates zero), tax calculator regime comparison, portfolio holding + XIRR view, goals status.
  Headless in CI against a local dev server with the seeded account.
- Maestro (`.maestro/` flows): the same critical paths on mobile; runnable against Expo Go now, re-run on the dev build in 9c (the offline-relaunch flow only makes sense there because SQL.js is in-memory).
- AI Insights scenarios: script the cost-free paths (400 invalid scope, 429 budget); the real-Anthropic-call scenarios remain owner-gated for cost (D-047) and get a documented manual one-time checklist instead.
- CI: add a Playwright job to `.github/workflows/ci.yml`.

Exit criteria: Playwright suite green in CI; Maestro flows pass locally against Expo Go; seed fixture documented; verification-debt scenarios from D-047/D-048 either encoded or explicitly listed as owner-gated.

## Sub-phase 9b: web deploy + observability (1 session)

Scope:

- Vercel: project wiring, production + preview environments, env vars (`NEXT_PUBLIC_SUPABASE_URL` etc.), `vercel.json` only if defaults need overriding.
  Note: the PowerSync web workers are copied into `apps/web/public/@powersync/` by a postinstall and that dir is gitignored; confirm the Vercel build runs the postinstall.
- Sentry via `@sentry/nextjs` (free tier): client + server init, source maps uploaded in CI, DSN in env.
- Signup verification: complete a real signup from a clean browser on the deployed URL, proving the 8a Resend/Auth SMTP work end to end (closes D-024).
- CI: run the Playwright suite against Vercel preview deployments on PRs.

Exit criteria: production URL live and usable; one intentional test error visible in Sentry; a fresh signup completes without manual SQL; CI runs E2E against previews.

## Sub-phase 9c: mobile native track (1 session; EAS builds run in background)

Everything here needs a dev build, so it is bundled to amortize the EAS wait time.

Scope:

- `apps/mobile/eas.json`: development / preview / production profiles; expand `app.json` (identifier, version, projectId).
- Adapter swap (D-021): in `apps/mobile/lib/powersync.ts`, add the `Constants.executionEnvironment` switch so Expo Go keeps SQL.js and dev/production builds use `@powersync/op-sqlite` with SQLCipher at-rest encryption.
  This satisfies the plan's "encrypted local storage" security item and finally gives mobile relaunch persistence.
- Error tracking: `sentry-expo` wired to the same Sentry org.
- Google sign-in on mobile (carried-over from Phase 3): expo-web-browser + deep-link OAuth flow; email/password remains the fallback.
- Real-device verification (carried-over): airplane-mode write, relaunch (now persistent), reconnect, row visible on web; run the Maestro suite on the dev build including the offline-relaunch flow.
- Do not `pnpm add` native deps while a dev server runs (D-020); use `npx expo install` for SDK-pinned versions.

Exit criteria: dev build installed on a real device; offline round-trip with relaunch persistence proven; DB encrypted at rest confirmed; Google login works; Maestro green on device.

## Sub-phase 9d: export/import + release (1 session)

Scope:

- Full data export (plan item "backup/export"): a versioned JSON bundle (schema version + all entities) plus per-module CSVs (transactions, holdings/events), generated as pure functions in `packages/core/src/export/` from repository reads, with Vitest round-trip tests.
  Web: file download from the settings page (built in 8b).
  Mobile: share sheet via `expo-sharing`/`expo-file-system`.
- Strict expense template import (plan item): header exactly `date,category,amount,type`; downloadable sample template; zod row validation (`date` as YYYY-MM-DD, `amount` positive number, `type` in income|expense); category matched case-insensitively with missing categories auto-created and flagged in the result summary; malformed rows rejected with a row-numbered error report; dedup via the existing canonical import hash.
  Implementation: a stricter mapper preset layered on the existing importer (`packages/core/src/expenses/csv.ts` + `apps/web/src/components/expenses/csv-import.tsx` + mobile equivalent), not a second pipeline.
- Performance pass on mid-range Android: cold start, list scroll on the 120-row seeded month (FlatList already owns the screen per D-040), chart render; record numbers in the briefing and fix only egregious findings.
- Distribution decision (plan item "app store / direct install"): EAS internal distribution - Android APK install link + TestFlight internal group for family iPhones; no public store listing at family scale.
  Revisit only if monetization Path B is ever triggered; staying off the stores also avoids store-billing obligations (see plan-monetization.md).
- Cleanup (carried-over): delete the Phase 3 test account `gogulaanand02+webtest@gmail.com` and its synced rows, with explicit owner approval at execution time.
- Cron observability for the inactivity monitor (added 2026-07-25 from Phase 8 findings, D-058/D-061).
  `cron.job_run_details` cannot be used as a health signal: `net.http_post` only enqueues the request, so the job records `succeeded` no matter what the function returns. This was observed directly - the 2026-07-24 03:00 run reported `succeeded` while the function recorded a failed `reminder_1`. `net._http_response` captured a null status code and pg_net purges those rows within hours.
  Two mechanisms are needed because they catch different failures:
  1. Ran-but-failed: `deadman-check` writes its own outcome (`ran_at`, `enabled`, `processed`, `failed`, `detail`) to a `cron_runs` table on every invocation - it already computes these for its response. A second scheduled job checks the latest row and emails the owner via Resend when `failed > 0`. This beats inspecting `escalation_events`, because a skipped user writes no ledger row at all.
  2. Didn't-run-at-all: an external heartbeat (healthchecks.io free tier or equivalent) pinged by the function only on a clean run, alerting when the ping does not arrive within the grace window.
     Mechanism 2 is not optional. A system cannot detect its own absence: if the project is paused, pg_cron is disabled, the function is deleted, or Supabase has an outage, no internal checker runs either and silence is indistinguishable from health. That is the dead-man switch's own reasoning applied one level up.
     The heartbeat call must be guarded by an env var so it no-ops when unset, and must never fail the run.
- Release checklist: envs documented, secrets inventoried, briefing + STATUS.md close-out, `phases/briefing/phase-9.md`.

Exit criteria: family members installed and using both platforms; export produces a re-importable bundle; template import rejects malformed files with row-level errors; PRODUCTION_PLAN.md Phase 9 exit criteria met.

---

## Carried-over items ledger (from PRODUCTION_PLAN.md Phase 9 section)

| Item                                   | Resolved in                                     |
| -------------------------------------- | ----------------------------------------------- |
| Auth email delivery (D-024)            | Built in Phase 8a, verified in 9b               |
| Mobile PowerSync adapter swap (D-021)  | 9c                                              |
| Mobile offline round-trip verification | 9c                                              |
| Google sign-in on mobile               | 9c                                              |
| Test account cleanup                   | 9d                                              |
| Mobile add/edit modal routes           | plan-mobile-nav-and-month-picker.md sub-phase A |
| Expenses month/year navigation         | plan-mobile-nav-and-month-picker.md sub-phase B |
| Expense template import                | 9d                                              |

## Risks

- EAS build queue times can eat a session: start builds first and do other 9c work while waiting (house background-operations rule).
- SQLCipher key management: derive/store the DB key in `expo-secure-store`; document the reset path (key loss means local re-sync from Supabase, which PowerSync handles).
- Playwright against PowerSync/wa-sqlite needs OPFS support in the CI browser; pin Chromium and verify early in 9a.
- Supabase free-tier email/day and Edge Function quotas: fine at family scale, but note ceilings in the release checklist for the monetization plan to reference.
