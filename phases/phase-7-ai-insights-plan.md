# Phase 7 Plan: AI Insights

This document is the authoritative spec for Phase 7 (AI Insights).
It expands the Phase 7 section of PRODUCTION_PLAN.md into an executable plan and encodes decisions already made with the owner.
Read STATUS.md, HANDOFF.md, and phases/briefing/phase-6.md first, per the session protocol, then implement this plan.

## Implementation status (2026-07-19)

Phase 7 implementation is **code-complete and merged with the latest Phase 5.3 work from `main`**, but the phase remains **in progress** until deployment and interactive verification are complete.

Implemented:

- Migration `20260719000004_phase7_ai_insights.sql` adds private, metered `ai_usage` plus synced, offline-readable `ai_summaries` with constraints, indexes, grants, and RLS.
- The authenticated `ai-insights` Edge Function validates requests, enforces the monthly token allowance, calls `claude-sonnet-5` without sampling parameters, proxies Anthropic SSE, and records usage after streaming.
- Shared schemas cover scopes, digests, ephemeral messages, requests, errors, and persisted summaries. Shared core builds compact deterministic digests from existing expense, budget, portfolio, goal/FIRE, retirement, and tax analytics and parses split SSE frames.
- PowerSync includes `ai_summaries`, a newest-first query, validated row mapping, and UPDATE-then-INSERT persistence keyed by user/month/scope.
- Web and mobile ship the Insights workspace, scope picker, suggested prompts, streaming chat, offline/budget/error states, and an offline monthly-summary card. Only the dashboard AI card reads live local data; existing dashboard sample data is unchanged.
- Mobile exposes Dashboard, Expenses, Portfolio, Insights, and More as the five visible slots. More opens a token-styled sheet containing the still-deep-linkable Tax, Goals, and Settings routes.

Automated verification completed before the integration commit:

- `CI=true pnpm turbo run build test lint typecheck`: 21/21 tasks passed after rebasing onto current `main`.
- `CI=true pnpm format:check`: clean.
- Package tests: schema 31, core 156, sync 36.
- Web production build generated `/insights`; Expo iOS export bundled successfully.

### Pending deployment

