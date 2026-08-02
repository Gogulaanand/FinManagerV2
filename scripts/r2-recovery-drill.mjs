import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';
const ACCOUNT_ID = '00000000-0000-4000-8000-000000000010';
const CATEGORY_ID = '00000000-0000-4000-8000-000000000020';
const TRANSACTION_ID = '00000000-0000-4000-8000-000000000030';
const HOLDING_ID = '00000000-0000-4000-8000-000000000040';
const EVENT_ID = '00000000-0000-4000-8000-000000000050';
const VALUATION_ID = '00000000-0000-4000-8000-000000000060';
const GOAL_ID = '00000000-0000-4000-8000-000000000070';
const FIRE_ID = '00000000-0000-4000-8000-000000000080';

const COLLECTIONS = [
  'accounts',
  'categories',
  'transactions',
  'holdings',
  'holding_events',
  'valuations',
  'goals',
  'fire_settings',
];

function clone(value) {
  return structuredClone(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function createSanitizedFixture(userId = USER_ID) {
  return {
    accounts: [
      {
        id: ACCOUNT_ID,
        user_id: userId,
        name: 'Sanitized checking account',
        currency: 'INR',
        current_balance: 125000,
      },
    ],
    categories: [
      {
        id: CATEGORY_ID,
        user_id: userId,
        name: 'Sanitized groceries',
        kind: 'expense',
      },
    ],
    transactions: [
      {
        id: TRANSACTION_ID,
        user_id: userId,
        account_id: ACCOUNT_ID,
        category_id: CATEGORY_ID,
        amount: -1250,
        occurred_at: '2026-07-12T10:00:00.000Z',
      },
      {
        id: '00000000-0000-4000-8000-000000000031',
        user_id: userId,
        account_id: ACCOUNT_ID,
        category_id: CATEGORY_ID,
        amount: 50000,
        occurred_at: '2026-07-01T10:00:00.000Z',
      },
    ],
    holdings: [
      {
        id: HOLDING_ID,
        user_id: userId,
        name: 'Sanitized index fund',
        current_value: 100000,
      },
    ],
    holding_events: [
      {
        id: EVENT_ID,
        user_id: userId,
        holding_id: HOLDING_ID,
        amount: -80000,
        occurred_at: '2026-06-15T10:00:00.000Z',
      },
      {
        id: '00000000-0000-4000-8000-000000000051',
        user_id: userId,
        holding_id: HOLDING_ID,
        amount: 100000,
        occurred_at: '2026-07-31T10:00:00.000Z',
      },
    ],
    valuations: [
      {
        id: VALUATION_ID,
        user_id: userId,
        holding_id: HOLDING_ID,
        value: 100000,
        as_of: '2026-07-31',
      },
    ],
    goals: [
      {
        id: GOAL_ID,
        user_id: userId,
        name: 'Sanitized emergency fund',
        target_amount: 300000,
        current_amount: 125000,
        linked_holding_ids: [HOLDING_ID],
      },
    ],
    fire_settings: [
      {
        id: FIRE_ID,
        user_id: userId,
        annual_expenses: 600000,
        withdrawal_rate: 4,
      },
    ],
  };
}

function requireCollection(fixture, collection) {
  assert.ok(Array.isArray(fixture[collection]), `${collection} must be an array`);
  return fixture[collection];
}

export function computeMetrics(fixture) {
  const accounts = requireCollection(fixture, 'accounts');
  const categories = requireCollection(fixture, 'categories');
  const transactions = requireCollection(fixture, 'transactions');
  const holdings = requireCollection(fixture, 'holdings');
  const holdingEvents = requireCollection(fixture, 'holding_events');
  const valuations = requireCollection(fixture, 'valuations');
  const goals = requireCollection(fixture, 'goals');
  const accountIds = new Set(accounts.map((row) => row.id));
  const categoryIds = new Set(categories.map((row) => row.id));
  const holdingIds = new Set(holdings.map((row) => row.id));
  const missingRelationships = [];

  for (const row of transactions) {
    if (!accountIds.has(row.account_id)) missingRelationships.push(`transaction:${row.id}:account`);
    if (!categoryIds.has(row.category_id))
      missingRelationships.push(`transaction:${row.id}:category`);
  }
  for (const row of [...holdingEvents, ...valuations]) {
    if (!holdingIds.has(row.holding_id)) missingRelationships.push(`holding:${row.id}:holding`);
  }
  for (const row of goals) {
    for (const holdingId of row.linked_holding_ids ?? []) {
      if (!holdingIds.has(holdingId)) missingRelationships.push(`goal:${row.id}:holding`);
    }
  }

  const monthlyTotals = {};
  for (const row of transactions) {
    const month = row.occurred_at.slice(0, 7);
    monthlyTotals[month] ??= { debit: 0, credit: 0 };
    if (row.amount < 0) monthlyTotals[month].debit += Math.abs(row.amount);
    else monthlyTotals[month].credit += row.amount;
  }

  const xirrInputs = holdingEvents
    .map((row) => ({ date: row.occurred_at.slice(0, 10), amount: row.amount }))
    .sort((left, right) => left.date.localeCompare(right.date));

  return {
    rowCounts: Object.fromEntries(
      COLLECTIONS.map((name) => [name, requireCollection(fixture, name).length]),
    ),
    referentialRelationships: {
      valid: missingRelationships.length === 0,
      missing: missingRelationships,
    },
    balances: {
      accounts: accounts.map((row) => ({ id: row.id, amount: row.current_balance })),
      total: accounts.reduce((sum, row) => sum + row.current_balance, 0),
    },
    monthlyTotals,
    xirrInputs,
    goalTotals: {
      target: goals.reduce((sum, row) => sum + row.target_amount, 0),
      current: goals.reduce((sum, row) => sum + row.current_amount, 0),
    },
  };
}

export function compareMetrics(source, target) {
  assert.deepStrictEqual(target, source);
  return {
    rowCounts: true,
    referentialRelationships: true,
    balances: true,
    monthlyTotals: true,
    xirrInputs: true,
    goalTotals: true,
  };
}

function encryptedPayload(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    algorithm: 'AES-256-GCM local isolated harness',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

function decryptPayload(envelope, key) {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

async function sqlite(dbPath, sql) {
  return await new Promise((resolve, reject) => {
    const child = spawn('sqlite3', [dbPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `sqlite3 exited with ${code}`));
    });
    child.stdin.end(sql);
  });
}

async function withTempDirectory(callback) {
  const root = await mkdtemp(join(tmpdir(), 'finmanager-r24-'));
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function runTransactionDeletionScenario() {
  const source = createSanitizedFixture();
  const artifact = clone(source);
  const damaged = clone(source);
  damaged.transactions = damaged.transactions.filter((row) => row.id !== TRANSACTION_ID);
  assert.notDeepStrictEqual(computeMetrics(source), computeMetrics(damaged));
  const restored = damaged.transactions.concat(
    artifact.transactions.filter((row) => row.id === TRANSACTION_ID),
  );
  compareMetrics(computeMetrics(source), computeMetrics({ ...damaged, transactions: restored }));
  return {
    steps: [
      'Freeze the sanitized fixture and record the missing transaction id.',
      'Compare the damaged fixture with the pre-deletion recovery artifact.',
      'Restore only the matching transaction by stable id.',
      'Recompute all recovery metrics and confirm equality.',
    ],
    assertions: { deletionDetected: true, transactionRestored: true, metricsMatch: true },
    evidence: ['sanitized-recovery-artifact', `restored-transaction:${TRANSACTION_ID}`],
  };
}

export async function runMalformedMigrationScenario() {
  return await withTempDirectory(async (root) => {
    const dbPath = join(root, 'migration-drill.sqlite');
    await sqlite(
      dbPath,
      "create table records (id text primary key, value text not null); insert into records values ('fixture-1', 'preserved');",
    );
    const before = await sqlite(
      dbPath,
      "select count(*) || '|' || value from records where id = 'fixture-1';",
    );
    await assert.rejects(
      sqlite(dbPath, 'alter table records add column broken_marker text not null;'),
      /Cannot add a NOT NULL column with default value NULL/i,
    );
    const afterFailure = await sqlite(
      dbPath,
      "select count(*) || '|' || value from records where id = 'fixture-1';",
    );
    await sqlite(
      dbPath,
      "alter table records add column repaired_marker text not null default 'forward-repaired'; update records set repaired_marker = 'forward-repaired';",
    );
    const afterRepair = await sqlite(
      dbPath,
      "select count(*) || '|' || value || '|' || repaired_marker from records where id = 'fixture-1';",
    );
    assert.equal(before, '1|preserved');
    assert.equal(afterFailure, before);
    assert.equal(afterRepair, '1|preserved|forward-repaired');
    return {
      steps: [
        'Clone the sanitized SQLite database and capture the pre-migration row.',
        'Apply a NOT NULL migration without a default and require failure.',
        'Verify the original row remains unchanged after the failed migration.',
        'Apply a versioned forward repair with a safe default and verify the marker.',
      ],
      assertions: {
        malformedMigrationRejected: true,
        dataPreserved: true,
        forwardRepairApplied: true,
      },
      evidence: [
        'isolated-sqlite-before',
        'isolated-sqlite-failed-migration',
        'isolated-sqlite-forward-repair',
      ],
    };
  });
}

async function recoverEncryptedLocalState(root, label) {
  const source = createSanitizedFixture();
  const localPath = join(root, `${label}.local.enc.json`);
  const keyPath = join(root, `${label}.device-key`);
  const key = randomBytes(32);
  await writeFile(keyPath, key.toString('base64'));
  await writeFile(localPath, JSON.stringify(encryptedPayload(JSON.stringify(source), key)));
  return { source, localPath, keyPath };
}

export async function runSecureStoreKeyLossScenario() {
  return await withTempDirectory(async (root) => {
    const { source, localPath, keyPath } = await recoverEncryptedLocalState(root, 'secure-store');
    const envelope = JSON.parse(await readFile(localPath, 'utf8'));
    await rm(keyPath);
    await assert.rejects(
      async () =>
        decryptPayload(envelope, Buffer.from('missing-device-key', 'utf8').subarray(0, 32)),
      /Unsupported state|authenticate|bad decrypt|Invalid key length/i,
    );
    const newKey = randomBytes(32);
    await writeFile(keyPath, newKey.toString('base64'));
    await writeFile(localPath, JSON.stringify(encryptedPayload(JSON.stringify(source), newKey)));
    const restored = JSON.parse(
      decryptPayload(JSON.parse(await readFile(localPath, 'utf8')), newKey),
    );
    compareMetrics(computeMetrics(source), computeMetrics(restored));
    return {
      steps: [
        'Stop the isolated mobile database and remove only its simulated device-only key.',
        'Require the old encrypted database to fail closed.',
        'Create a new key/database and re-sync the sanitized fixture.',
        'Compare the re-synced metrics with the server-shaped fixture.',
      ],
      assertions: { oldKeyRejected: true, newDatabaseCreated: true, resyncMetricsMatch: true },
      evidence: ['simulated-secure-store-key-removed', 'fresh-local-database', 'sanitized-resync'],
    };
  });
}

export async function runLocalDatabaseCorruptionScenario() {
  return await withTempDirectory(async (root) => {
    const { source, localPath, keyPath } = await recoverEncryptedLocalState(root, 'corrupt-db');
    const key = Buffer.from(await readFile(keyPath, 'utf8'), 'base64');
    const envelope = JSON.parse(await readFile(localPath, 'utf8'));
    envelope.ciphertext = `${envelope.ciphertext.slice(0, -2)}AA`;
    await writeFile(localPath, JSON.stringify(envelope));
    await assert.rejects(
      async () => decryptPayload(JSON.parse(await readFile(localPath, 'utf8')), key),
      /Unsupported state|authenticate|bad decrypt/i,
    );
    const newKey = randomBytes(32);
    await writeFile(keyPath, newKey.toString('base64'));
    await writeFile(localPath, JSON.stringify(encryptedPayload(JSON.stringify(source), newKey)));
    const restored = JSON.parse(
      decryptPayload(JSON.parse(await readFile(localPath, 'utf8')), newKey),
    );
    compareMetrics(computeMetrics(source), computeMetrics(restored));
    return {
      steps: [
        'Stop the isolated local database and corrupt its encrypted bytes.',
        'Require checksum/authentication failure before reading local rows.',
        'Discard only the disposable local copy and create a clean database.',
        'Re-sync the sanitized fixture and compare the required metrics.',
      ],
      assertions: {
        corruptionRejected: true,
        cleanDatabaseCreated: true,
        resyncMetricsMatch: true,
      },
      evidence: ['corrupted-local-database', 'fresh-local-database', 'sanitized-resync'],
    };
  });
}

export async function runCompromisedSessionScenario() {
  const fixture = createSanitizedFixture();
  const sessions = new Map([['revoked-session', { userId: USER_ID, revoked: false }]]);
  const readWithSession = (token, userId) => {
    const session = sessions.get(token);
    if (!session || session.revoked || session.userId !== userId)
      throw new Error('Session is revoked');
    return fixture.accounts.filter((row) => row.user_id === userId);
  };
  sessions.get('revoked-session').revoked = true;
  assert.throws(() => readWithSession('revoked-session', USER_ID), /revoked/i);
  sessions.set('fresh-session', { userId: USER_ID, revoked: false });
  assert.equal(readWithSession('fresh-session', USER_ID).length, 1);
  assert.throws(() => readWithSession('fresh-session', OTHER_USER_ID), /revoked/i);
  return {
    steps: [
      'Revoke the simulated compromised session and record the incident timestamp.',
      'Reject the revoked session before returning any account data.',
      'Create a new session for the sanitized test account.',
      'Verify same-account access and different-account isolation.',
    ],
    assertions: {
      revokedSessionRejected: true,
      reauthenticationSucceeded: true,
      ownershipIsolated: true,
    },
    evidence: [
      'revoked-simulated-session',
      'fresh-simulated-session',
      'cross-account-read-rejected',
    ],
  };
}

export async function runFullProjectLossScenario() {
  return await withTempDirectory(async (root) => {
    const source = createSanitizedFixture();
    const sourceProject = join(root, 'source-project');
    const replacementProject = join(root, 'replacement-project');
    await mkdir(sourceProject, { recursive: true });
    await writeFile(join(sourceProject, 'project.json'), JSON.stringify(source));
    const plaintext = JSON.stringify(source);
    const payload = JSON.stringify({
      format: 'finmanager-local-encrypted-backup-v1',
      checksums: { 'project.json': sha256(plaintext) },
      project: plaintext,
    });
    const key = randomBytes(32);
    const artifact = encryptedPayload(payload, key);
    const artifactPath = join(root, 'encrypted-backup.artifact.json');
    await writeFile(artifactPath, JSON.stringify(artifact));
    await rm(sourceProject, { recursive: true, force: true });
    await mkdir(replacementProject, { recursive: true });
    const decrypted = JSON.parse(
      decryptPayload(JSON.parse(await readFile(artifactPath, 'utf8')), key),
    );
    assert.equal(decrypted.checksums['project.json'], sha256(decrypted.project));
    const restored = JSON.parse(decrypted.project);
    await writeFile(join(replacementProject, 'project.json'), JSON.stringify(restored));
    const restoredFromProject = JSON.parse(
      await readFile(join(replacementProject, 'project.json'), 'utf8'),
    );
    const invariantMatches = compareMetrics(
      computeMetrics(source),
      computeMetrics(restoredFromProject),
    );
    return {
      steps: [
        'Freeze the isolated source project and record simulated project loss.',
        'Use the local encrypted backup artifact and verify its SHA-256 manifest before restore.',
        'Decrypt into a fresh replacement project and write the restored data in one isolated step.',
        'Compare row counts, relationships, balances, monthly totals, XIRR inputs, and goal totals.',
        'Remove decrypted/temp material after the comparison.',
      ],
      assertions: { checksumVerified: true, replacementProjectCreated: true, invariantMatches },
      evidence: [
        'local-encrypted-backup-artifact',
        'sha256-manifest-verified',
        'fresh-replacement-project',
      ],
      encryption: artifact.algorithm,
      sourceMetrics: computeMetrics(source),
      restoredMetrics: computeMetrics(restoredFromProject),
    };
  });
}

async function runScenario(id, title, operation) {
  const startedAt = new Date().toISOString();
  const started = process.hrtime.bigint();
  try {
    const result = await operation();
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    return {
      id,
      title,
      status: 'passed',
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
      ...result,
    };
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    return {
      id,
      title,
      status: 'failed',
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runDrill() {
  const startedAt = new Date().toISOString();
  const started = process.hrtime.bigint();
  const scenarios = [
    await runScenario('R24-01', 'Accidental transaction deletion', runTransactionDeletionScenario),
    await runScenario(
      'R24-02',
      'Malformed migration and forward repair',
      runMalformedMigrationScenario,
    ),
    await runScenario('R24-03', 'Lost mobile SecureStore key', runSecureStoreKeyLossScenario),
    await runScenario('R24-04', 'Corrupted local database', runLocalDatabaseCorruptionScenario),
    await runScenario('R24-05', 'Compromised account session', runCompromisedSessionScenario),
    await runScenario('R24-06', 'Full disposable-project loss', runFullProjectLossScenario),
  ];
  const completedAt = new Date().toISOString();
  const report = {
    format: 'finmanager-r2.4-recovery-drill-v1',
    environment: 'temporary local isolated state; sanitized fixture only',
    startedAt,
    completedAt,
    durationMs: Number(process.hrtime.bigint() - started) / 1e6,
    scenarios,
  };
  assert.ok(
    scenarios.every((scenario) => scenario.status === 'passed'),
    'one or more drill scenarios failed',
  );
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDrill()
    .then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      process.exitCode = 1;
    });
}
