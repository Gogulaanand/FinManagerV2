import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  compareMetrics,
  computeMetrics,
  createSanitizedFixture,
  runFullProjectLossScenario,
  runLocalDatabaseCorruptionScenario,
  runMalformedMigrationScenario,
  runSecureStoreKeyLossScenario,
} from './r2-recovery-drill.mjs';

test('sanitized fixture metrics include every clean-restore invariant', () => {
  const metrics = computeMetrics(createSanitizedFixture());
  assert.equal(metrics.referentialRelationships.valid, true);
  assert.deepEqual(metrics.rowCounts, {
    accounts: 1,
    categories: 1,
    transactions: 2,
    holdings: 1,
    holding_events: 2,
    valuations: 1,
    goals: 1,
    fire_settings: 1,
  });
  assert.deepEqual(metrics.monthlyTotals['2026-07'], { debit: 1250, credit: 50000 });
  assert.equal(metrics.xirrInputs.length, 2);
  assert.deepEqual(metrics.goalTotals, { target: 300000, current: 125000 });
});

test('malformed migration fails without data loss and forward repair succeeds', async () => {
  const result = await runMalformedMigrationScenario();
  assert.deepEqual(result.assertions, {
    malformedMigrationRejected: true,
    dataPreserved: true,
    forwardRepairApplied: true,
  });
});

test('lost key and corrupted local database recover by replacement and re-sync', async () => {
  const keyLoss = await runSecureStoreKeyLossScenario();
  const corruption = await runLocalDatabaseCorruptionScenario();
  assert.equal(keyLoss.assertions.resyncMetricsMatch, true);
  assert.equal(corruption.assertions.resyncMetricsMatch, true);
});

test('full project loss restores a clean isolated project and all invariants match', async () => {
  const result = await runFullProjectLossScenario();
  assert.deepEqual(result.assertions.invariantMatches, {
    rowCounts: true,
    referentialRelationships: true,
    balances: true,
    monthlyTotals: true,
    xirrInputs: true,
    goalTotals: true,
  });
  compareMetrics(result.sourceMetrics, result.restoredMetrics);
});
