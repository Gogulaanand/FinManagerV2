import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDirectory = join(repositoryRoot, 'supabase', 'migrations');
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((file) => /^\d+_.+\.sql$/.test(file))
  .sort();
const migrationVersions = migrationFiles.map((file) => file.slice(0, file.indexOf('_')));

if (
  migrationFiles.length === 0 ||
  new Set(migrationVersions).size !== migrationVersions.length ||
  [...migrationVersions].sort().join(',') !== migrationVersions.join(',')
) {
  throw new Error('Migration filenames must contain unique, lexically ordered versions.');
}

console.log(`L3.1 migration order (${migrationFiles.length}): ${migrationFiles.join(' -> ')}`);

const cliEnvironment = {
  ...process.env,
  SUPABASE_TELEMETRY_DISABLED: 'true',
};

function runSupabase(args) {
  const result = spawnSync('supabase', args, {
    cwd: repositoryRoot,
    env: cliEnvironment,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runSupabase(['db', 'reset', '--local', '--no-seed', '--yes']);
runSupabase(['test', 'db', '--local', 'supabase/tests/database/fresh_migration.test.sql']);
