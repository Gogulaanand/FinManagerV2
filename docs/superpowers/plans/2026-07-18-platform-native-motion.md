# Platform-Native Motion and Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add restrained, accessible platform-native motion to web and mobile, capitalize event labels, and keep desktop navigation accessible during long-page scrolling without committing the implementation.

**Architecture:** Use GSAP and `@gsap/react` only in the web app for scoped client-side entrance and count-up animations. Use the already-installed React Native Reanimated package for mobile. Keep motion finite, token-aligned, reduced-motion aware, and separate from persistence/data semantics.

**Tech Stack:** Next.js 16, React 19, GSAP, `@gsap/react`, React Native 0.86, `react-native-reanimated`, NativeWind, Vitest, TypeScript, pnpm/Turbo.

## Global Constraints

- Motion is purposeful and finite; no perpetual decorative animation.
- Respect `prefers-reduced-motion` on web and the platform reduced-motion setting on mobile.
- Prefer transform and opacity for animation; do not animate layout properties for movement.
- Empty data states remain distinct from loading states.
- Capitalize event labels only at the presentation boundary; stored enum values remain unchanged.
- Stop before commit for user manual QA and motion judgment.

---

### Task 1: Add the web motion dependencies and shared motion wrapper

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/src/components/motion/animated-page.tsx`
- Modify: `apps/web/src/components/ui/card.tsx`

- [ ] **Step 1: Add GSAP dependencies**

Run: `pnpm --filter @finmanager/web add gsap @gsap/react`

Expected: both dependencies are added to `apps/web/package.json` and the lockfile updates.

- [ ] **Step 2: Implement scoped page/card entrance motion**

Create a client component that uses `useGSAP()` with a ref scope and a `gsap.matchMedia()` condition for `prefers-reduced-motion`. Animate `[data-motion-card]` with `autoAlpha`, `y`, and a small stagger; animate the page wrapper once. Set reduced-motion elements immediately visible without tweening. Add `data-motion-card="true"` to `Card` so existing cards participate without duplicating animation code.

- [ ] **Step 3: Mount the wrapper around web main content**

In `apps/web/src/app/layout.tsx`, wrap the existing `main` content with `AnimatedPage`, leaving the sidebar/header outside the entrance timeline.

- [ ] **Step 4: Run web lint and typecheck**

Run: `pnpm --filter @finmanager/web lint && pnpm --filter @finmanager/web typecheck`

Expected: both pass.

### Task 2: Fix labels and sticky desktop navigation

**Files:**
- Modify: `apps/web/src/components/portfolio/holding-event-form.tsx`
- Modify: `apps/mobile/components/portfolio/holding-event-form.tsx`
- Modify: `apps/web/src/components/sidebar.tsx`

- [ ] **Step 1: Add presentation labels for event kinds**

Map each enum to title case at render time: `buy → Buy`, `sell → Sell`, `vest → Vest`, `exercise → Exercise`, `dividend → Dividend`, `interest → Interest`, `contribution → Contribution`, `withdrawal → Withdrawal`. Keep submitted `kind` values unchanged.

- [ ] **Step 2: Make the desktop sidebar sticky**

Add `sticky top-0 h-screen self-start overflow-y-auto` to the desktop `<aside>`. Preserve the mobile tab bar behavior.

- [ ] **Step 3: Run affected checks**

Run: `pnpm --filter @finmanager/web lint && pnpm --filter @finmanager/mobile lint && pnpm --filter @finmanager/web typecheck && pnpm --filter @finmanager/mobile typecheck`

Expected: all pass.

### Task 3: Add web loading skeletons and number/progress transitions

**Files:**
- Create: `apps/web/src/components/motion/skeleton.tsx`
- Modify: `apps/web/src/components/amount.tsx`
- Modify: `apps/web/src/components/providers.tsx`
- Modify: `apps/web/src/lib/expenses.ts`
- Modify: `apps/web/src/lib/portfolio.ts`
- Modify: `apps/web/src/components/expenses/expenses-workspace.tsx`
- Modify: `apps/web/src/components/portfolio/portfolio-workspace.tsx`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Expose initial query loading state**

Add `loading: boolean` to Expenses and Portfolio API objects, computed as the relevant initial query data being `undefined`. Do not treat an empty resolved array as loading.

- [ ] **Step 2: Add skeleton primitives and actual loading boundaries**

Create `Skeleton` and page-level skeleton layouts using `animate-pulse` only while the APIs report `loading`. Render the existing empty states once loading becomes false. Use accessible `aria-busy` and `aria-label` on loading regions.

- [ ] **Step 3: Add web amount count-up and progress animation**

Use `useGSAP()` in `Amount` to animate a numeric object from the previous value to the current value over a short duration, formatting each update with the existing `formatInr`. Use `gsap.matchMedia()` to disable the count-up under reduced motion. Animate dashboard FIRE progress with a transform-based scale reveal rather than changing layout width over time.

- [ ] **Step 4: Verify web motion behavior statically and by build**

Run: `pnpm --filter @finmanager/web lint && pnpm --filter @finmanager/web typecheck && pnpm --filter @finmanager/web build`

Expected: no lint/type/build errors.

### Task 4: Add mobile-native entrance, progress, and amount motion

**Files:**
- Create: `apps/mobile/components/motion.tsx`
- Modify: `apps/mobile/components/amount.tsx`
- Modify: `apps/mobile/components/card.tsx`
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/app/(tabs)/expenses.tsx`
- Modify: `apps/mobile/app/(tabs)/portfolio.tsx`
- Modify: `apps/mobile/app/(tabs)/tax.tsx`

- [ ] **Step 1: Implement reduced-motion-aware Reanimated wrappers**

Create a reusable animated card/page wrapper using `useSharedValue`, `withTiming`, and `useAnimatedStyle`. Read the platform reduced-motion setting through Reanimated’s supported accessibility API or React Native accessibility hook; use zero-duration transitions when motion is reduced. Animate only opacity and translateY.

- [ ] **Step 2: Animate mobile amounts and progress fills**

Use a shared numeric value with `withTiming` and `runOnJS` display updates for `Amount`, and animate progress fill scale/opacity without changing layout measurement. Keep number formatting and accessibility values unchanged.

- [ ] **Step 3: Apply wrappers to major mobile sections**

Wrap dashboard cards, expenses sections, portfolio sections, and tax result sections with small staggered entrance timing. Do not animate the tab navigator itself or introduce looping effects.

- [ ] **Step 4: Run mobile checks**

Run: `pnpm --filter @finmanager/mobile lint && pnpm --filter @finmanager/mobile typecheck`

Expected: both pass.

### Task 5: Full automated verification and manual-QA handoff

**Files:**
- Modify: none unless verification reveals a defect.

- [ ] **Step 1: Run focused and repository tests**

Run: `pnpm test && pnpm lint && pnpm typecheck && pnpm build`

Expected: all commands pass.

- [ ] **Step 2: Run formatting and diff checks**

Run: `pnpm exec prettier --check <all changed files> && git diff --check`

Expected: changed files are formatted and the diff has no whitespace errors.

- [ ] **Step 3: Inspect worktree without staging or committing**

Run: `git status --short --branch && git diff --stat`

Expected: implementation changes remain unstaged/uncommitted on `phase5.2-fixes`.

- [ ] **Step 4: Stop for user manual QA**

Hand off the web and mobile flows for manual motion, reduced-motion, sticky-nav, and event-label verification. Do not commit.
