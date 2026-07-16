# FinManager V2 - Agent Instructions

A personal finance super app (web + Expo mobile), built in phases by LLM coding agents.
PRODUCTION_PLAN.md at the repo root is the source of truth for scope, architecture, and phases.

## Session Protocol (read this first, every session)

1. Read STATUS.md to find the current phase and state.
2. Read HANDOFF.md for mid-phase state from the previous session.
3. If starting a new phase N, read phases/briefing/phase-(N-1).md and only the files it lists; skip broad codebase scanning.
4. Work only on the current phase; do not pull work forward from later phases.

At session end (always, even mid-phase):

1. Ensure the repo is green (typecheck, lint, tests) and commit.
2. Update STATUS.md (phase status, sessions spent).
3. Rewrite HANDOFF.md using its template.
4. Append to DECISIONS.md if any non-obvious decision was made.

At phase end (additionally):

1. Write phases/briefing/phase-N.md (100-200 lines): what was built with exact file paths, union of files touched, next phase section copied verbatim from PRODUCTION_PLAN.md.
2. Mark the phase Done in STATUS.md with a link to the briefing.

## Engineering Rules

- TypeScript strict everywhere; no `any` escapes without a comment stating the constraint.
- All domain math (tax, XIRR, projections, budgets) lives in packages/core as pure functions with Vitest suites written before or alongside the implementation; UI never contains business math.
- Shared entity types and validation live in packages/schema (zod); web and mobile import from there.
- Every Supabase table gets an RLS policy scoped to user_id in the same migration that creates it.
- Offline-first is a hard requirement: features read/write local SQLite via packages/sync; direct network reads in UI code are a bug (exception: auth and the AI edge function).
- Verify on both platforms before calling a feature done: web browser and Expo (simulator or device).
- Long operations (pnpm install, builds, test suites, EAS) run in background.

## Definition of Done (per phase)

- `pnpm turbo run build test lint` green.
- Feature exercised manually on web and mobile.
- Offline path verified for data features (airplane-mode write, relaunch, reconnect, sync confirmed).
- Briefing, STATUS.md, HANDOFF.md updated and committed.
