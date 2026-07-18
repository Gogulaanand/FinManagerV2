/**
 * The on-device PowerSync database for mobile.
 *
 * Uses the SQL.js adapter so it runs inside Expo Go (a pure-JS SQLite, no native
 * module). This is the deliberate Phase 3 choice to keep the Expo Go dev loop;
 * the packages/sync layer is adapter-agnostic, so swapping to native OP-SQLite at
 * the Phase 9 hardening is a localized change to this file (D-021).
 */
import { SQLJSOpenFactory } from '@powersync/adapter-sql-js';
import { PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema, SupabaseConnector } from '@finmanager/sync';

import { supabase } from './supabase';

let dbInstance: PowerSyncDatabase | null = null;

export function getPowerSync(): PowerSyncDatabase {
  dbInstance ??= new PowerSyncDatabase({
    schema: AppSchema,
    database: new SQLJSOpenFactory({ dbFilename: 'finmanager.db' }),
  });
  return dbInstance;
}

let connectorInstance: SupabaseConnector | null = null;

export function getConnector(): SupabaseConnector {
  const powerSyncUrl = process.env.EXPO_PUBLIC_POWERSYNC_URL;
  if (!powerSyncUrl) {
    throw new Error('Missing EXPO_PUBLIC_POWERSYNC_URL');
  }
  connectorInstance ??= new SupabaseConnector(supabase, powerSyncUrl);
  return connectorInstance;
}
