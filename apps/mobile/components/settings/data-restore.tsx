import { createRestoreReport, type RestoreMode, type RestoreReport } from '@finmanager/core';
import { applyRecoveryRestore, planRecoveryRestore, RestoreBlockedError } from '@finmanager/sync';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { getPowerSync, getConnector } from '../../lib/powersync';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../providers';
import { Card, CardLabel, CardTitle } from '../card';

const MODES: readonly { readonly value: RestoreMode; readonly label: string }[] = [
  { value: 'empty', label: 'Empty account' },
  { value: 'merge', label: 'Merge missing rows' },
  { value: 'replace', label: 'Replace account' },
];

function confirmReplace(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Replace account?',
      'This deletes every existing row before restoring the backup.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Replace', style: 'destructive', onPress: () => resolve(true) },
      ],
    );
  });
}

export function MobileDataRestore() {
  const { session } = useAuth();
  const [mode, setMode] = useState<RestoreMode>('empty');
  const [contents, setContents] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [report, setReport] = useState<RestoreReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function chooseBackup() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/json'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setFilename(asset.name);
    setContents(await new File(asset.uri).text());
    setReport(null);
    setMessage('Backup selected. Preview it before applying.');
  }

  async function preview() {
    if (!session || !contents) {
      setMessage('Sign in and choose a JSON backup first.');
      return;
    }
    setBusy(true);
    try {
      setReport(
        await planRecoveryRestore(getPowerSync(), contents, { userId: session.user.id, mode }),
      );
      setMessage('Dry-run complete. Review conflicts before applying.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not validate the backup.');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!session || !contents || !report) return;
    if (report.conflicts.some((conflict) => conflict.blocking)) {
      setMessage('Resolve the blocking dry-run conflicts before applying this restore.');
      return;
    }
    const confirmed = mode === 'replace' ? await confirmReplace() : true;
    if (!confirmed) return;
    setBusy(true);
    try {
      const applied = await applyRecoveryRestore(supabase, getPowerSync(), contents, {
        userId: session.user.id,
        mode,
        confirmDestructive: confirmed,
      });
      setReport(applied);
      const db = getPowerSync();
      await db.disconnect();
      await db.connect(getConnector());
      setMessage('Restore applied in one server transaction. Sync is refreshing this device.');
    } catch (error) {
      if (error instanceof RestoreBlockedError)
        setReport(createRestoreReport(error.plan, 'dry-run'));
      setMessage(error instanceof Error ? error.message : 'Restore failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-3">
      <CardTitle>Restore backup</CardTitle>
      <CardLabel>
        Choose a versioned JSON backup, preview conflicts, then apply it atomically.
      </CardLabel>
      <Pressable
        onPress={() => void chooseBackup()}
        disabled={busy}
        accessibilityRole="button"
        className="h-11 justify-center rounded-md bg-surface-muted px-4"
      >
        <Text className="text-center font-body text-body-md text-foreground">
          Choose JSON backup
        </Text>
      </Pressable>
      {filename ? <CardLabel>Selected: {filename}</CardLabel> : null}
      <View className="gap-2">
        {MODES.map((option) => {
          const selected = mode === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                setMode(option.value);
                setReport(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`rounded-md px-3 py-2 ${selected ? 'bg-primary' : 'bg-surface-muted'}`}
            >
              <Text className={selected ? 'text-primary-foreground' : 'text-foreground'}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="gap-2">
        <Pressable
          onPress={() => void preview()}
          disabled={!contents || !session || busy}
          accessibilityRole="button"
          className="h-11 justify-center rounded-md bg-surface-muted px-4"
        >
          <Text className="text-center font-body text-body-md text-foreground">
            Preview restore
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void apply()}
          disabled={!report || report.conflicts.some((conflict) => conflict.blocking) || busy}
          accessibilityRole="button"
          className="h-11 justify-center rounded-md bg-primary px-4"
        >
          <Text className="text-center font-body text-body-md text-primary-foreground">
            Apply restore
          </Text>
        </Pressable>
      </View>
      {report ? (
        <CardLabel>
          {report.dryRun ? 'Dry-run' : 'Applied'} · {report.operationCount} operations ·{' '}
          {report.totalsMatchSource ? 'financial totals match' : 'financial totals need review'}
          {report.conflicts.length > 0
            ? ` · ${report.conflicts.length} conflict(s), including ${report.conflicts[0]?.detail ?? 'review required'}`
            : ' · no conflicts'}
        </CardLabel>
      ) : null}
      {message ? <CardLabel>{message}</CardLabel> : null}
    </Card>
  );
}
