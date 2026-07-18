# Project Status

Last updated: 2026-07-18 (Phase 3 complete).

## Current State

- Phase 3 done: **auth + offline-first data layer**. Supabase project `finmanager` live with the full 13-table data model, per-table RLS (proven at the PostgREST layer), and PowerSync sync. `packages/sync` holds the shared client schema, Supabase connector, and repositories. Tax scenarios moved off local storage onto the synced `tax_scenarios` table; the calculator still runs signed-out, saving needs an account.
- `pnpm turbo run build test lint typecheck` -> **21/21**; `pnpm format:check` clean; sync suite adds 15 tests.
- Verified on **web** end to end against the live backend, including the offline-write-then-sync round trip (disconnect -> local write -> reconnect -> appears in Supabase) and RLS isolation between two users. **Mobile** (Expo Go) bundles and boots with the full stack and no runtime errors; interactive sign-in/sync was not drivable in the no-touch simulator (same shared connector as web).
- Open items: Supabase email confirmation is ON but the built-in mailer is rate-limited (real signups blocked until SMTP/Resend, Phase 9); Google sign-in is web-only so far; a web test account with synced scenarios is left in Supabase for the owner to verify cross-platform sync-down, then delete (D-021..D-024).

## Next Up

**Phase 4: Expenses + Budgeting** (see PRODUCTION_PLAN.md, `### Phase 4`).
Start by reading `phases/briefing/phase-3.md` and only the files it lists. The
`accounts`/`categories`/`transactions`/`budgets` tables already exist with RLS
and are in `AppSchema`; Phase 4 adds core logic and UI over the established
reactive-query-plus-repository pattern (see `useScenarios`).

## Phase Tracker

| Phase | Name                            | Status      | Sessions spent | Briefing                                 |
| ----- | ------------------------------- | ----------- | -------------- | ---------------------------------------- |
| 0     | Monorepo Foundation             | Done        | 1              | [phase-0.md](phases/briefing/phase-0.md) |
| 1     | Design System                   | Done        | 1              | [phase-1.md](phases/briefing/phase-1.md) |
| 2     | Tax Calculator (India)          | Done        | 1              | [phase-2.md](phases/briefing/phase-2.md) |
| 3     | Auth + Offline-First Data Layer | Done        | 1              | [phase-3.md](phases/briefing/phase-3.md) |
| 4     | Expenses + Budgeting            | Not started | 0              | -                                        |
| 5     | Portfolio + Investments         | Not started | 0              | -                                        |
| 6     | Goals + Retirement + FIRE       | Not started | 0              | -                                        |
| 7     | AI Insights                     | Not started | 0              | -                                        |
| 8     | Inactivity Monitor              | Not started | 0              | -                                        |
| 9     | Hardening + Release             | Not started | 0              | -                                        |

Status values: Not started | In progress | Blocked | Done.

## Update Protocol

Update this file at the end of every working session: phase status, sessions spent, and the briefing link when a phase completes.
Keep this file short; details go in HANDOFF.md (mid-phase) and phases/briefing/phase-N.md (phase completion).
