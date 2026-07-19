# Plan: Mobile Modal Routes + Expenses Month/Year Navigation

Status: planned, not started.
Priority: first of the re-prioritized work (ahead of Phase 8, per owner decision 2026-07-19).
Two independently shippable sub-phases, each sized to one agent session.
Sub-phase A resolves the PRODUCTION_PLAN.md Phase 9 carried-over item "Mobile add/edit views as modal routes for edge-swipe back".
Sub-phase B resolves the carried-over item "Expenses arbitrary month/year navigation".

## Cross-doc dependencies

| Dependency                                                 | Produced by            | Consumed by                                                 |
| ---------------------------------------------------------- | ---------------------- | ----------------------------------------------------------- |
| Core month helpers (`packages/core/src/expenses/month.ts`) | Sub-phase B            | Improvements I2 (dedup pattern), both platform expense libs |
| Mobile notice store (`apps/mobile/lib/notice.ts`)          | Sub-phase A            | Any future toast usage                                      |
| Improvements item #6 (duplicated `shiftMonth`/`monthNow`)  | Retired by sub-phase B | plan-improvements.md                                        |

The improvements plan (plan-improvements.md) recommends running its I1 correctness sweep before this work because I1 fixes live bugs.
That ordering is a recommendation; this plan has no hard dependency on I1.

---

## Sub-phase A: add/edit forms as stack routes (1 session)

### Problem

The mobile add/edit forms are conditional full-screen swaps (`if (showForm) return <Form/>`) inside tab screens, not navigation routes.
Because they are not on the navigation stack, the iOS edge-swipe-back and Android hardware-back gestures have nothing to dismiss, so Cancel is the only way out.
`app/holding/[id].tsx` is already a proper stack route and gets native swipe-back for free; it is the pattern to mirror.

### Concept: card vs modal presentation

expo-router stack screens support `presentation: 'card'` (default push, dismissed by edge-swipe from the left on iOS) and `presentation: 'modal'` (sheet sliding up, dismissed by swipe-down on iOS).
The requirement is literally "edge-swipe back", which only the card presentation provides.
Card also matches the existing `holding/[id]` behavior, so every pushed screen in the app dismisses with the same gesture.
The tradeoff: iOS design language treats modal as "a task you complete or cancel" and card as "drilling into content".
We choose gesture consistency over that convention; if a sheet feel is ever wanted, changing `presentation` per screen is a one-line option.

### Design decisions

1. Dedicated file routes, not a generic modal host.
   Six small route files mirror the proven 8-line `app/holding/[id].tsx` wrapper.
   A generic `app/edit/[entity].tsx` host was rejected: it makes params stringly-typed and adds indirection for zero benefit at this scale.
2. `presentation: 'card'` for all form routes (see concept above).
   No options are needed at all if the default is card; state the intent with an explicit `Stack.Screen` entry only if expo-router's defaults change behavior.
3. Headers stay app-drawn.
   The root Stack in `apps/mobile/app/_layout.tsx` has `headerShown: false`, and every form already renders its own title and Cancel button.
   Cancel becomes `router.back()`.
4. Success notices move to a tiny shared store.
   Today each tab screen holds `notice` state and the form sets it via callback before unmounting.
   After conversion the form route unmounts on `router.back()`, so the notice must outlive it.
   Add `apps/mobile/lib/notice.ts`: a module-level value with subscribe/emit and a `useNotice()` hook built on `useSyncExternalStore`, roughly 30 lines, no new dependency.
   Form routes call `setNotice(...)` then `router.back()`; the tab screens render from `useNotice()` and drop their local notice state.
5. Android hardware back needs no work.
   Stack routes get hardware-back dismissal automatically.
   Discard-on-back without a confirm dialog is accepted; it matches the current Cancel behavior.
6. The `holding-detail` inline panels (event/valuation/edit, `apps/mobile/components/portfolio/holding-detail.tsx` `panel` state) stay inline.
   They already live on a routed screen with working edge-swipe, and no UX complaint exists against them.
   This is a conscious deferral, recorded here.
