'use client';

import { useStatus } from '@powersync/react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/components/providers';
import { WorkspaceSkeleton } from '@/components/motion/skeleton';

function useWaitExpired(waiting: boolean): boolean {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setExpired(waiting), waiting ? 15_000 : 0);
    return () => window.clearTimeout(timer);
  }, [waiting]);
  return waiting && expired;
}

/** Cached completed data remains usable while reconnection is unavailable. */
export function useSyncAvailability() {
  const status = useStatus();
  const { session, loading, authTransitionError } = useAuth();
  const initialSync = Boolean(session && !status.hasSynced && !status.lastSyncedAt);
  const expired = useWaitExpired(initialSync);
  const failed = Boolean(
    authTransitionError || status.dataFlowStatus.downloadError || status.dataFlowStatus.uploadError,
  );
  return {
    loading,
    initialSync,
    attention: failed || expired,
    stale: Boolean(session && (!status.connected || failed)),
    session,
    lastSyncedAt: status.lastSyncedAt,
  };
}

export function SyncStatusBanner() {
  const sync = useSyncAvailability();
  if (!sync.session) return null;
  return (
    <div
      role="status"
      className="mb-4 rounded-md border border-border bg-surface p-3 font-body text-caption text-foreground-muted"
    >
      <p>
        {sync.initialSync
          ? sync.attention
            ? 'Initial sync has not completed. Financial totals are unavailable. Check the connection and retry in Settings.'
            : 'Waiting for the first complete sync. Financial totals are unavailable until it finishes.'
          : sync.stale
            ? 'Showing cached data. Totals may be out of date until sync reconnects.'
            : 'Showing locally saved data; changes may still be syncing.'}
      </p>
      <p>
        Last complete sync: {sync.lastSyncedAt?.toLocaleString() ?? 'Not yet'}.{' '}
        <Link href="/settings#sync-health" className="font-medium text-primary underline">
          View sync status
        </Link>
      </p>
    </div>
  );
}

/** Do not mount data queries against a fresh database until first sync completes. */
export function SyncDataBoundary({ children, label }: { children: ReactNode; label: string }) {
  const sync = useSyncAvailability();
  if (sync.loading || sync.initialSync) {
    return <DataLoadingState label={label} failed={sync.attention} />;
  }
  return <>{children}</>;
}

/** Bounded local-query loading also provides a recovery route if SQLite fails. */
export function DataLoadingState({ label, failed = false }: { label: string; failed?: boolean }) {
  const expired = useWaitExpired(true);
  return (
    <div className="space-y-4">
      <p role="status" className="font-body text-body-md text-foreground-muted">
        {failed || expired
          ? 'Your data is not available yet. Review sync status before relying on financial totals.'
          : label + '…'}{' '}
        <Link href="/settings#sync-health" className="text-primary underline">
          Open sync settings
        </Link>
      </p>
      {!failed && !expired ? <WorkspaceSkeleton label={label} /> : null}
    </div>
  );
}
