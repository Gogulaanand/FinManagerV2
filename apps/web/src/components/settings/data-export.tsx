'use client';

import { createModuleCsvExports } from '@finmanager/core';
import { createRecoveryExportArtifact, readDataExportCollections } from '@finmanager/sync';
import { usePowerSync } from '@powersync/react';
import { useState } from 'react';

import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardLabel, CardTitle } from '@/components/ui/card';

function download(filename: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DataExportPanel() {
  const db = usePowerSync();
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function collections() {
    if (!session) throw new Error('Sign in before exporting data.');
    return readDataExportCollections(db);
  }

  async function exportJson(acknowledgePendingWrites = false) {
    setBusy(true);
    setNotice(null);
    try {
      if (!session) throw new Error('Sign in before exporting data.');
      const artifact = await createRecoveryExportArtifact(db, {
        userId: session.user.id,
        sourcePlatform: 'web',
        requireComplete: true,
        acknowledgePendingWrites,
      });
      download(
        artifact.filename.replace('recovery', 'backup'),
        artifact.contents,
        artifact.mimeType,
      );
      setNotice('Complete versioned backup created from the local synced database.');
    } catch (error) {
      if (
        !acknowledgePendingWrites &&
        error instanceof Error &&
        error.message.includes('Acknowledge pending writes') &&
        window.confirm(
          'Pending writes are included in this local backup. Acknowledge that they may not be on the server yet?',
        )
      ) {
        await exportJson(true);
        return;
      }
      setNotice(error instanceof Error ? error.message : 'Could not create the backup.');
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setBusy(true);
    setNotice(null);
    try {
      const exports = createModuleCsvExports(await collections());
      const day = new Date().toISOString().slice(0, 10);
      for (const [name, contents] of Object.entries(exports)) {
        download(`finmanager-${day}-${name}`, contents, 'text/csv');
      }
      setNotice('Transaction, holding, and holding-event CSVs created.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create CSV exports.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Backup &amp; export</CardTitle>
      <CardLabel>
        The versioned JSON contains every locally synced entity and can be validated for re-import.
        CSVs provide portable transaction and portfolio ledgers.
      </CardLabel>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!session || busy} onClick={() => void exportJson()}>
          Download full JSON backup
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!session || busy}
          onClick={() => void exportCsv()}
        >
          Download module CSVs
        </Button>
      </div>
      {!session ? (
        <p className="font-body text-caption text-foreground-muted">Sign in to export your data.</p>
      ) : null}
      {notice ? <p className="font-body text-caption text-foreground-muted">{notice}</p> : null}
    </Card>
  );
}
