# Project Status

Last updated: 2026-08-02 (R1.1 sync durability, R1.2 safe auth transitions, and R1.3 sync-health
surfaces are merged and protected CI/Preview verified; R2.1 recovery-export hardening is complete
locally and its restore, production-auth, and device gates remain open).

## Current State

The canonical release gate and risk register is [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md).
R0 is complete: this file, the Phase 9 handoff/briefing/checklist/plan, and the risk register now
separate implemented work, automated evidence, external/manual evidence, and explicit deferrals.
R1.1 is complete on `codex/r1-production-readiness`: the sync-durability architecture is recorded in
[docs/R1.1_SYNC_DURABILITY.md](docs/R1.1_SYNC_DURABILITY.md) and D-076. The shared connector now uses
one authenticated atomic RPC, rejected/ambiguous transactions remain queued with local recovery
records, bounded retries fail closed, explicit discard is user-scoped, and all synced tables track
previous values. The migration is applied to the linked Supabase project and verified through the
Supabase API: the RPC, journal table, and authenticated execute grant exist (remote migration
version `20260802043941`).
R1.2 is merged as PR #9 (`60b54c9`): explicit sign-out waits up to eight seconds
for the upload queue, unresolved work opens a retry/recovery/acknowledged-discard flow, transient
session loss disconnects without clearing, and a different account cannot attach to retained unsafe
data. The contract is recorded in [docs/R1.2_AUTH_TRANSITION_SAFETY.md](docs/R1.2_AUTH_TRANSITION_SAFETY.md)
and D-077. R1.3 is merged as PR #10 (`ec17b2f`): web and mobile Settings now expose synced,
syncing, offline, and action-required states, queue/failure counts, last complete sync, safe failure
summaries, and a retry/reconnect action.
R2.1 is implemented on `codex/r2-recovery-export`: schema-v2 recovery bundles now carry the app
version, anonymized account fingerprint, source platform, PowerSync sync state, per-collection row
counts, deterministic checksums, and explicit completeness warnings. Every exported domain row is
validated through its relevant Zod schema adapter before serialization. Complete backups require a
full sync, no unresolved failed writes or sync errors, and explicit acknowledgement when pending
writes are included; recovery exports remain available for unsafe local state.

### Implemented

- Phase 5.3 (UX simplification) and Phase 7 (AI Insights) are both Done.
  All automated tests pass (`CI=true pnpm turbo run build test lint typecheck` green) and both phases have been manually verified.
  Phase 7 backend is deployed to Supabase `vkivzhbckfsjtvzatuiz`: migration `20260719000004` applied, `ai-insights` Edge Function live (v1, ACTIVE), `ANTHROPIC_API_KEY` set, PowerSync `ai_summaries` rule published.
- The Vercel project `fin-manager-web` is live. Production deployment
  for commit `38f3f633896632a94a930d8d50fb36124c790a0f` is READY, and the three public
  Supabase/PowerSync variables exist in Development, Preview, and Production. The existing
  non-secret Sentry DSN/org/project values are also configured across the Vercel environments, but
  release creation, source-map upload, and intentional-event checks remain blocked by missing auth
  and test tokens. The production shell and sign-in route load, but authenticated data sync is not
  proven.
- The 2026-08-01 operator audit saved the canonical production, scoped Vercel preview, local
  development, and `finmanager://auth/callback` redirects in Supabase Auth. Auth SMTP is enabled
  with the verified `finmanager.sunfabb.com` sender domain; clean signup delivery still requires an
  owner-controlled test account. The Sentry project exists with a client key; its existing
  non-secret DSN/org/project values are now configured in Vercel, with the current-commit
  production redeploy READY, but auth/test tokens and event/source-map evidence are absent. A real Expo
  project is linked in `apps/mobile/app.json`, with existing runtime values saved across all EAS
  environments. The GitHub-triggered Android internal development build `466fd4fc` finished
  successfully from commit `1c2cdc7`; device installation and native acceptance remain open.
- Phases 0-8 are done. Phase 8.5 is merged; its real-touch Victory chart interaction remains
  pending device-only evidence; that evidence is tracked under Phase 9 rather than treating the
  merged design implementation as unfinished.
- Phase 9 implementation is merged in `38f3f63` from `phase-9-hardening-release`. The current
  `phase9-operator-audit-20260801` checkout contains the operator-audit/documentation follow-up at
  `8f22b6c`, `1c2cdc7`, and `9bfc03a`; local branch evidence does not by itself prove that follow-up
  is merged to `main`.
- The implemented Phase 9 surface includes deterministic Playwright/Maestro harnesses,
  strict expense-template import, versioned export on web/mobile, Sentry wiring, EAS profiles,
  Google OAuth flow, encrypted OP-SQLite native adapter, and cron observability.

### Automated evidence complete

- The exact 21/21 Turbo gate passes with 358 unit tests; formatting and `git diff --check` pass.
  Both Expo exports pass, and 13 integrated Chromium tests collect. Seven GitHub E2E secrets exist,
  including `VERCEL_AUTOMATION_BYPASS_SECRET`; historical Preview E2E run `30188066854` passed.
- R1.1 adds 68 passing sync-package tests and a 32-assertion PostgreSQL behavior matrix. The full
  local database suite passes 47 assertions, including atomic rollback, RLS/allowlisting,
  idempotent replay before and after commit, ownership isolation, conflict handling, and typed
  PATCH/DELETE behavior.
