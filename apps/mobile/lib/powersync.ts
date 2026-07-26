/**
 * The on-device PowerSync database for mobile.
 *
 * Expo Go keeps the pure-JS SQL.js adapter because its sandbox cannot load
 * custom native modules. Development, preview, and production builds use
 * OP-SQLite compiled with SQLCipher and a device-only SecureStore key.
 */
import { SQLJSOpenFactory } from '@powersync/adapter-sql-js';
import { PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema, SupabaseConnector } from '@finmanager/sync';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import { supabase } from './supabase';

let dbInstance: PowerSyncDatabase | null = null;

const DATABASE_KEY_NAME = 'finmanager-powersync-database-key-v1';

function databaseKey(): string {
  const stored = SecureStore.getItem(DATABASE_KEY_NAME);
  if (stored) return stored;
  const created = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
  SecureStore.setItem(DATABASE_KEY_NAME, created, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return created;
}

function databaseFactory() {
  if (Constants.expoGoConfig) {
    return new SQLJSOpenFactory({ dbFilename: 'finmanager.db' });
  }
  // This must remain a runtime require. Importing OP-SQLite at module scope
  // evaluates its native binding and crashes inside Expo Go before the adapter
  // switch can select SQL.js.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { OPSqliteOpenFactory } =
    require('@powersync/op-sqlite') as typeof import('@powersync/op-sqlite');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return new OPSqliteOpenFactory({
    dbFilename: 'finmanager.db',
    sqliteOptions: { encryptionKey: databaseKey() },
  });
}

export function getPowerSync(): PowerSyncDatabase {
  dbInstance ??= new PowerSyncDatabase({
    schema: AppSchema,
    database: databaseFactory(),
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