7. `MobileBudgetForm` is currently defined inline in `apps/mobile/app/(tabs)/expenses.tsx` (lines 92-167).
   Extract it to `apps/mobile/components/expenses/budget-form.tsx` so the budget route can import it.
   This also chips at improvements item #10 (the 547-line expenses screen).

### Route map

| New route                  | Renders                        | Params                      | Replaces                                |
| -------------------------- | ------------------------------ | --------------------------- | --------------------------------------- |
| `app/transaction/new.tsx`  | `MobileTransactionForm`        | none                        | `expenses.tsx` `formOpen` (add)         |
| `app/transaction/[id].tsx` | `MobileTransactionForm`        | `id` of transaction to edit | `expenses.tsx` `editingId` + `formOpen` |
| `app/goal/new.tsx`         | `MobileGoalForm`               | none                        | `goals.tsx` `showForm` (add)            |
| `app/goal/[id].tsx`        | `MobileGoalForm`               | `id` of goal to edit        | `goals.tsx` `editingId` + `showForm`    |
| `app/holding/new.tsx`      | `MobileHoldingForm`            | none                        | `portfolio.tsx` `showForm`              |
| `app/budget/index.tsx`     | `MobileBudgetForm` (extracted) | none                        | `expenses.tsx` `budgetOpen`             |

Each route file follows the `app/holding/[id].tsx` pattern: read `useLocalSearchParams`, call the shared hook (`useExpenses` / `useGoals` / `usePortfolio`), resolve `initial` from the hook's live arrays, and pass `onSave` that awaits the repo save, sets the notice, and calls `router.back()`.
Edit routes where the id is not yet found (sync race on a cold start) render a brief loading state and fall back to `router.back()` if it never resolves.
The `key={editing?.id ?? 'new'}` remount trick in `expenses.tsx` becomes unnecessary: route identity provides the remount.

### Concept: forms that own no navigation

All four form components already take `initial` (or `initialTransaction`) plus `onSave`/`onCancel` callbacks and never touch the router.
That separation is exactly what makes this conversion cheap: the components are reused unchanged, and only the thin wiring around them moves.
This is the general lesson: keep navigation at the route layer and keep components callback-driven, and screens stay portable.

### Files to touch

- New: `app/transaction/new.tsx`, `app/transaction/[id].tsx`, `app/goal/new.tsx`, `app/goal/[id].tsx`, `app/holding/new.tsx`, `app/budget/index.tsx` (all under `apps/mobile/`).
- New: `apps/mobile/lib/notice.ts`, `apps/mobile/components/expenses/budget-form.tsx` (extracted).
- Edit: `apps/mobile/app/(tabs)/expenses.tsx` (remove `formOpen`/`editingId`/`budgetOpen` swaps and the inline budget form; FAB and row edit call `router.push`).
- Edit: `apps/mobile/app/(tabs)/goals.tsx` (remove `showForm`/`editingId` swap; edit button and FAB push routes).
- Edit: `apps/mobile/app/(tabs)/portfolio.tsx` (remove `showForm` swap; FAB pushes `/holding/new`).
- Possibly `apps/mobile/app/_layout.tsx` if explicit `Stack.Screen` registration is needed.

### Session ordering if the window runs short

Transaction routes first (hardest: needs accounts + categories and both add/edit), then goals, then holding/new, then budget.
Each converted form is independently committable because the old swap pattern can coexist per screen.

### Exit criteria

- All four entry points navigate via `router.push`; no `if (showForm)` swaps remain in the three tab screens.
- iOS edge-swipe and Android hardware back dismiss every form.
- Saving shows the success notice on the originating tab screen after the route pops.
- Edit routes prefill correctly; add routes start blank.
- `CI=true pnpm turbo run build test lint typecheck` green; simulator verification of every route recorded in the briefing.

---

## Sub-phase B: month/year picker for expenses (1 session)

### Problem

The expenses month selector on both platforms steps one month at a time via arrows (`api.previousMonth` / `api.nextMonth`).
Reaching May last year takes many taps.
The `useExpenses` hook already exposes `setMonth(month: 'YYYY-MM')` publicly on both platforms, pagination auto-resets when `month` changes, and the 6-month trend window (`trendWindowStart(month, 6)` in `packages/core/src/expenses/recurrence.ts`) is already relative to the selected month.
Only the UI control is missing.

