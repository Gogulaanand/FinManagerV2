import { createRecoveryExportArtifact, type FinalSyncResult } from '@finmanager/sync';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { getPowerSync } from '../lib/powersync';
import { useAuth } from './providers';
import { CardLabel } from './card';

async function shareRecovery(): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is unavailable on this device.');
  }
  const artifact = await createRecoveryExportArtifact(getPowerSync());
  const file = new File(Paths.cache, artifact.filename);
  file.write(artifact.contents);
  await Sharing.shareAsync(file.uri, {
    mimeType: artifact.mimeType,
    dialogTitle: 'Save FinManager recovery file',
  });
}

export function MobileSafeSignOut() {
  const { signOut, forceSignOut } = useAuth();
  const [result, setResult] = useState<FinalSyncResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryExported, setRecoveryExported] = useState(false);
  const [discardAcknowledged, setDiscardAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attemptSignOut() {
    setBusy(true);
    setError(null);
    setRecoveryExported(false);
    setDiscardAcknowledged(false);
    try {
      const nextResult = await signOut();
      setResult(nextResult.status === 'requires-confirmation' ? nextResult : null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }

  async function exportRecovery() {
    setBusy(true);
    setError(null);
    try {
      await shareRecovery();
      setRecoveryExported(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the recovery export.');
    } finally {
      setBusy(false);
    }
  }

  async function discardAndSignOut() {
    setBusy(true);
    setError(null);
    try {
      await forceSignOut({ recoveryExported, discardAcknowledged });
      setResult(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }

  function closeWarning() {
    setResult(null);
    setRecoveryExported(false);
    setDiscardAcknowledged(false);
    setError(null);
  }

  return (
    <View className="gap-3">
      <Pressable
        onPress={() => void attemptSignOut()}
        disabled={busy}
        accessibilityRole="button"
        className="h-11 justify-center rounded-md bg-surface-muted px-4"
      >
        <Text className="text-center font-body text-body-md text-foreground">
          {busy ? 'Checking sync…' : 'Sign out'}
        </Text>
      </Pressable>

      {result ? (
        <View accessibilityRole="alert" className="gap-3 rounded-md border border-warning p-3">
          <Text className="font-body text-body-md font-medium text-foreground">
            Unsynced work is still on this device
          </Text>
          <CardLabel>
            {result.snapshot.pendingWrites} queued write(s) and {result.snapshot.unresolvedFailures}{' '}
            unresolved sync failure(s) remain. Retry, or save a recovery file before discarding
            local-only changes.
          </CardLabel>
          <View className="gap-2">
            <Pressable
              onPress={() => void attemptSignOut()}
              disabled={busy}
              accessibilityRole="button"
              className="h-11 justify-center rounded-md bg-primary px-4"
            >
              <Text className="text-center font-body text-body-md text-primary-foreground">
                Retry final sync
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void exportRecovery()}
              disabled={busy}
              accessibilityRole="button"
              className="h-11 justify-center rounded-md bg-surface-muted px-4"
            >
              <Text className="text-center font-body text-body-md text-foreground">
                {recoveryExported ? 'Recovery saved' : 'Save recovery file'}
              </Text>
            </Pressable>
            <Pressable
              onPress={closeWarning}
              disabled={busy}
              accessibilityRole="button"
              className="h-11 justify-center rounded-md px-4"
            >
              <Text className="text-center font-body text-body-md text-foreground-muted">
                Stay signed in
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => setDiscardAcknowledged((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: discardAcknowledged }}
            className="flex-row items-start gap-2"
          >
            <Text className="font-body text-body-md text-foreground">
              {discardAcknowledged ? '☑' : '☐'}
            </Text>
            <CardLabel>
              I understand that signing out now permanently removes local-only changes from this
              device.
            </CardLabel>
          </Pressable>
          <Pressable
            onPress={() => void discardAndSignOut()}
            disabled={busy || !recoveryExported || !discardAcknowledged}
            accessibilityRole="button"
            className="h-11 justify-center rounded-md border border-loss px-4 disabled:opacity-50"
          >
            <Text className="text-center font-body text-body-md text-loss">
              Discard local-only changes and sign out
            </Text>
          </Pressable>
        </View>
      ) : null}
      {error ? <Text className="font-body text-caption text-loss">{error}</Text> : null}
    </View>
  );
}
