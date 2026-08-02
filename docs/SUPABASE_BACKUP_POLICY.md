# Supabase backup policy

Status: R2.3 implementation in progress. The workflows and this policy are versioned, but the
operational gate stays open until the repository secrets are configured and one backup plus one
disposable-project rehearsal produce retained run evidence.

## Policy and recovery objectives

This is the personal-use MVP policy. It is intentionally separate from Supabase's paid platform
backup add-ons and does not claim to provide PITR.

| Item                   | Policy                                                                            |
| ---------------------- | --------------------------------------------------------------------------------- |
| Logical backup cadence | Daily at 02:17 UTC, with manual `workflow_dispatch` available                     |
| Target RPO             | 24 hours, bounded by the last successful backup run                               |
| Target RTO             | 4 hours for a manual project-loss recovery; measure actual time during rehearsal  |
| External retention     | 35 days of encrypted GitHub Actions artifacts                                     |
| Restore rehearsal      | Monthly on the first day at 03:23 UTC, into a disposable Supabase project         |
| Backup contents        | Supabase CLI roles, schema, and data dumps plus checksums and a manifest          |
| Encryption             | AES-256 symmetric GPG encryption before upload; the passphrase is never committed |

The repository must remain configured so that backup artifacts are not committed to source. The
artifact contains ciphertext only; the plaintext dump and passphrase are removed from the runner
before the job completes. Review artifact visibility whenever repository visibility or organization
permissions change.

## Required GitHub secrets

Configure these secrets before enabling or manually dispatching the workflows:

- `SUPABASE_DB_URL`: the production Postgres connection string, preferably the Supabase session
  pooler connection string. It must never be echoed or written to a repository file.
- `SUPABASE_BACKUP_PASSPHRASE`: a randomly generated passphrase of at least 32 characters. Store
  it in the approved password manager as well as GitHub Actions secrets so a project-loss recovery
  is possible.
- `DISPOSABLE_SUPABASE_DB_URL`: a separate, non-production project used only by the monthly
  rehearsal. Never point this secret at production.

The workflows fail closed when any required secret is missing or the passphrase is too short. No
secret is needed in local development and no secret belongs in `.env`, SQL migrations, or backup
artifacts.

## Daily backup workflow

`.github/workflows/supabase-backup.yml` runs the supported Supabase CLI sequence:

1. Dump roles to `roles.sql`.
2. Dump application schema to `schema.sql`.
3. Dump data with `--data-only --use-copy`, excluding Supabase-managed vector tables.
4. Write SHA-256 checksums and a non-sensitive manifest.
5. Archive the files, encrypt the archive with the repository passphrase, decrypt it once on the
   runner to verify the passphrase, and upload only the encrypted archive.

The artifact name is `supabase-logical-backup-<run-id>`. GitHub's artifact retention is set to 35
days in the workflow, so a successful daily run normally leaves more than one recoverable copy.
The backup run is still considered failed if a dump, encryption, checksum, or local decrypt check
fails.

## Monthly restore rehearsal

`.github/workflows/supabase-restore-rehearsal.yml` selects the latest successful backup run (or a
manually supplied run ID), downloads its encrypted artifact with the workflow token, decrypts it,
checks every dump checksum, and restores `schema.sql` plus `data.sql` in one `psql` transaction into
`DISPOSABLE_SUPABASE_DB_URL`. It then records only aggregate smoke evidence in the job summary:
the backup run ID, rehearsal run ID, public table count, and restored account-row count.

`roles.sql` remains in the encrypted artifact but is not applied automatically during the rehearsal:
Supabase-managed roles are project-specific and may require manual adaptation during full project
recovery. The operator must retain the roles dump and follow Supabase's managed-role guidance when
recovering a project.

The rehearsal is successful only when artifact download, decryption, checksum verification, schema
restore, data restore, and the smoke queries all succeed. Save the run URL, duration, backup run ID,
and measured recovery time in the release evidence ledger. A missing secret, missing backup artifact,
or disposable-project connection is an operational failure, not a waiver.

## Project-loss recovery outline

1. Freeze writes and record the incident start time.
2. Create or select a new Supabase project and configure required extensions, database webhooks,
   Realtime publications, Auth settings, and Edge Function secrets.
3. Download the last successful encrypted artifact, decrypt it with the approved passphrase, and
   verify `checksums.sha256` before using any SQL file.
4. Apply `schema.sql` and `data.sql` with `psql --single-transaction --variable ON_ERROR_STOP=1`.
5. Adapt and apply `roles.sql` only after reviewing managed-role ownership and permissions.
6. Reapply the repository migrations/functions and verify RLS, Auth, PowerSync, and restore RPC
   behavior against the new project.
7. Run the R2.2 clean-account restore drill and the Phase 9 production/auth acceptance checks.
8. Record exact timestamps, row-count comparisons, failed steps, and the measured RTO.

This outline is a recovery procedure, not evidence that a recovery has already been performed.
The personal-use MVP remains **No-Go** until the first clean-account restore and this backup policy
have concrete retained evidence.
