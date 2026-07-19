# Project Status

Last updated: 2026-07-19 (Phase 5.3 and Phase 7 fully tested and committed; Vercel deployment wired up).

## Current State

- Phase 5.3 (UX simplification) and Phase 7 (AI Insights) are both Done.
  All automated tests pass (`CI=true pnpm turbo run build test lint typecheck` green) and both phases have been manually verified.
  Phase 7 backend is deployed to Supabase `vkivzhbckfsjtvzatuiz`: migration `20260719000004` applied, `ai-insights` Edge Function live (v1, ACTIVE), `ANTHROPIC_API_KEY` set, PowerSync `ai_summaries` rule published.
- The web app is connected to Vercel (`fin-manager-web`).
  The build passes but the app does not load yet - the three `NEXT_PUBLIC_*` env vars have not been set in Vercel (see HANDOFF.md for the exact values and setup steps).
- Phases 0-7 are all done.
  The ordered backlog for Phase 8+ is: correctness sweep (plan-improvements.md), mobile nav / month-picker UX (plan-mobile-nav-and-month-picker.md), Phase 8 dead-man switch (plan-phase8-deadman-switch.md), Phase 9 hardening + release (plan-phase9-hardening-release.md), then monetization/donations.

## Next Up

Set the three Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_POWERSYNC_URL`) and also add the Vercel production URL to Supabase Auth's allowed redirect list.
After that, begin the pre-Phase-8 correctness sweep or Phase 8 (Inactivity Monitor / Dead-Man Switch) per `phases/plans/plan-phase8-deadman-switch.md`.

## Phase Tracker

| Phase | Name                            | Status      | Sessions spent | Briefing                                 |
| ----- | ------------------------------- | ----------- | -------------- | ---------------------------------------- |
| 0     | Monorepo Foundation             | Done        | 1              | [phase-0.md](phases/briefing/phase-0.md) |
| 1     | Design System                   | Done        | 1              | [phase-1.md](phases/briefing/phase-1.md) |
| 2     | Tax Calculator (India)          | Done        | 1              | [phase-2.md](phases/briefing/phase-2.md) |
| 3     | Auth + Offline-First Data Layer | Done        | 1              | [phase-3.md](phases/briefing/phase-3.md) |
| 4     | Expenses + Budgeting            | Done        | 1              | [phase-4.md](phases/briefing/phase-4.md) |
| 5     | Portfolio + Investments         | Done        | 2              | [phase-5.md](phases/briefing/phase-5.md) |
| 6     | Goals + Retirement + FIRE       | Done        | 1              | [phase-6.md](phases/briefing/phase-6.md) |
| 7     | AI Insights                     | Done        | 1              | [phase-7.md](phases/briefing/phase-7.md) |
| 8     | Inactivity Monitor              | Not started | 0              | -                                        |
| 9     | Hardening + Release             | Not started | 0              | -                                        |

Status values: Not started | In progress | Blocked | Done.

## Update Protocol

Update this file at the end of every working session: phase status, sessions spent, and the briefing link when a phase completes.
Keep this file short; details go in HANDOFF.md (mid-phase) and phases/briefing/phase-N.md (phase completion).