1. Link the intended Supabase project in this worktree if needed, apply `20260719000004_phase7_ai_insights.sql`, and inspect both tables, unique constraints, indexes, grants, and RLS policies.
2. Set `ANTHROPIC_API_KEY` as a Supabase secret; never expose it through a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` variable.
3. Deploy `ai-insights`, then deploy the updated PowerSync sync rules and confirm `ai_summaries` downloads while `ai_usage` does not.
4. Keep `INSIGHTS_MONTHLY_TOKEN_BUDGET` at its default 1,000,000 for normal use; temporarily set a tiny value only for the budget-exceeded scenario, then restore it.

### Pending Chrome verification scenarios

Use the existing signed-in test account without printing credentials. Record the commit SHA, browser, migration/function/sync-rule deployment state, timestamps, screenshots, console errors, and relevant row IDs.

1. **Grounded budget answer:** ensure the selected month has at least one named expense category and monthly budget with known amounts. Open `/insights`, select Budget, ask exactly “how am I doing on my budget this month?”, and confirm text streams incrementally and cites the real category, spend, budget, and over/under state. It must identify missing data instead of inventing figures.
2. **Scope isolation:** ask a budget question under Budget, then switch to Portfolio and ask for portfolio health. Confirm the second answer uses portfolio/net-worth/allocation values and does not leak unrelated transaction or goal details. Capture the outgoing digest sizes and verify they remain a few KB.
3. **Ephemeral thread:** exchange at least two turns and confirm the recent assistant/user context is coherent. Reload `/insights`; the chat must clear and no chat-history row may exist in Supabase or PowerSync.
4. **Monthly summary persistence:** generate the monthly health summary from the Insights screen or dashboard. Confirm exactly one `ai_summaries` row exists for the user/month/`everything`, Refresh updates that row rather than inserting a duplicate, and the dashboard shows content plus generated-at time.
5. **Offline behavior:** after the summary has synced locally, disconnect PowerSync and block network access. Reload/navigate while remaining signed in: chat controls must be disabled with the friendly offline explanation, while the cached monthly summary still renders on both Insights and Dashboard. Reconnect and confirm no duplicate summary is created.
6. **Budget exhausted:** temporarily configure a tiny monthly allowance or seed usage above the limit. Ask a question and confirm the function returns 429, the UI shows “Monthly allowance used” with friendly copy, no raw error leaks, and the cached summary remains visible. Restore the normal allowance afterward.
7. **Authentication and validation:** call the function without a bearer token and with an invalid scope/body. Confirm 401 and 400 responses respectively, with no Anthropic request and no usage row increment.
8. **Usage accounting:** complete one successful streamed request and confirm `ai_usage` increments request count plus non-negative input/output tokens for the current `YYYY-MM`; confirm the table is absent from the PowerSync client schema and download stream.
9. **Visual/accessibility pass:** inspect light and dark themes, keyboard-only scope/composer operation, focus visibility, streaming without layout jump, the standard card/spacing rhythm, and the unchanged non-AI dashboard sections.

### Pending Expo Go verification scenarios

1. Confirm the visible tab order is Dashboard, Expenses, Portfolio, Insights, More with readable token-sized labels; Insights must never collapse into More.
2. Open More and verify its sheet lists Tax, Goals, and Settings, closes by backdrop/close action, and each item reaches its existing real route.
3. Ask the grounded Budget question and confirm `expo/fetch` streams text in place. If Expo Go streaming is unreliable, capture the failure before adopting the documented mobile-only non-streaming fallback and record that decision.
4. Generate/refresh the monthly summary and confirm it appears on the mobile dashboard. Test live-screen offline read plus reconnect only; do not claim persistence across app relaunch because Expo Go uses the SQL.js in-memory adapter (D-021).

## Goal and exit criteria

Deliver the AI Insights module: an `ai-insights` Supabase Edge Function that receives a compact financial digest, calls Anthropic, and streams the answer back, plus a chat UI on web and mobile with a scope picker and suggested prompts, and a proactive monthly "financial health" card on the dashboard.
Exit criteria: ask "how am I doing on my budget this month?" and get a grounded, data-specific answer that cites the user's real numbers; briefing written.

## Locked decisions (do not relitigate)

- Chat history is ephemeral (in-memory per session).
  Only the monthly health summary persists, in a new synced `ai_summaries` table, so the dashboard card works offline.
- Insights becomes the 7th module on both platforms, but the mobile tab bar is redesigned to stay compact: 5 visible slots (Dashboard, Expenses, Portfolio, Insights, More).
  Tax, Goals, and Settings collapse under a "More" sheet/menu.
  Insights is always visible, never collapsed.
- Dashboard: only the new AI health card uses live local data; the rest of the dashboard stays on sample-data.ts for now.
- Model: `claude-sonnet-5` (locked in PRODUCTION_PLAN.md).
  API facts to respect: adaptive thinking is on by default, `temperature`/`top_p`/`top_k` are rejected with a 400, assistant prefill returns a 400, responses stream as SSE, pricing is $3/$15 per MTok.

## Architecture decision (record in DECISIONS.md)

Client assembles the digest; the Edge Function is a thin authenticated LLM proxy.
The app's data lives in on-device PowerSync SQLite; the Edge Function cannot read it, and querying Postgres server-side would create a second read path that can drift from what the user sees.
So the client builds a compact JSON digest from local data using existing `@finmanager/core` analytics, POSTs it with the question and scope, and the function adds the system prompt, enforces the token budget, calls Anthropic with the server-side key, and streams SSE back.
This is the one sanctioned direct-network feature besides auth (explicitly allowed by CLAUDE.md).

## Work breakdown

### 1. Migration + backend plumbing

- New migration `supabase/migrations/2026MMDD000004_phase7_ai_insights.sql`:
  - `ai_usage`: id, user_id, month (`text`, `YYYY-MM`), input_tokens, output_tokens, request_count, updated_at; unique (user_id, month).
    RLS `auth.uid() = user_id` for select; writes happen via service role from the Edge Function.
    Not synced via PowerSync.
  - `ai_summaries`: id, user_id, month, scope (`text`, default `'everything'`), content (`text`), generated_at; unique (user_id, month, scope).
    RLS `for all to authenticated using/with check (auth.uid() = user_id)` — same pattern as `20260717000001_full_data_model.sql`.
    Synced: add to `packages/sync/src/schema.ts` AppSchema and `supabase/powersync/sync-rules.yaml`.
- Edge Function `supabase/functions/ai-insights/index.ts` (Deno; first function in the repo — also add `supabase/config.toml` scaffolding):
  - Auth: require `Authorization: Bearer <user JWT>`; verify via supabase-js `getUser()`; reject anon.
  - Request body: `{ mode: 'chat' | 'monthly_summary', scope, question?, digest, history?: last N turns }`.
  - Budget check: read `ai_usage` for the current month; if `input + output >= INSIGHTS_MONTHLY_TOKEN_BUDGET` (env, default 1,000,000), return 429 with a friendly JSON error.
  - Call the Anthropic Messages API: raw `fetch` to `https://api.anthropic.com/v1/messages` with `stream: true`, model `claude-sonnet-5`, `max_tokens` ~4096 for chat and ~1024 for summary, no sampling params.
    System prompt: grounded financial assistant for Indian personal finance, INR formatting, answer ONLY from the digest, state what data is missing rather than inventing numbers.
  - Stream the Anthropic SSE bytes through to the client (`Content-Type: text/event-stream`).
    After `message_delta`/`message_stop`, upsert token usage into `ai_usage` with the service-role client; use `EdgeRuntime.waitUntil` so accounting doesn't block stream close.
  - Secrets: `ANTHROPIC_API_KEY` via `supabase secrets set` and `Deno.env.get` — never a `NEXT_PUBLIC_`/`EXPO_PUBLIC_` var.

