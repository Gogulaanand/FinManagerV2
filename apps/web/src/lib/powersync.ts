/**
 * The on-device PowerSync database for web (wa-sqlite over OPFS/IndexedDB).
 *
 * A lazy singleton: instantiated once, only in the browser. The worker paths
 * point at the pre-bundled assets copied into public/@powersync by the
 * `powersync-web copy-assets` postinstall (Turbopack cannot dynamically import
 * workers yet).
 */
import { AppSchema, SupabaseConnector } from '@finmanager/sync';
import { PowerSyncDatabase, WASQLiteOpenFactory } from '@powersync/web';

import { supabase } from './supabase';

let dbInstance: PowerSyncDatabase | null = null;

export function getPowerSync(): PowerSyncDatabase {
  if (dbInstance) return dbInstance;
  dbInstance = new PowerSyncDatabase({
    database: new WASQLiteOpenFactory({
      dbFilename: 'finmanager.db',
      worker: '/@powersync/worker/WASQLiteDB.umd.js',
    }),
    schema: AppSchema,
    // The DB is harmless during SSR (the SDK no-ops in Node); silence the warning.
    flags: { disableSSRWarning: true },
    sync: { worker: '/@powersync/worker/SharedSyncImplementation.umd.js' },
  });
  return dbInstance;
}

let connectorInstance: SupabaseConnector | null = null;

export function getConnector(): SupabaseConnector {
  const powerSyncUrl = process.env.NEXT_PUBLIC_POWERSYNC_URL;
  if (!powerSyncUrl) {
    throw new Error('Missing NEXT_PUBLIC_POWERSYNC_URL');
  }
  connectorInstance ??= new SupabaseConnector(supabase, powerSyncUrl);
  return connectorInstance;
}
