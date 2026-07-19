# Plan: Repo-Wide Improvements Backlog

Status: findings from a full-repo quality sweep (2026-07-19), organized into three one-session sub-phases plus items delegated to the other plans.
Positive findings first, because they bound the work: no `any`/`@ts-expect-error`/`eslint-disable` in first-party source, no genuine TODO/FIXME/HACK, and the offline-first rule holds - every UI data read goes through PowerSync `useQuery`; the only `fetch` calls are the sanctioned AI edge function and `supabase.auth`.

## Cross-doc dependencies

| Dependency | Produced by | Consumed by |
| --- | --- | --- |
| Atomic `ai_usage` RPC (#1) | I1 here | Monetization Path B per-plan budgets |
| `logActivity` hardening (#12) | Phase 8a (delegated) | Dead-man switch reliability |
| Web settings page (#8) | Phase 8b (delegated) | Monetization Support surface |
| Core month helpers (#6) | plan-mobile-nav-and-month-picker.md sub-phase B (delegated) | I2 hoisting pattern |
| Verification debt closure | Phase 9a (delegated) | Release confidence |

## Severity index

| Severity | Items |
| --- | --- |
| High | #1 ai_usage races, #3 SSE no timeout, #12 logActivity swallow, #14 first-load zeros |
| Medium | #2 deleteGoal no catch, #5 savings math in UI libs, #6 month math duplicated, #8 web settings placeholder, #9 saveScenario non-transactional, #10 oversized components |
| Low | #4 Date.now message ids, #7 inline display math, #11 empty catch, #13 dead components (D-042) |
| Process | STATUS.md/HANDOFF.md staleness, interactive verification debt |

## Items delegated to owning plans (cross-referenced, not restated)

- #12 `logActivity` failures silently swallowed (`apps/web/src/components/providers.tsx:89`, `apps/mobile/components/providers.tsx:67`): fixed in Phase 8a because a missed write is a false-alarm risk for the dead-man switch.
- #8 web settings page is still a `ModulePlaceholder` (`apps/web/src/app/settings/page.tsx`) while mobile has a real screen: built in Phase 8b, which needs the page anyway.
- #6 `shiftMonth`/`monthNow` duplicated in `apps/web/src/lib/expenses.ts` and `apps/mobile/lib/expenses.ts`: hoisted to core in the month-picker sub-phase B.
- Interactive verification debt (Phase 5.3 scale/offline/RSU-FX per D-048, Phase 6 checklist, Phase 7 cost-free scenarios per D-047, all Expo Go passes): encoded as scripted E2E with seeded data in Phase 9a; the real-Anthropic-cost scenarios stay owner-gated.

---

## Sub-phase I1: correctness sweep (1 session; recommended before all other planned work)

These are live bugs, small to fix, and #1 is a prerequisite for monetization Path B.

1. (High) `ai_usage` metering races in `supabase/functions/ai-insights/index.ts`.
   `accountUsage` (lines 108-132) does read-maybeSingle-then-upsert, so two concurrent requests in the same month lose updates and under-count tokens.
   The budget gate (lines 220-233) reads usage before the stream and writes after, so concurrent requests can both pass and blow past the ceiling.
   Fix: one Postgres RPC (new migration) doing atomic `INSERT ... ON CONFLICT (user_id, month) DO UPDATE SET input_tokens = ai_usage.input_tokens + $1, ... RETURNING`, and move the budget check into the same statement family so check and increment cannot interleave.
   Concept: check-then-act on shared state is only safe inside one atomic statement or transaction; this is the same class of bug as D-033.
2. (Medium) Web `deleteGoal(...).then(setNotice)` in `apps/web/src/components/goals/goals-workspace.tsx` (around lines 313-318) has no `.catch`; a failed delete is an unhandled rejection with no user feedback.
   Fix on web and check the mobile equivalent.
3. (High) The insights SSE stream has no timeout or abort (`apps/web/src/lib/insights.ts` reader loop, and `apps/mobile/lib/insights.ts`).
   A stalled stream hangs the UI forever.
   Fix: AbortController plumbed into the fetch, an idle timeout of roughly 60s without an SSE event, and a user-visible cancel; both platforms.
4. (Low) Mobile chat message ids use `Date.now()` (`apps/mobile/app/(tabs)/insights.tsx` lines 76-82), which can collide within a tick and break React list keys.
   Fix: `crypto.randomUUID()` (available in Expo SDK 57) or the existing uuid dependency; check web for the same pattern.
9. (Medium) `saveScenario` in `packages/sync/src/scenarios.ts` (lines 160-170) runs UPDATE-then-INSERT without a wrapping transaction, so a concurrent same-id insert can race between the statements.
   Fix: wrap in the PowerSync `writeTransaction` helper; audit the other UPDATE-then-INSERT repositories (`fire_settings`, future `deadman_settings`) for the same gap.
   Respect D-022: PowerSync tables are views, so SQL UPSERT is not available; the transaction wrapper is the correct tool.
11. (Low) `apps/web/src/components/theme-toggle.tsx:99` has the repo's one fully empty catch; make it `console.warn`.
14. (High) The D-038 first-load-zeros pattern is fixed in Goals but latent in the Portfolio and Expenses workspaces: queries mounted before the first PowerSync sync attach to an empty DB and render zeros until remount.
   Fix: apply the Goals gate (outer component reads `useStatus().hasSynced` + auth, inner component owns the `useQuery` hooks) to `apps/web/src/components/portfolio/portfolio-workspace.tsx`, `apps/web/src/components/expenses/expenses-workspace.tsx`, and their mobile screens.
   A money app rendering ₹0 while holding real data is a correctness failure (same judgment as D-049).

Exit criteria: all six fixed; new RPC covered by a test hitting concurrent increments; repo green; no behavior regressions in the E2E-verified flows.

## Sub-phase I2: core hoisting and dedup (1 session; any time after month-picker sub-phase B)

House rule: all domain math lives in `packages/core`; UI only formats.

5. (Medium) `monthlyExpenseTotals` and `averageMonthlySavings` are duplicated near-verbatim in `apps/web/src/lib/goals.ts` (lines 53-79) and `apps/mobile/lib/goals.ts` (lines 51-77).
   This is savings-rate domain math and belongs beside `suggestAnnualExpenses` in `packages/core/src/goals/fire.ts`, with Vitest coverage; both platform libs then import it.
   While there, confirm the web call sites are memoized the way mobile's are (`apps/mobile/lib/goals.ts` lines 155-158).
7. (Low) Inline display math duplicated per platform: the SWR-to-multiplier `1 / (withdrawalRate / 100)` in `apps/web/src/components/goals/goals-workspace.tsx:147` and mobile goals; `(rate * 100).toFixed(2)` percent formatting in portfolio workspace/holding detail; budget ratio-to-width math in `apps/web/src/components/expenses/budget-section.tsx` and mobile expenses; rate/percent conversion in `apps/web/src/components/ui/input.tsx` and `apps/mobile/components/field.tsx`.
   Fix: `formatPercent`/`swrMultiplier`/`budgetRatio` style helpers in core's format/fire modules; sweep call sites.

Exit criteria: no domain math left in `apps/*/lib` or components beyond glue and formatting calls into core; hoisted functions tested; repo green.
Remember to rebuild the packages before app verification (apps import compiled dist).

## Sub-phase I3: component health + docs hygiene (1 session; any time)

10. (Medium) Oversized components mixing state and presentation: `apps/mobile/app/(tabs)/expenses.tsx` (547 lines; the budget-form extraction in the modal-routes sub-phase A already helps), `apps/web/src/components/portfolio/holding-form.tsx` (473), `tax/tax-calculator.tsx` (395), `goals-workspace.tsx` and `expenses-workspace.tsx` (384 each), mobile `tax.tsx` (330) and `goals.tsx` (324).
   Fix mechanically: extract list/summary/chart/form sections into sibling components with typed props; no behavior change; target roughly 300 lines per file for the touched set.
13. (Low) D-042 dead component code: the portfolio hubs no longer render the global event form, valuation form, ledger history card, or valuation history card, but the files were deliberately retained.
   The contextual reuse D-042 anticipated has happened (holding detail owns its forms), so delete the truly unreferenced components and append a DECISIONS.md entry superseding D-042.
- Process: refresh STATUS.md and HANDOFF.md to reality (phases 0-7 done per owner confirmation of 2026-07-19; current work is the phases/plans/ track), and index the five plan docs from STATUS.md so future sessions find them.

Exit criteria: touched components at or under target size with zero behavior change (E2E suite as the guard once 9a exists, manual smoke before); dead code removed with the decision recorded; STATUS/HANDOFF current.

---

## Recommended overall execution order

I1 first (live bugs, one session), then plan-mobile-nav-and-month-picker.md sub-phases A and B, then Phase 8a/8b, then Phase 9a-9d, then monetization Path A.
I2 and I3 interleave anywhere after month-picker sub-phase B.
This ordering front-loads correctness, keeps each session independently green and committable, and ensures shared infrastructure (Resend, seeded E2E data, core helpers) exists before its consumers.
