import { createModuleCsvExports } from '@finmanager/core';
import { createRecoveryExportArtifact, readDataExportCollections } from '@finmanager/sync';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { getPowerSync } from '../../lib/powersync';
import { useAuth } from '../providers';
import { Card, CardLabel, CardTitle } from '../card';

async function shareFile(filename: string, content: string, mimeType: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('Sharing is unavailable on this device.');
  const file = new File(Paths.cache, filename);
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: `Share ${filename}` });
}

function confirmPendingWrites(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Pending writes',
      'Pending writes are included in this local backup. Acknowledge that they may not be on the server yet?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Acknowledge', onPress: () => resolve(true) },
      ],
    );
  });
}

export function MobileDataExport() {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(mode: 'json' | 'csv') {
    setBusy(true);
    setMessage(null);
    try {
      const collections = await readDataExportCollections(getPowerSync());
      if (mode === 'json') {
        if (!session) throw new Error('Sign in before exporting data.');
        let artifact;
        try {
          artifact = await createRecoveryExportArtifact(getPowerSync(), {
            userId: session.user.id,
            sourcePlatform: 'mobile',
            requireComplete: true,
          });
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !error.message.includes('Acknowledge pending writes') ||
            !(await confirmPendingWrites())
          ) {
            throw error;
          }
          artifact = await createRecoveryExportArtifact(getPowerSync(), {
            userId: session.user.id,
            sourcePlatform: 'mobile',
            requireComplete: true,
            acknowledgePendingWrites: true,
          });
        }
        await shareFile(
          artifact.filename.replace('recovery', 'backup'),
          artifact.contents,
          artifact.mimeType,
        );
      } else {
        const exports = createModuleCsvExports(collections);
        for (const [filename, content] of Object.entries(exports)) {
          await shareFile(filename, content, 'text/csv');
        }
      }
      setMessage('Export ready.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-3">
      <CardTitle>Data export</CardTitle>
      <CardLabel>
        Create a versioned JSON backup or share CSV files for transactions and holdings.
      </CardLabel>
      <View className="gap-2">
        <Pressable
          onPress={() => void run('json')}
          disabled={busy}
          accessibilityRole="button"
          className="h-11 justify-center rounded-md bg-primary px-4"
        >
          <Text className="text-center font-body text-body-md text-primary-foreground">
            Export full backup
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void run('csv')}
          disabled={busy}
          accessibilityRole="button"
          className="h-11 justify-center rounded-md bg-surface-muted px-4"
        >
          <Text className="text-center font-body text-body-md text-foreground">
            Share module CSVs
          </Text>
        </Pressable>
      </View>
      {message ? <CardLabel>{message}</CardLabel> : null}
    </Card>
  );
}
