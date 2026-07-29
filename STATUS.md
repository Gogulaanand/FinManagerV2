# Project Status

Last updated: 2026-07-29 (Phase 9 rebased onto merged Phase 8.5; local gates pass;
post-rebase Preview evidence and external/device release gates remain open).

## Current State

- Phase 5.3 (UX simplification) and Phase 7 (AI Insights) are both Done.
  All automated tests pass (`CI=true pnpm turbo run build test lint typecheck` green) and both phases have been manually verified.
  Phase 7 backend is deployed to Supabase `vkivzhbckfsjtvzatuiz`: migration `20260719000004` applied, `ai-insights` Edge Function live (v1, ACTIVE), `ANTHROPIC_API_KEY` set, PowerSync `ai_summaries` rule published.
- The Vercel project `fin-manager-web` is live. Production deployment
  `dpl_9vkdpiaMxLPBx3QoYRG4MuxbNVP3` for merged Phase 8.5 commit `93c255b` is READY, and the three
  public Supabase/PowerSync variables exist in Development, Preview, and Production. No Sentry
  variables are configured, so release creation, source-map upload, and intentional-event checks
  remain blocked.
- Phases 0-8 are done. Phase 8.5 is merged; its real-touch Victory chart interaction remains
  pending device-only evidence.
- Phase 9 is implemented on PR #4 from `phase-9-hardening-release`: deterministic Playwright/Maestro
  harnesses, strict expense-template import, versioned export on web/mobile, Sentry wiring,
  EAS profiles, Google OAuth flow, encrypted OP-SQLite native adapter, and cron observability.
  It is rebased onto `93c255b`. The exact 21/21 Turbo gate passes with 323 unit tests, formatting
  passes, both Expo exports pass, and 12 integrated Chromium tests collect. GitHub now has all seven
  required secrets, including `VERCEL_AUTOMATION_BYPASS_SECRET`; the fresh post-rebase CI and
  Preview runs are pending the branch update.
- Supabase has the Phase 9 migration, `deadman-check` v11 and `deadman-monitor` v1 active with
  `verify_jwt=false`, and three `cron_runs`; the latest daily run at
  `2026-07-29T03:00:04.225557Z` records `failed=0`. This observed deployment does not substitute for
  the required owner approval to retain that gateway setting. The monitor schedule, enable flag,
  external heartbeat, and alert evidence remain absent.
- The repo-wide improvements plan (`phases/plans/plan-improvements.md`) is implemented in the current worktree: AI usage reservation is atomic, stream cancellation/timeouts and sync gates are in place, domain math is shared in core, and the largest setup/metadata forms have been extracted. Local package builds, tests, typechecks, linters, formatting checks, and the web production build pass. Both Supabase migrations are applied locally and remotely; local and linked pgTAP tests pass, and the concurrent reserve/release flow was verified through Supabase MCP. Owner review is pending before commit.
  Phase 8 dead-man switch implementation is raised as a PR against `main` from `phase-8-inactivity-monitor`. The migration, Edge Function (v4), Vault wiring, cron schedule, and staged remote data are deployed, the PowerSync sync rules are published, and the Resend domain `finmanager.sunfabb.com` is verified with `RESEND_FROM_EMAIL` pointed at it.
  All four escalation stages were delivered end to end on 2026-07-24 (Resend reports `delivered`, not merely accepted) and the repeated final stage created no duplicate rows. That run predates Edge Function v4, so it has not been replayed against the deployed code. Remaining gates are the v4 replay, Auth SMTP plus a real signup email, and Chrome/native interactive verification.

## Next Up

Push the rebased Phase 9 branch with `--force-with-lease`, then require the integrated 12-test CI and
protected Preview suites to pass. Next configure Sentry, authenticate/link EAS, record explicit
owner approval for the deployed custom-auth functions, finish monitor/heartbeat evidence, and
complete the real-device/family-install checklist. Do not mark Phase 9 Done before those results
exist.

Plan index: [improvements](phases/plans/plan-improvements.md) · [mobile navigation/month picker](phases/plans/plan-mobile-nav-and-month-picker.md) · [Phase 8](phases/plans/plan-phase8-deadman-switch.md) · [Phase 9](phases/plans/plan-phase9-hardening-release.md) · [monetization](phases/plans/plan-monetization.md).

## Phase Tracker

| Phase | Name                            | Status      | Sessions spent | Briefing                                     |
| ----- | ------------------------------- | ----------- | -------------- | -------------------------------------------- |
| 0     | Monorepo Foundation             | Done        | 1              | [phase-0.md](phases/briefing/phase-0.md)     |
| 1     | Design System                   | Done        | 1              | [phase-1.md](phases/briefing/phase-1.md)     |
| 2     | Tax Calculator (India)          | Done        | 1              | [phase-2.md](phases/briefing/phase-2.md)     |
| 3     | Auth + Offline-First Data Layer | Done        | 1              | [phase-3.md](phases/briefing/phase-3.md)     |
| 4     | Expenses + Budgeting            | Done        | 1              | [phase-4.md](phases/briefing/phase-4.md)     |
| 5     | Portfolio + Investments         | Done        | 2              | [phase-5.md](phases/briefing/phase-5.md)     |
| 6     | Goals + Retirement + FIRE       | Done        | 1              | [phase-6.md](phases/briefing/phase-6.md)     |
| 7     | AI Insights                     | Done        | 1              | [phase-7.md](phases/briefing/phase-7.md)     |
| 8     | Inactivity Monitor              | Done        | 1              | [phase-8.md](phases/briefing/phase-8.md)     |
| 8.5   | Design Alignment                | In progress | 1              | [phase-8.5.md](phases/briefing/phase-8.5.md) |
| 9     | Hardening + Release             | Blocked     | 1              | [phase-9.md](phases/briefing/phase-9.md)     |

Status values: Not started | In progress | Blocked | Done.

## Update Protocol

Update this file at the end of every working session: phase status, sessions spent, and the briefing link when a phase completes.
Keep this file short; details go in HANDOFF.md (mid-phase) and phases/briefing/phase-N.md (phase completion).