- R1.2/R1.3 keep the sync package at 82 passing tests. Ten R1.2 policy/recovery cases plus four
  R1.3 health/retry/status cases cover bounded online drain,
  offline timeout, failed writes, export/acknowledgement guards, transient loss, same/different-user
  isolation, recovery-artifact contents, health counts, safe summaries, retry transitions, and
  status precedence. Web/mobile typecheck and lint pass; PR #10 CI and Preview E2E each pass all 13
  critical-path tests.
- R2.1 adds five core export tests covering schema-v2 round trips, warning/completeness gates,
  checksums, and domain-row rejection; the sync recovery-artifact test verifies PowerSync-derived
  metadata and account fingerprinting.

### Observed deployed state (not release proof)

- Supabase has the Phase 9 migration, `deadman-check` v11 and `deadman-monitor` v1 active with
  `verify_jwt=false`, and three `cron_runs`; the latest daily run at
  `2026-07-29T03:00:04.225557Z` records `failed=0`. This observed deployment does not substitute for
  the required owner approval to retain that gateway setting. The monitor schedule, enable flag,
  external heartbeat, and alert evidence remain absent.
- The repo-wide improvements plan (`phases/plans/plan-improvements.md`) is implemented in the current worktree: AI usage reservation is atomic, stream cancellation/timeouts and sync gates are in place, domain math is shared in core, and the largest setup/metadata forms have been extracted. Local package builds, tests, typechecks, linters, formatting checks, and the web production build pass. Both Supabase migrations are applied locally and remotely; local and linked pgTAP tests pass, and the concurrent reserve/release flow was verified through Supabase MCP.
  Phase 8 dead-man switch implementation is merged in `29ff1aa`. The migration, Edge Function (v4), Vault wiring, cron schedule, and staged remote data are deployed, the PowerSync sync rules are published, and the Resend domain `finmanager.sunfabb.com` is verified with `RESEND_FROM_EMAIL` pointed at it.
  All four escalation stages were delivered end to end on 2026-07-24 (Resend reports `delivered`, not merely accepted) and the repeated final stage created no duplicate rows. That run predates Edge Function v4, so the v4 replay, independent monitor/heartbeat, Auth SMTP signup, and Chrome/native interactive evidence remain open release gates.

### External/manual evidence pending

- Authenticated production sign-in/data sync, clean signup delivery, Sentry runtime/source-map proof,
  dead-man approval/monitor/heartbeat, Android device acceptance, family distribution, and paid-AI
  verification remain unproven.
- The personal-use MVP is **No-Go** until the P0 data-integrity/recovery items in the canonical risk
  register are implemented and evidenced, a full backup is restored in a clean environment, and
  web/Android authentication and native persistence are proven.

### Explicitly deferred

- Public signup, iOS/TestFlight, payments, public app-store distribution, feedback tooling, paid AI
  verification, and a production-ready dead-man switch are outside the personal-use MVP gate.

## Next Up

After the R2.1 PR is checked and merged, start R2.2 restore on a fresh branch: dependency-ordered
restore, conflict policy, dry-run/reporting, and a clean-account proof remain separate from export
creation. In parallel, the owner-controlled production, Sentry, dead-man, and Android-device gates
remain external evidence work. Do not mark Phase 9 Done before its required evidence exists.

Plan index: [improvements](phases/plans/plan-improvements.md) · [mobile navigation/month picker](phases/plans/plan-mobile-nav-and-month-picker.md) · [Phase 8](phases/plans/plan-phase8-deadman-switch.md) · [Phase 9](phases/plans/plan-phase9-hardening-release.md) · [monetization](phases/plans/plan-monetization.md).

## Phase Tracker

| Phase | Name                            | Status  | Sessions spent | Briefing                                     |
| ----- | ------------------------------- | ------- | -------------- | -------------------------------------------- |
| 0     | Monorepo Foundation             | Done    | 1              | [phase-0.md](phases/briefing/phase-0.md)     |
| 1     | Design System                   | Done    | 1              | [phase-1.md](phases/briefing/phase-1.md)     |
| 2     | Tax Calculator (India)          | Done    | 1              | [phase-2.md](phases/briefing/phase-2.md)     |
| 3     | Auth + Offline-First Data Layer | Done    | 1              | [phase-3.md](phases/briefing/phase-3.md)     |
| 4     | Expenses + Budgeting            | Done    | 1              | [phase-4.md](phases/briefing/phase-4.md)     |
| 5     | Portfolio + Investments         | Done    | 2              | [phase-5.md](phases/briefing/phase-5.md)     |
| 6     | Goals + Retirement + FIRE       | Done    | 1              | [phase-6.md](phases/briefing/phase-6.md)     |
| 7     | AI Insights                     | Done    | 1              | [phase-7.md](phases/briefing/phase-7.md)     |
| 8     | Inactivity Monitor              | Done    | 1              | [phase-8.md](phases/briefing/phase-8.md)     |
| 8.5   | Design Alignment                | Done    | 1              | [phase-8.5.md](phases/briefing/phase-8.5.md) |
| 9     | Hardening + Release             | Blocked | 1              | [phase-9.md](phases/briefing/phase-9.md)     |

Status values: Not started | In progress | Blocked | Done.

## Update Protocol

Update this file at the end of every working session: phase status, sessions spent, and the briefing link when a phase completes.
Keep this file short; details go in HANDOFF.md (mid-phase) and phases/briefing/phase-N.md (phase completion).
