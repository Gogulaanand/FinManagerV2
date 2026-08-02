'use client';

import {
  getSyncFailureSummaries,
  getSyncHealthSnapshot,
  resolveSyncHealthStatus,
  retrySyncFailures,
  type SyncFailureSummary,
  type SyncHealthSnapshot,
  type SyncHealthStatus,
} from '@finmanager/sync';
import { AlertTriangle, CheckCircle2, CloudOff, LoaderCircle, RefreshCw } from 'lucide-react';
import { usePowerSync, useStatus } from '@powersync/react';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { getConnector } from '@/lib/powersync';

const STATUS_LABELS: Record<SyncHealthStatus, string> = {
  synced: 'Synced',
  syncing: 'Syncing',
  offline: 'Offline',
  'action-required': 'Action required',
};

const STATUS_DESCRIPTIONS: Record<SyncHealthStatus, string> = {
  synced: 'Your local changes are up to date.',
  syncing: 'FinManager is exchanging changes with the server.',
  offline: 'Changes stay on this device until a connection is available.',
  'action-required': 'Some queued changes need attention before they can sync.',
};

function StatusIcon({ status }: { status: SyncHealthStatus }) {
  if (status === 'synced') return <CheckCircle2 className="text-gain" aria-hidden="true" />;
  if (status === 'syncing')
    return <LoaderCircle className="animate-spin text-primary" aria-hidden="true" />;
  if (status === 'action-required')
    return <AlertTriangle className="text-warning" aria-hidden="true" />;
  return <CloudOff className="text-foreground-muted" aria-hidden="true" />;
}

function failureLabel(summary: SyncFailureSummary): string {
  return `${summary.count} ${summary.failureClass} change${summary.count === 1 ? '' : 's'}`;
}

export function SyncHealthPanel() {
  const db = usePowerSync();
  const status = useStatus();
  const { session } = useAuth();
  const [snapshot, setSnapshot] = useState<SyncHealthSnapshot | null>(null);
  const [summaries, setSummaries] = useState<readonly SyncFailureSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setSnapshot(null);
      setSummaries([]);
      setError(null);
      return;
    }
    try {
      const [nextSnapshot, nextSummaries] = await Promise.all([
        getSyncHealthSnapshot(db, session.user.id),
        getSyncFailureSummaries(db, session.user.id),
      ]);
      setSnapshot(nextSnapshot);
      setSummaries(nextSummaries);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not read sync health.');
    }
  }, [db, session]);

  const flow = status.dataFlowStatus;
  const lastSyncedAt = status.lastSyncedAt?.getTime() ?? 0;
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (active) await refresh();
    };
    void load();
    const timer = window.setInterval(() => void load(), 3_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [
    lastSyncedAt,
    refresh,
    status.connected,
    status.connecting,
    status.hasSynced,
    flow.downloading,
    flow.uploading,
    flow.uploadError,
    flow.downloadError,
  ]);

  const healthStatus = resolveSyncHealthStatus({
    hasSession: Boolean(session),
    connected: status.connected,
    connecting: status.connecting,
    hasSynced: status.hasSynced,
    uploading: Boolean(flow.uploading),
    downloading: Boolean(flow.downloading),
    hasUploadError: Boolean(flow.uploadError),
    hasDownloadError: Boolean(flow.downloadError),
    unresolvedFailures: snapshot?.unresolvedFailures ?? 0,
  });
  const canRetry = Boolean(
    session && (snapshot?.unresolvedFailures || flow.uploadError || flow.downloadError),
  );

  async function retry() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await retrySyncFailures(db, session.user.id);
      await db.connect(getConnector());
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not retry sync.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader className="mb-0">
        <div>
          <CardTitle>Sync health</CardTitle>
          <CardLabel className="mt-1">{STATUS_DESCRIPTIONS[healthStatus]}</CardLabel>
        </div>
        <div className="flex items-center gap-2 font-body text-label text-foreground-muted">
          <StatusIcon status={healthStatus} />
          <span>{session ? STATUS_LABELS[healthStatus] : 'Not signed in'}</span>
        </div>
      </CardHeader>

      {!session ? (
        <CardLabel>Sign in to sync your finances across web and mobile.</CardLabel>
      ) : snapshot ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-surface-muted p-3">
              <CardLabel>Pending writes</CardLabel>
              <p className="mt-1 font-display text-headline-md text-foreground">
                {snapshot.pendingWrites}
              </p>
            </div>
            <div className="rounded-md bg-surface-muted p-3">
              <CardLabel>Failed changes</CardLabel>
              <p className="mt-1 font-display text-headline-md text-foreground">
                {snapshot.unresolvedFailures}
              </p>
            </div>
            <div className="col-span-2 rounded-md bg-surface-muted p-3 sm:col-span-1">
              <CardLabel>Last complete sync</CardLabel>
              <p className="mt-1 font-body text-body-md text-foreground">
                {status.lastSyncedAt ? status.lastSyncedAt.toLocaleString() : 'Not yet'}
              </p>
            </div>
          </div>

          {summaries.length > 0 ? (
            <div className="space-y-2 rounded-md border border-warning/50 bg-warning/10 p-3">
              <p className="font-body text-label font-medium text-foreground">
                Review queued changes
              </p>
              {summaries.map((summary) => (
                <p
                  key={`${summary.failureClass}-${summary.resolutionState}-${summary.safeErrorMessage}`}
                  className="font-body text-caption text-foreground-muted"
                >
                  {failureLabel(summary)}: {summary.safeErrorMessage}
                </p>
              ))}
            </div>
          ) : null}

          {canRetry ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => void retry()}>
              <RefreshCw className={busy ? 'animate-spin' : undefined} />
              {busy ? 'Retrying sync…' : 'Retry sync'}
            </Button>
          ) : null}
        </>
      ) : (
        <CardLabel>Checking sync status…</CardLabel>
      )}

      {error ? <p className="font-body text-caption text-loss">{error}</p> : null}
    </Card>
  );
}
