# Phase 8.5 + Phase 9 web E2E

These checks use one dedicated Supabase account for the Phase 8.5 design-alignment scenarios and
Phase 9 critical paths. AI and dead-man Edge Function requests are intercepted whenever a UI state
can be verified without provider or email usage. No credential or privileged key belongs in the
repository.

Required environment:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  `NEXT_PUBLIC_POWERSYNC_URL` for the app.
- `SUPABASE_SECRET_KEY` for the server-only fixture script. The legacy
  `SUPABASE_SERVICE_ROLE_KEY` is accepted during key migration.
- `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` for the dedicated test account.

Run `pnpm --filter @finmanager/web e2e:seed`, then
`pnpm --filter @finmanager/web e2e`. The idempotent seed resets only fixture rows belonging to the
named E2E user. It creates 120 current-month transactions plus real account, budget, portfolio,
goal, FIRE, allocation, saved-summary, trusted-contact, and legacy-category data. It never deletes
the user or another account's rows.

Set `PLAYWRIGHT_BASE_URL` to test an already-running preview or production deployment. When unset,
Playwright starts the local Next.js dev server.
