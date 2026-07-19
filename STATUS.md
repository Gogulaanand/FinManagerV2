# Project Status

Last updated: 2026-07-19 (Phase 7 backend deployed + cost-free Chrome verified; AI-cost scenarios, expense-scale, and Expo Go still pending for both phases).

## Current State

- Phase 7 backend is now DEPLOYED to Supabase project `vkivzhbckfsjtvzatuiz` ("finmanager"): migration `20260719000004` applied (ai_usage + ai_summaries, 2 tables / 7 indexes / 2 RLS policies / RLS on, no new advisor findings), `ai-insights` Edge Function deployed (v1, ACTIVE, verify_jwt=true), `ANTHROPIC_API_KEY` secret set by owner, and the PowerSync `ai_summaries` sync rule published. Cost-free Chrome verification passed: `/insights` workspace, scope picker (all six scopes), suggested prompts, ephemeral notice, composer, light/dark, and a live 400-on-invalid-scope from the deployed function. Per owner directive, NO AI Insights test may trigger a real Anthropic call, so the grounded-answer, scope-isolation, ephemeral-reload, summary-persistence, offline-cached-summary, and usage-accounting scenarios were deliberately NOT run. Phase 7 stays In Progress (see D-047).
- Phase 5.3 UX simplification: Chrome structural verification passed live - portfolio hub has no always-open forms and routes to `/portfolio/<id>`; holding detail shows header/value/XIRR/edit, collapsed Add-event/Update-value forms, and a merged newest-first timeline; add-event saved a correctly-signed -₹5,000 outflow and per-entry delete works; stock kind list is exactly Invested more/Sold/Dividend received; Edit holding uses typed fields with no raw JSON and RSU reveals a typed "RSU grant" card; expenses screen shows the "X of Y" count and 6-month trend. The 100+ transaction load-more (scenarios 6-7), offline path (8), and USD/RSU event-form FX (3) could NOT be exercised - the account has 0 transactions and 1 holding; that logic is covered by the passing sync integration tests. Phase 5.3 stays In Progress; no briefing yet (see D-048).

- Phase 4 done: **expenses + budgeting**. The shared schema/core/sync layers now power accounts, seeded Indian categories, concrete debit/credit transactions, recurring expansion, monthly budgets, chart series, and generic CSV import with synced per-bank mappings and import-hash deduplication.
- Phase 5 done (code + Chrome E2E): portfolio holdings, typed metadata, dated FX-aware cash-flow events, XIRR, allocation/net-worth analytics, manual value override precedence, quote provenance, and offline-first CRUD are verified on Chrome with the signed-in test account.
- Chrome E2E steps 1-15 verified this session: accounts, expenses, budget overspend, CSV import dedup (0 created / 2 skipped on repeat), Reliance holding with XIRR ~10%, RSU holding with FX completeness, manual override survivability, net worth, and offline write + PowerSync sync confirmation (both rows reached Supabase).
- Three bugs fixed and committed: `saveTransaction` SELECT-check-then-INSERT pattern (D-033), `effectiveHoldingValue` manual override priority (already in source from prior session), `saveHoldingOn`/`saveHoldingEventOn`/`saveValuationOn` isNew branching fix.
- Expo Go uses SQL.js in-memory adapter: relaunch persistence is deferred to Phase 9 native adapter swap (D-021).

## Next Up

Phase 7 deployment is done. To close Phase 7 the owner must decide how to run the AI-calling scenarios (they involve real Anthropic cost and were forbidden this session): grounded budget answer, scope isolation, ephemeral reload, summary generate/refresh + offline cached render, and usage accounting - plus the Expo Go navigation/streaming/summary checks. The cost-free 429-budget path is also still un-run.

To close Phase 5.3, seed a month with 100+ transactions for the signed-in account and run the load-more scale + aggregate scenarios (6-7), the offline write/reconnect path (8), and the USD/RSU event-form FX display (3) on Chrome; then run the Expo Go scenarios. Fix any regressions, rerun the full gate, write `phases/briefing/phase-5.3.md`, and only then close Phase 5.3.

Phase 6's separate interactive checklist (goals, SIP/status, FIRE settings, offline write/reconnect) also remains outstanding before Phase 7 begins.

Carried-over Phase 5 item: Expo Go mobile interactive verification of Phase 4 + Phase 5 remains outstanding (see HANDOFF.md).

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
| 7     | AI Insights                     | In progress | 1              | [phase-7.md](phases/briefing/phase-7.md) |
| 8     | Inactivity Monitor              | Not started | 0              | -                                        |
| 9     | Hardening + Release             | Not started | 0              | -                                        |

Status values: Not started | In progress | Blocked | Done.

## Update Protocol

Update this file at the end of every working session: phase status, sessions spent, and the briefing link when a phase completes.
Keep this file short; details go in HANDOFF.md (mid-phase) and phases/briefing/phase-N.md (phase completion).