### Concept: derived state follows one source of truth

Everything on the expenses screen (list query, count query, trend window, budget month) derives from the single `month` string.
The picker therefore only needs to call `setMonth`; charts, pagination, and budgets re-anchor automatically.
No trend-window work is required, which is worth verifying visually rather than assuming.

### Design decisions

1. Hoist the duplicated month math into core.
   `shiftMonth` and `monthNow` are duplicated privately in `apps/web/src/lib/expenses.ts` (lines 62-69) and `apps/mobile/lib/expenses.ts` (lines 60-69).
   Create `packages/core/src/expenses/month.ts` with `shiftMonth`, `monthNow`, `monthLabel` (locale-formatted label, currently inlined in both UIs), and `clampMonth(month, min, max)`, exported through `packages/core/src/expenses/index.ts`, with a Vitest suite.
   Both platform libs import from core and delete their copies.
   This retires improvements item #6.
2. Interaction: tap the month label.
   The label is already the visual center of the selector row; making it the trigger costs no layout.
   Arrows stay for the one-step habit.
3. Mobile: bottom sheet with the bare RN `Modal` idiom already used by the More sheet in `apps/mobile/app/(tabs)/_layout.tsx` (transparent, `animationType="slide"`, bottom-anchored card).
   Contents: a year stepper row (`‹ 2026 ›`), a 3x4 grid of month chips styled like the existing `Choice` component (`apps/mobile/components/choice.tsx`), and a "This month" button.
   Disabled months render dimmed and non-pressable.
   No picker library is added; the app must stay Expo Go compatible (D-021).
4. Web: the label becomes a button opening an absolutely-positioned popover card below it, using the same visual grammar (border, shadow, tokens) as the custom `Select` in `apps/web/src/components/ui/select.tsx`, with the identical year stepper + month grid + "This month".
   Close on outside click and Escape, matching `Select` behavior; grid cells are real buttons for keyboard access.
5. Bounds: years 2015 through currentYear + 1, and at most 12 months into the future from the current month.
   Future months are legitimate (budgets and recurring planning), and the arrows already permit them.
   A data-derived lower bound (earliest transaction month) is noted as later polish; it adds a query for marginal value.
6. "Jump to current" lives only inside the picker as the "This month" button.

### Files to touch

- New: `packages/core/src/expenses/month.ts` + `month.test.ts`; export from `packages/core/src/expenses/index.ts`.
- Edit: `apps/web/src/lib/expenses.ts`, `apps/mobile/lib/expenses.ts` (delete private duplicates, import from core).
- New: `apps/web/src/components/expenses/month-picker.tsx`; wire into `apps/web/src/components/expenses/expenses-workspace.tsx` (selector row, lines 92-124).
- New: `apps/mobile/components/expenses/month-picker-sheet.tsx`; wire into `apps/mobile/app/(tabs)/expenses.tsx` (selector row, lines 273-291).

Reminder from the memory file: apps import the compiled dist of `@finmanager/*` packages, so rebuild `packages/core` after adding `month.ts` before testing the apps.

### Exit criteria

- Core month helper tests green; no `shiftMonth`/`monthNow` definitions remain in either platform lib.
- On both platforms, January 2024 is reachable in at most 4 taps from the current month.
- Month change still resets pagination and re-anchors the 6-month trend chart and budget section.
- Bounds enforced: months beyond currentMonth + 12 are not selectable.
- `CI=true pnpm turbo run build test lint typecheck` green; Chrome + simulator verification recorded in the briefing.

---

## Verification (whole plan)

- Run the full gate: `CI=true pnpm turbo run build test lint typecheck` and `pnpm format:check`.
- Sub-phase A: on the iOS simulator, open each of the six routes, dismiss each via edge-swipe, and confirm the save path shows the notice on the originating tab.
- Sub-phase A: on Android (emulator or device), confirm hardware back dismisses each form.
- Sub-phase B: on Chrome and the simulator, jump to a month more than a year back, confirm list/count/trend/budget all follow, then "This month" returns.
- Offline check: add a transaction through the new route while offline and confirm it appears immediately and syncs on reconnect (house offline-first rule).
- At phase end write `phases/briefing/` entries per the session protocol.