### 2. Shared schema (`packages/schema`)

- `src/insights.ts` + tests: `InsightScope` enum (`everything | expenses | budget | portfolio | goals | tax`), `FinancialDigest` zod schema with typed sections per scope, `ChatMessage`, `AiSummary`, and the request/response payload schemas shared by client and Edge Function.

### 3. Shared core (`packages/core`)

- `src/insights/digest.ts` + Vitest suite: pure `buildFinancialDigest(scope, {transactions, categories, budgets, holdings, events, valuations, goals, fireSettings, month})` composing existing analytics — `calculateMonthlySummary`, `calculateCategoryBreakdown`, `calculateBudgetProgress`, `buildMonthlyTrend`, `calculatePortfolioSummary`, `calculateGoalProjections`, `calculateFireProjection`, `calculateRetirementCorpus`.
- Output is compact (rounded numbers, top-N categories/holdings, a few KB at most), deterministic, and scope-filtered.
- Tests assert shape, scoping, size discipline, and empty-data behavior ("no data" flags rather than zeros where absence matters).

### 4. PowerSync (`packages/sync`)

- `src/insights.ts` + tests: `AI_SUMMARIES_QUERY`, `mapAiSummaryRows`, `saveAiSummary` (upsert by user/month/scope), following the `goals.ts` conventions.
- Export from `src/index.ts`; add `ai_summaries` to `schema.ts`.

### 5. Web app (`apps/web`)

- `src/lib/insights.ts`: `useInsights()` — gathers local data via existing `*_QUERY` constants with `@powersync/react` `useQuery`, builds digests with core, and exposes:
  - `sendMessage(question, scope)` streaming from the Edge Function via raw `fetch` + `ReadableStream` reader; `Authorization` from the `useAuth()` session `access_token`; URL is `NEXT_PUBLIC_SUPABASE_URL` + `/functions/v1/ai-insights`.
  - `generateMonthlySummary()` which saves the result via `saveAiSummary` so it works offline afterwards.
- `src/components/insights/insights-workspace.tsx` + `chat-message.tsx`: chat thread (user/assistant bubbles, incremental streaming render), scope picker (existing `select.tsx`), suggested prompts as chips per scope, and budget-exceeded and offline states (offline: chat disabled with an explanation; cached summary still shown).
- `src/app/insights/page.tsx` (one-liner) and a `navItems` entry in `src/lib/nav.ts` (sparkles icon).
- Dashboard (`src/app/page.tsx`): new "Financial health" `Card` reading the latest `ai_summaries` row — the only live-data element added — with a "Generate"/"Refresh" action and generated-at timestamp; rest of the dashboard untouched.
- Markdown rendering for assistant messages: keep it dependency-light (bold/lists/paragraphs) or prompt the model to answer in plain prose; implementer's choice, noted in DECISIONS.md.

### 6. Mobile app (`apps/mobile`)

