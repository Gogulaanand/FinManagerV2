# Project Status

Last updated: 2026-07-29 (Phase 8.5 implementation, local gates, seeded web E2E, and compact/large simulator passes complete; real-touch native evidence pending).

## Current State

- Phase 5.3 (UX simplification) and Phase 7 (AI Insights) are both Done.
  All automated tests pass (`CI=true pnpm turbo run build test lint typecheck` green) and both phases have been manually verified.
  Phase 7 backend is deployed to Supabase `vkivzhbckfsjtvzatuiz`: migration `20260719000004` applied, `ai-insights` Edge Function live (v1, ACTIVE), `ANTHROPIC_API_KEY` set, PowerSync `ai_summaries` rule published.
- The web app is connected to Vercel (`fin-manager-web`).
  The build passes but the app does not load yet - the three `NEXT_PUBLIC_*` env vars have not been set in Vercel (see HANDOFF.md for the exact values and setup steps).
- Phases 0-7 are all done.
- Phase 8.5 design alignment is implemented on the isolated
  `phase-8.5-design-alignment` worktree. Shared category presentation, dashboard allocation, chart
  parity, AI Insights and dead-man redesigns, cross-module icons, focused unit coverage, and a
  cost-free Playwright harness are present. The 21/21 Turbo gate, formatting, diff checks, Expo iOS
  export, signed-out light/dark responsive Chrome checks, and an authenticated iPhone 17 Pro Expo
  Go pass all succeed. A light/dark iPad Pro 13-inch pass covers the large native viewport. The
  seeded five-scenario Playwright suite passes. Only real-touch chart interaction remains as
  explicitly pending device-only evidence.
- Phase 9 is paused in its separate checkout and has not been modified by Phase 8.5. It must be
  rebased onto updated `main` only after this phase lands.
- The repo-wide improvements plan (`phases/plans/plan-improvements.md`) is implemented in the current worktree: AI usage reservation is atomic, stream cancellation/timeouts and sync gates are in place, domain math is shared in core, and the largest setup/metadata forms have been extracted. Local package builds, tests, typechecks, linters, formatting checks, and the web production build pass. Both Supabase migrations are applied locally and remotely; local and linked pgTAP tests pass, and the concurrent reserve/release flow was verified through Supabase MCP. Owner review is pending before commit.
  Phase 8 dead-man switch implementation is raised as a PR against `main` from `phase-8-inactivity-monitor`. The migration, Edge Function (v4), Vault wiring, cron schedule, and staged remote data are deployed, the PowerSync sync rules are published, and the Resend domain `finmanager.sunfabb.com` is verified with `RESEND_FROM_EMAIL` pointed at it.
  All four escalation stages were delivered end to end on 2026-07-24 (Resend reports `delivered`, not merely accepted) and the repeated final stage created no duplicate rows. That run predates Edge Function v4, so it has not been replayed against the deployed code. Remaining gates are the v4 replay, Auth SMTP plus a real signup email, and Chrome/native interactive verification.

## Next Up

Set the three Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_POWERSYNC_URL`) and also add the Vercel production URL to Supabase Auth's allowed redirect list.
Complete the real-touch chart/gesture checks or retain them explicitly as pending device-only
evidence, then land Phase 8.5 on `main` before rebasing the paused Phase 9 branch. Phase 8's v4
replay, Auth SMTP, and delivery gates remain separate.

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
| 8     | Inactivity Monitor              | In progress | 1              | [phase-8.md](phases/briefing/phase-8.md)     |
| 8.5   | Design Alignment                | In progress | 1              | [phase-8.5.md](phases/briefing/phase-8.5.md) |
| 9     | Hardening + Release             | Not started | 0              | -                                            |

Status values: Not started | In progress | Blocked | Done.

## Update Protocol

Update this file at the end of every working session: phase status, sessions spent, and the briefing link when a phase completes.
Keep this file short; details go in HANDOFF.md (mid-phase) and phases/briefing/phase-N.md (phase completion).
