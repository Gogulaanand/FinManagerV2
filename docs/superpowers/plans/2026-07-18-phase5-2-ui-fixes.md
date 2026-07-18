# Phase 5.2 UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the reported web and mobile controls, charts, uploads, layouts, and portfolio FX behavior consistent, accessible, and legible in both color modes without committing the implementation changes.

**Architecture:** Keep the existing token-driven design system. Add a local accessible web select primitive and reuse it through `SelectField` plus all direct portfolio selects; add only small mobile primitives where free-form text currently represents a finite choice. Centralize the INR/non-INR FX normalization in `@finmanager/core`, then use that rule in all affected forms.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Recharts, React Native/NativeWind, Vitest, TypeScript, pnpm/Turbo.

## Global Constraints

- Preserve the existing token package and semantic color roles; do not introduce isolated color literals for web charts.
- Avoid adding a UI dependency unless the existing project-local primitive proves insufficient.
- Keep the current import and persistence behavior unchanged.
- Apply equivalent fixes to mobile where the same issue exists.
- Stop after verification with implementation changes unstaged/uncommitted; only the already committed design spec remains committed.

---

### Task 1: Centralize portfolio FX normalization with tests

**Files:**

- Create: `packages/core/src/portfolio/fx.ts`
- Modify: `packages/core/src/portfolio/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/portfolio/fx.test.ts`

**Interfaces:**

- Produces `fxRateToInrForCurrency(currency: string, rawRate: string | number | null | undefined): number | null`.
- Returns `null` for `INR`; for non-INR returns a positive finite number or `null` when input is invalid.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';

import { fxRateToInrForCurrency } from './fx';