- Tab bar redesign in `app/(tabs)/_layout.tsx`: 5 visible slots — Dashboard, Expenses, Portfolio, Insights, More.
  "More" opens a bottom sheet/menu listing Tax, Goals, Settings; each remains a real route under `(tabs)` so deep links keep working (hide their tab buttons via `href: null`).
  Insights is never collapsed.
  Keep the bar height and spacing compact; reuse tokens; verify labels no longer need the 10px squeeze.
- `app/(tabs)/insights.tsx`, `components/insights/*`, `lib/insights.ts` mirroring web.
- Streaming on mobile: use `fetch` from `expo/fetch` (it streams response bodies; RN's built-in fetch does not).
  If streaming proves flaky in Expo Go, fall back to non-streaming JSON for mobile only and record it in DECISIONS.md.
- Mirror the dashboard health card on `app/(tabs)/index.tsx`.

### 7. UI/UX guardrails (binding for every component in this phase)

Do NOT invent new visual patterns; every screen in this phase is built from what already exists.

- Reuse primitives only: web `Card`/`CardHeader`/`CardTitle`/`CardLabel`, `Button`, `Input`, `select.tsx`, `Amount`; mobile `Card`, `Field`, `Choice`, `Amount`.
  No new one-off buttons, cards, or input styles.
  If a genuinely new primitive is needed (chat bubble, prompt chip), define it once in `components/insights/` on each platform, styled strictly from tokens, visually consistent with the existing card language (same radius, spacing, type scale).
- Tokens, never raw values: colors, spacing, radii, and typography come from `@finmanager/tokens` via the existing Tailwind/NativeWind classes (`bg-surface`, `text-foreground-muted`, `text-headline-lg`, `text-gain`/`text-loss`, etc.).
  No hex codes, no ad-hoc pixel values, no new fonts.
- Match the existing layout grammar: pages are a `flex-col gap-4` stack of Cards inside the standard shell (web `page.tsx` one-liner → workspace component; mobile `SafeAreaView` + `ScrollView`).
  The Insights screen uses the same skeleton (`WorkspaceSkeleton` / `MobileWorkspaceSkeleton` + `useInitialSkeleton`) and motion hooks (`data-motion-card` on web, `MotionView` staggering on mobile) as Goals/Portfolio.
  Verify both dark and light mode; no hardcoded light-only colors.
- Chat UI specifics: assistant/user messages are visually quiet (muted surface for assistant, primary-tinted for user), streaming text appears inline without layout jump, the composer stays pinned at the bottom and thumb-reachable on mobile, and suggested-prompt chips reuse the existing pill/chip look (see the module-placeholder phase pill for reference).
- Tab bar redesign stays minimal: same height class and token colors as today, icon+label style unchanged; the "More" sheet reuses the existing card surface and list styling — no custom modal chrome.
- Empty/edge states are designed, not defaulted: no-data, offline, budget-exhausted, and error states each get a short, friendly, token-styled message inside a standard Card — never a raw error string or unstyled text.
- The pixel-consciousness rule from the house guidelines applies: if something looks off next to the existing screens (alignment, spacing rhythm, contrast), fix it before calling the feature done.
  The bar is "indistinguishable from the Phase 5/6 screens in polish".

### 8. Verification + wrap-up

- `CI=true pnpm turbo run build test lint typecheck` and `pnpm format:check` green.
- Chrome E2E with the signed-in test account: seed month has data → ask "how am I doing on my budget this month?" → answer streams and cites real category/budget numbers; scope picker changes the digest; generate monthly summary → dashboard card appears; go offline → chat disabled gracefully, summary card still renders; budget guard returns the friendly error when the env budget is set to a tiny value.
- Expo Go: tab bar redesign looks right, chat works (or the documented fallback), summary card renders.
- Deploy: `supabase functions deploy ai-insights`, `supabase secrets set ANTHROPIC_API_KEY=...`, apply the migration, update PowerSync sync rules.
- Learning nudges (PRODUCTION_PLAN.md §7): pause to explain (a) the server-side LLM proxy pattern and why the API key must not ship to clients, (b) SSE streaming end to end, (c) the client-assembled digest vs server-side reads tradeoff, (d) token budgeting.
- Session end: update STATUS.md, rewrite HANDOFF.md, append DECISIONS.md, write `phases/briefing/phase-7.md`, and commit.
