# Phase 7 Briefing: AI Insights

Status: implementation complete; deployment and interactive verification pending.

## What is implemented

Phase 7 adds a privacy-conscious AI Insights module without introducing a second financial-data read path. Web and mobile build compact scope-filtered digests from the local PowerSync view using existing core analytics. An authenticated Supabase Edge Function holds the Anthropic credential, applies the grounded Indian-personal-finance prompt, enforces a per-user monthly token allowance, streams `claude-sonnet-5` SSE, and accounts for usage after the response.

Chat history is ephemeral. Only the monthly financial-health summary persists in the private, synced `ai_summaries` table, allowing the Insights screen and dashboard card to display it offline. `ai_usage` is private, server-written, and deliberately absent from PowerSync.

The web and mobile experiences share the same scope choices, suggested questions, split-frame SSE parser, friendly offline/budget/error states, and generated-at summary metadata. Mobile navigation now has five visible slots—Dashboard, Expenses, Portfolio, Insights, and More—with Tax, Goals, and Settings available from a bottom sheet and preserved as deep-linkable routes.

## Main file groups

- Database/backend: `supabase/migrations/20260719000004_phase7_ai_insights.sql`, `supabase/functions/ai-insights/index.ts`, `supabase/config.toml`, `supabase/powersync/sync-rules.yaml`
- Shared contracts: `packages/schema/src/insights.ts`, `packages/schema/src/insights.test.ts`
- Shared analytics/stream parser: `packages/core/src/insights/`
- Offline summary repository: `packages/sync/src/insights.ts`, `packages/sync/src/insights.test.ts`, `packages/sync/src/schema.ts`
- Web: `apps/web/src/lib/insights.ts`, `apps/web/src/components/insights/`, `apps/web/src/app/insights/page.tsx`, dashboard/nav integration
- Mobile: `apps/mobile/lib/insights.ts`, `apps/mobile/components/insights/`, `apps/mobile/app/(tabs)/insights.tsx`, dashboard/tab/More-sheet integration

## Automated evidence

- `CI=true pnpm turbo run build test lint typecheck`: 21/21 tasks passed on current main integration.
- `CI=true pnpm format:check`: clean.
- Tests: schema 31, core 156, sync 36.
- Web production output includes `/insights`.
- Expo iOS export completes and produces the iOS bundle.

## Pending exit evidence

The phase is not marked Done. The migration, Edge Function secret/function, and PowerSync rule still require deployment to the intended project. Chrome must prove the grounded budget answer, scope isolation, ephemeral reload, summary upsert and cached offline render, friendly 429 state, auth/validation, usage accounting, light/dark layout, and keyboard/accessibility behavior. Expo Go must prove five-slot navigation, the More sheet routes, streaming or the documented fallback, dashboard summary, and live-screen offline/reconnect behavior.

The executable deployment and manual scenarios are recorded in `phases/phase-7-ai-insights-plan.md`.
