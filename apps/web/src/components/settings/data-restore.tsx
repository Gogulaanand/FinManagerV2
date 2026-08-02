'use client';

import { createRestoreReport, type RestoreMode, type RestoreReport } from '@finmanager/core';
import { applyRecoveryRestore, planRecoveryRestore, RestoreBlockedError } from '@finmanager/sync';
import { usePowerSync } from '@powersync/react';
import { useState } from 'react';

import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardLabel, CardTitle } from '@/components/ui/card';
import { getConnector } from '@/lib/powersync';
import { supabase } from '@/lib/supabase';

const MODES: readonly { readonly value: RestoreMode; readonly label: string }[] = [
  { value: 'empty', label: 'Empty account' },
  { value: 'merge', label: 'Merge missing rows' },
  { value: 'replace', label: 'Replace account' },
];

export function DataRestorePanel() {
  const db = usePowerSync();
  const { session } = useAuth();
  const [mode, setMode] = useState<RestoreMode>('empty');
  const [contents, setContents] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [report, setReport] = useState<RestoreReport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setNotice(null);
    setReport(null);
    setFilename(file.name);
    setContents(await file.text());
  }

  async function preview() {
    if (!session || !contents) {
      setNotice('Sign in and choose a JSON backup first.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      setReport(await planRecoveryRestore(db, contents, { userId: session.user.id, mode }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not validate the backup.');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!session || !contents || !report) return;
    if (report.conflicts.some((conflict) => conflict.blocking)) {
      setNotice('Resolve the blocking dry-run conflicts before applying this restore.');
      return;
    }
    const confirmDestructive =
      mode !== 'replace' ||
      window.confirm('Replace mode deletes every existing row in this account. Continue?');
    if (!confirmDestructive) return;
    setBusy(true);
    setNotice(null);
    try {
      const applied = await applyRecoveryRestore(supabase, db, contents, {
        userId: session.user.id,
        mode,
        confirmDestructive,
      });
      setReport(applied);
      await db.disconnect();
      await db.connect(getConnector());
      setNotice(
        'Restore applied in one server transaction. Sync is refreshing the local database.',
      );
    } catch (error) {
      if (error instanceof RestoreBlockedError) {
        setReport(createRestoreReport(error.plan, 'dry-run'));
      }
      setNotice(error instanceof Error ? error.message : 'Restore failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Restore backup</CardTitle>
      <CardLabel>
        Restore is dry-run first. The server applies the validated bundle in dependency order and
        keeps an immutable replay report.
      </CardLabel>
      <input
        type="file"
        accept="application/json,.json"
        aria-label="Choose a versioned JSON backup"
        onChange={(event) => void chooseFile(event.target.files?.[0])}
        className="block w-full rounded-md border border-border bg-background p-2 text-caption"
      />
      {filename ? <CardLabel>Selected: {filename}</CardLabel> : null}
      <label className="flex flex-col gap-1 font-body text-caption text-foreground-muted">
        Restore mode
        <select
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as RestoreMode);
            setReport(null);
          }}
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        >
          {MODES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!session || !contents || busy}
          onClick={() => void preview()}
        >
          {busy ? 'Checking…' : 'Preview restore'}
        </Button>
        <Button
          type="button"
          disabled={!report || report.conflicts.some((conflict) => conflict.blocking) || busy}
          onClick={() => void apply()}
        >
          Apply restore
        </Button>
      </div>
      {report ? (
        <div className="rounded-md border border-border bg-surface-muted p-3 font-body text-caption text-foreground">
          <p>
            {report.dryRun ? 'Dry-run' : 'Applied'} · {report.mode} · {report.operationCount}{' '}
            operations ·{' '}
            {report.totalsMatchSource ? 'financial totals match' : 'financial totals need review'}
          </p>
          {report.conflicts.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {report.conflicts.slice(0, 5).map((conflict, index) => (
                <li key={`${conflict.kind}-${conflict.collection}-${conflict.rowId ?? index}`}>
                  {conflict.detail}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1">No conflicts detected.</p>
          )}
        </div>
      ) : null}
      {notice ? <CardLabel>{notice}</CardLabel> : null}
    </Card>
  );
}
