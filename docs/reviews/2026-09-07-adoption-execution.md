# Adoption follow-through — 7 September 2026

Scope: remaining sequence in `2026-09-05-adoption-implementation.md`. Work continues in the clean existing `codex/adoption-correctness` worktree, based on refreshed `origin/main` (`18bb2c8`) plus the first batch (`e5f41b7`). Primary checkout changes are preserved. Default Light route; no delegation.

## Requirements and acceptance

1. Sync: restore deployed provider operation; disposable first sync, write/reload, second browser, and provider-outage recovery. Provider health alone is not client acceptance.
2. Recovery: configure the three existing backup secrets, retain encrypted backup, restore only into an explicitly disposable destination, and compare records, relationships and financial totals. Preserve recovery passphrase independently.
3. Correctness: explicit investable FIRE corpus, confirmed expense baseline with sample coverage, manual balance snapshot labels and salary-estimator scope. Verify persistence/export round trips and independent financial reference cases.
4. Adoption: reconcile an actual statement cycle alongside existing records, after correctness/recovery passes. Cannot substitute synthetic data or elapsed development time.
5. Inactivity: agree recipient package; server-confirmed arming and check-in, actual warning grace, no-send simulation, trusted valuation, idempotent delivery and independent monitoring. Actual receipt requires owner-designated test recipients.
6. Beta: targeted dependency patches, password recovery, server/database CI coverage, approved/revoked access and tenant isolation, error-reporting evidence. Native/device proof stays separate.

## Verified operational observations

- GitHub: draft PR #20 (https://github.com/Gogulaanand/FinManagerV2/pull/20) contains both adoption batches; PR #18 remains open and separate. Production deployment is still `18bb2c8`.
- Repository secret names still omit `SUPABASE_DB_URL`, `SUPABASE_BACKUP_PASSPHRASE`, `DISPOSABLE_SUPABASE_DB_URL`. Latest observed backup run 34018298373 failed; restore run 33488654310 failed.
- Supabase `vkivzhbckfsjtvzatuiz` reports ACTIVE_HEALTHY.
- PowerSync existing Development instance `6a5b0b247f33bac37ef7cefc` (project displayed as Sunfabb) points to the FinManager database. It was deprovisioned, with a Stop completed August 31. Redeployed September 7 at 07:15 IST; completed at 07:16 in 1m4s. Dashboard reports no issues and active Sync Streams revision 6008. Provider recovery is verified; client evidence follows below.
- Authenticated staged test account: Settings reported Synced, zero pending/failed writes and a completed sync. Created synthetic expense `Adoption sync check 2026-09-07`, INR 123.45, debit, September 7; Supabase row `3a9586bd-03de-4d02-9798-a1b954cba7ee` matches. Closing/reopening the deployed browser shows the expense. The separate authenticated Codex browser also displayed the synthetic expense and Settings reported Synced, zero pending/failed writes and last complete sync September 7 at 21:19:01 IST. Independent-browser persistence is verified; controlled outage recovery remains under test. The clearly labelled synthetic row remains.
- Applied the existing `l3_tenant_isolation` migration to hosted Supabase after discovering the four parent-reference constraints were absent. Verified all four constraints now exist. Applied `adoption_fire_assumptions`; verified `investable_corpus` and `expenses_confirmed` exist remotely. No production record values were changed by those migrations.
- Hosted migration ledger predates manually applied beta-access objects; actual `beta_access` exists. Do not blindly replay every repository migration based only on ledger differences.
- Hosted inactivity cron ran September 5–7 with four enabled users, four processed and zero reported failures. Only `deadman-daily` is scheduled; no independent monitor job or `deadman_monitor_enabled` Vault entry exists. These are old-function outcomes, not acceptance of this branch's safeguards.

## Implemented and locally verified