describe('fxRateToInrForCurrency', () => {
  it('does not retain an FX rate for INR', () => {
    expect(fxRateToInrForCurrency('INR', '83')).toBeNull();
  });

  it('normalizes a positive non-INR rate', () => {
    expect(fxRateToInrForCurrency('USD', '83.25')).toBe(83.25);
  });

  it('rejects empty, zero, negative, and non-finite rates', () => {
    expect(fxRateToInrForCurrency('USD', '')).toBeNull();
    expect(fxRateToInrForCurrency('USD', 0)).toBeNull();
    expect(fxRateToInrForCurrency('USD', -1)).toBeNull();
    expect(fxRateToInrForCurrency('USD', Number.NaN)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm --filter @finmanager/core test -- fx.test.ts`

Expected: FAIL because `./fx` and `fxRateToInrForCurrency` do not exist.

- [ ] **Step 3: Implement the minimal helper and exports**

Implement the exact signature above with `currency === 'INR'` returning `null`, `Number(rawRate)` conversion, and a finite-positive guard. Export it from `packages/core/src/portfolio/index.ts` and `packages/core/src/index.ts`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm --filter @finmanager/core test -- fx.test.ts`

Expected: PASS with all three test cases green.

### Task 2: Add shared web number, select, and upload primitives

**Files:**

- Create: `apps/web/src/components/ui/select.tsx`
- Modify: `apps/web/src/components/ui/input.tsx`
- Modify: `apps/web/src/components/expenses/csv-import.tsx`

**Interfaces:**

- `Select<T extends string>` accepts `id`, `value`, `options`, `onChange`, and optional `aria-label`; it renders a button/listbox interaction with roving active option and selected checkmark.
- `UploadButton` accepts `id`, `accept`, `filename`, and `onFile`; it owns the visually hidden native file input and styled trigger.

- [ ] **Step 1: Add a failing primitive contract test or focused DOM test if the app test harness supports it**

If no DOM test harness exists, add unit coverage for the option-selection helper and rely on the later browser smoke check for focus, keyboard, and outside-click behavior. The required contract is: selected value is visible in the trigger, opening exposes a `role="listbox"`, options use `role="option"`, and selecting an option invokes `onChange` once.

- [ ] **Step 2: Run the focused check and verify the contract is not yet present**

Run the chosen focused test command, or record the absence of a web DOM harness and continue to implementation while keeping the browser smoke check mandatory.

- [ ] **Step 3: Suppress web number spinners and implement the primitives**

Add `appearance:textfield` plus WebKit spinner suppression to the shared `Input` class list. Build `Select` with `useId`, `useRef`, `useState`, `useEffect`, `ChevronDown`, and `Check` from `lucide-react`; close on outside pointer down and Escape; support ArrowUp/ArrowDown/Home/End/Enter/Space; keep focus on the trigger after selection. Use `bg-surface`, `border-border`, `text-foreground`, `text-foreground-muted`, and `focus` utilities.

Update `SelectField` to render this primitive. Replace the CSV `Input type="file"` with `UploadButton`, retaining `readFile(event.target.files?.[0])` and CSV acceptance.

- [ ] **Step 4: Run web typecheck and lint for the primitive changes**

Run: `pnpm --filter @finmanager/web typecheck && pnpm --filter @finmanager/web lint`

Expected: both commands pass.

### Task 3: Route all web selects, align expense forms, and theme charts

**Files:**

- Modify: `apps/web/src/components/portfolio/valuation-form.tsx`
- Modify: `apps/web/src/components/portfolio/holding-form.tsx`
- Modify: `apps/web/src/components/portfolio/holding-event-form.tsx`
- Modify: `apps/web/src/components/portfolio/portfolio-import.tsx`
- Modify: `apps/web/src/components/expenses/expenses-workspace.tsx`
- Modify: `apps/web/src/components/expenses/expense-charts.tsx`

**Interfaces:**

- All web finite-choice controls use `SelectField` or the shared `Select`; no direct `<select>` remains in affected web components.
- Accounts and Categories inputs are wrapped in `Field` with matching label/control heights and grid alignment.

- [ ] **Step 1: Write a failing static/regression check**

Add or run a repository search that demonstrates direct selects remain in the affected files and chart components lack explicit tooltip/legend styling. The intended post-change checks are:

```bash
! rg -n '<select' apps/web/src/components/portfolio apps/web/src/components/expenses
rg -n 'contentStyle|labelStyle|itemStyle|wrapperStyle' apps/web/src/components/expenses/expense-charts.tsx
```

- [ ] **Step 2: Replace direct selects and fix alignment**

Use `SelectField` in valuation, holding, holding-event, and portfolio-import. In Accounts/Categories, wrap account name and balance and category name in `Field` with labels matching the existing `Type`/`Kind` fields; use `grid` children with consistent `sm:grid-cols-*` sizing.

- [ ] **Step 3: Apply semantic chart styling**

Set Recharts `CartesianGrid`, axis ticks, tooltip `contentStyle`, `labelStyle`, `itemStyle`, cursor, legend wrapper/text, and data marks to semantic token CSS variables. Use readable foreground colors for text and `primary`/`gain`/`loss` roles for marks. Do not rely on Recharts’ default black tooltip or legend swatches.

- [ ] **Step 4: Verify the web components**

Run: `pnpm --filter @finmanager/web typecheck && pnpm --filter @finmanager/web lint`

Expected: both commands pass and the direct-select search returns no affected web selects.

### Task 4: Implement mobile finite-choice controls, charts, and portfolio FX behavior

**Files:**

- Create: `apps/mobile/components/choice.tsx`
- Modify: `apps/mobile/components/field.tsx`
- Modify: `apps/mobile/components/expenses/expense-charts.tsx`
- Modify: `apps/mobile/components/portfolio/valuation-form.tsx`
- Modify: `apps/mobile/components/portfolio/holding-form.tsx`
- Modify: `apps/mobile/components/portfolio/holding-event-form.tsx`

**Interfaces:**

- `Choice<T extends string>` accepts `label`, `value`, `options`, `onChange`, and optional `hint`; it uses a native-accessible mobile press interaction and displays the selected option.
- Portfolio forms call `fxRateToInrForCurrency` for all submitted FX rates.

- [ ] **Step 1: Add failing tests for mobile-facing FX behavior through the shared core helper**

Use the failing `packages/core/src/portfolio/fx.test.ts` cases from Task 1 as the platform-independent regression proof. Add a case proving non-INR values survive normalization.

- [ ] **Step 2: Replace free-form finite-choice inputs**

Use `Choice` for mobile asset type, holding currency, valuation currency, and holding-event currency. Retain text inputs only for genuinely free-form values such as identifiers and account IDs. Keep segmented controls for the existing two-option category kind and other already-visible short choices.

- [ ] **Step 3: Hide INR FX controls and normalize submissions**

Render FX fields only when `currency !== 'INR'`; keep existing entered foreign rate in state when switching away and back. Pass `fxRateToInrForCurrency(currency, fxRate)` or its manual-rate equivalent to `onSave`, yielding `null` for INR.

- [ ] **Step 4: Fix mobile chart contrast**

Replace hard-coded chart colors with the token-derived values available to React Native/NativeWind, and set chart container/background and any axis/legend text to foreground semantic classes/colors. Verify both light and dark token modes.

- [ ] **Step 5: Run mobile typecheck and lint**

Run: `pnpm --filter @finmanager/mobile typecheck && pnpm --filter @finmanager/mobile lint`

Expected: both commands pass.

### Task 5: End-to-end verification without committing implementation changes

**Files:**

- Modify: none unless verification exposes a defect.

- [ ] **Step 1: Run focused core tests**

Run: `pnpm --filter @finmanager/core test -- fx.test.ts`

Expected: all FX tests pass.

- [ ] **Step 2: Run repository test, lint, typecheck, and build suites**

Run: `pnpm test && pnpm lint && pnpm typecheck && pnpm build`

Expected: all commands pass without new errors.

- [ ] **Step 3: Run browser smoke verification**

Start the web app with `pnpm web`, then verify in the browser: number fields have no spinner buttons; all dropdown triggers have inset arrows and styled menus; Accounts/Categories fields align; CSV upload opens a file chooser and displays the filename; expenses charts have readable tooltip/legend/axis content in dark mode; INR hides FX and USD restores it.

- [ ] **Step 4: Inspect final worktree state**

Run: `git status --short --branch && git diff --check`

Expected: implementation files are modified but not committed; only the pre-existing `.mcp.json` and `.pnpm-store/` remain unrelated untracked files.
