import {
  getSyncFailureSummaries,
  getSyncHealthSnapshot,
  resolveSyncHealthStatus,
  retrySyncFailures,
  type SyncFailureSummary,
  type SyncHealthSnapshot,
  type SyncHealthStatus,
} from '@finmanager/sync';
import { Ionicons } from '@expo/vector-icons';
import { color } from '@finmanager/tokens';
import { usePowerSync, useStatus } from '@powersync/react';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';

import { getConnector } from '../../lib/powersync';
import { useAuth } from '../providers';
import { Card, CardLabel, CardTitle } from '../card';

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

const STATUS_ICONS: Record<SyncHealthStatus, keyof typeof Ionicons.glyphMap> = {
  synced: 'checkmark-circle',
  syncing: 'sync',
  offline: 'cloud-offline',
  'action-required': 'warning',
};

function failureLabel(summary: SyncFailureSummary): string {
  return `${summary.count} ${summary.failureClass} change${summary.count === 1 ? '' : 's'}`;
}

export function MobileSyncHealth() {
  const db = usePowerSync();
  const status = useStatus();
  const { session } = useAuth();
  const { colorScheme } = useColorScheme();
  const scheme = color[colorScheme === 'dark' ? 'dark' : 'light'];
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
    const timer = setInterval(() => void load(), 3_000);
    return () => {
      active = false;
      clearInterval(timer);
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
    <Card className="gap-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <CardTitle>Sync health</CardTitle>
          <CardLabel>{STATUS_DESCRIPTIONS[healthStatus]}</CardLabel>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons
            name={STATUS_ICONS[healthStatus]}
            size={18}
            color={
              healthStatus === 'action-required'
                ? scheme.loss
                : healthStatus === 'synced'
                  ? scheme.gain
                  : scheme.foregroundMuted
            }
          />
          <Text className="font-body text-label text-foreground-muted">
            {session ? STATUS_LABELS[healthStatus] : 'Not signed in'}
          </Text>
        </View>
      </View>

      {!session ? (
        <CardLabel>Sign in to sync your finances across web and mobile.</CardLabel>
      ) : snapshot ? (
        <>
          <View className="flex-row gap-2">
            <View className="flex-1 rounded-md bg-surface-muted p-3">
              <CardLabel>Pending writes</CardLabel>
              <Text className="mt-1 font-display text-headline-md text-foreground">
                {snapshot.pendingWrites}
              </Text>
            </View>
            <View className="flex-1 rounded-md bg-surface-muted p-3">
              <CardLabel>Failed changes</CardLabel>
              <Text className="mt-1 font-display text-headline-md text-foreground">
                {snapshot.unresolvedFailures}
              </Text>
            </View>
          </View>
          <View className="rounded-md bg-surface-muted p-3">
            <CardLabel>Last complete sync</CardLabel>
            <Text className="mt-1 font-body text-body-md text-foreground">
              {status.lastSyncedAt ? status.lastSyncedAt.toLocaleString() : 'Not yet'}
            </Text>
          </View>

          {summaries.length > 0 ? (
            <View className="gap-2 rounded-md border border-warning/50 bg-warning/10 p-3">
              <Text className="font-body text-label font-medium text-foreground">
                Review queued changes
              </Text>
              {summaries.map((summary) => (
                <Text
                  key={`${summary.failureClass}-${summary.resolutionState}-${summary.safeErrorMessage}`}
                  className="font-body text-caption text-foreground-muted"
                >
                  {failureLabel(summary)}: {summary.safeErrorMessage}
                </Text>
              ))}
            </View>
          ) : null}

          {canRetry ? (
            <Pressable
              onPress={() => void retry()}
              disabled={busy}
              accessibilityRole="button"
              className="h-11 flex-row items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 disabled:opacity-50"
            >
              <Ionicons name="refresh" size={17} color={scheme.foreground} />
              <Text className="font-body text-body-md text-foreground">
                {busy ? 'Retrying sync…' : 'Retry sync'}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <CardLabel>Checking sync status…</CardLabel>
      )}

      {error ? <Text className="font-body text-caption text-loss">{error}</Text> : null}
    </Card>
  );
}