- FIRE uses an explicit investable corpus and confirmed positive expense baseline. Legacy settings require confirmation. Coverage describes the last 12 completed local calendar months and keeps missing months unknown. Net worth, manual balance snapshots and salary-estimator limitations are labelled on web/mobile.
- Password recovery has public request/reset routes, a generic acknowledgement, validation and missing/expired-session handling. Its browser test intercepts every recovery request; no actual email or password change occurred.
- Inactivity preparation: server-only arming/check-in state, recipient changes restart warnings, at least seven full days after each provider-confirmed delivered warning, no-send simulation, canonical portfolio valuation with missing-FX refusal and preserved liabilities, durable recipient/cycle delivery keys, immutable retry payload and refusal outside the provider retry window. Client settings distinguish requested enablement from server confirmation. Inactivity migration and Edge Function are **not deployed** pending the recipient-package decision and operational acceptance.
- Restore workflow compares all public-table COPY records with the backed-up values, including financial inputs and relationship IDs, instead of accepting only table/count smoke checks.
- CI now includes omitted server/access tests, backup-verifier tests, Deno Edge checks, fresh migrations and pgTAP contracts. Fixed existing beta-access tests to assert denied anonymous SELECT and count the actual duplicate fixture without depending on a seed-global total.
- Dependency patch pass: Next.js 16.2.11 plus compatible transitive patches and sharp 0.35.0. Final audit reports two high image-size 1.x advisories and two moderate advisories (legacy uuid/decode-uri-component) in Expo/native tooling. Native major upgrades and device verification remain separate; no clean audit claim.

Verification at this working tree: workspace build, tests, lint, typecheck and full Prettier check passed; core 220, sync 89, schema 43 and tokens 27 tests (379 total). Server/access tests: 19. Independent watchdog tests: 2. Python backup-verifier tests: 2. Fresh isolated PostgreSQL reset and seven pgTAP files: 130 assertions. Deno 2.9.6 checks the Edge Function with its import map. Password recovery Playwright: 1 passed. CI at f7719ba passed build/test/lint/typecheck and fresh database contracts. Authenticated browser CI passed 20/22 tests; the two failures exposed an outdated settings label assertion and an outage fixture that did not block SharedWorker sync. Those fixtures are corrected, with a recovery assertion added; a new CI run is required.

The isolated local database lives at `/private/tmp/finmanager-adoption-db-20260907`, project id `finmanager-adoption-20260907`, database port 55432. The pre-existing Supabase container was preserved.

## Next work and exact access dependencies

1. Independent Codex-browser login, expense visibility and completed sync are verified. Complete controlled client outage/recovery acceptance without stopping the shared provider.
2. Backup: the three named GitHub secrets are still absent. Supabase only displays a password placeholder; GitHub cannot reveal existing secret values. Owner must supply the existing source DB password securely (or perform credential reset if lost) and identify an explicitly disposable restore project. Do not assume the other inactive Supabase project is disposable. Retain the encryption passphrase independently before running backup and restore workflows.
3. Review/deploy the branch, configure the recovery redirect URL, complete authenticated FIRE save/reload/export and real password-recovery receipt. Owner performs any new password entry.
4. Inactivity: owner selects existence notice, verified summary, or a full encrypted recovery package and designates test recipient(s). Current implementation supports the first two scopes; full encrypted package design is not implemented. Provider receipt polling and a separate GitHub Actions watchdog are implemented and locally tested, but neither is live. Before deployment, verify provider read access, delivery/bounce outcomes, actual watchdog alerts and deliberate failure/receipt drills. Provider acceptance alone does not prove inbox delivery. Never simulate by actually sending to existing trusted contacts.
5. Reconcile one real statement cycle: record opening/closing dated balances, debit/credit totals, imports and duplicate handling, independently valued holdings/FX, FIRE assumptions and any discrepancy. Keep existing records authoritative until recovery and reconciliation pass.
6. Verify Sentry source-map upload and protected runtime event, approved/revoked hosted access, and any intended physical-device workflow. Existing wiring/local tests do not close these gates.

Sole-record adoption and trusted inactivity handoff remain **No-Go** until these operational gates pass.
