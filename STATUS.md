# Project Status

Last updated: 2026-07-17 (Phase 2 complete).

## Current State

- Phase 2 done: an offline old-vs-new-regime income tax calculator for **FY 2026-27** (Income-tax Act, 2025), engine as pure tested functions in `packages/core/tax`, UI on web + mobile with Easy/Advanced modes and locally-persisted named scenarios.
- Scope changed from the plan: FY 2026-27 only, not 2025-26/2024-25 (D-018). FY 2026-27 is the first year under the new 2025 Act (new regime = s.202, rebate = s.156).
- `pnpm turbo run build test lint typecheck` -> 17/17 successful; `pnpm format:check` clean; core suite now **87 tests** (was 20).
- Verified by eye on both platforms: a real 24L salary computes identically on web (Chrome) and mobile (Expo Go, iOS 26.3 sim) and matches the hand-computed test values.

## Next Up

**Phase 3: Auth + Offline-First Data Layer** (see PRODUCTION_PLAN.md, `### Phase 3`).
Start by reading `phases/briefing/phase-2.md` and only the files it lists.

## Phase Tracker

| Phase | Name                            | Status      | Sessions spent | Briefing                                 |
| ----- | ------------------------------- | ----------- | -------------- | ---------------------------------------- |
| 0     | Monorepo Foundation             | Done        | 1              | [phase-0.md](phases/briefing/phase-0.md) |
| 1     | Design System                   | Done        | 1              | [phase-1.md](phases/briefing/phase-1.md) |
| 2     | Tax Calculator (India)          | Done        | 1              | [phase-2.md](phases/briefing/phase-2.md) |
| 3     | Auth + Offline-First Data Layer | Not started | 0              | -                                        |
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
