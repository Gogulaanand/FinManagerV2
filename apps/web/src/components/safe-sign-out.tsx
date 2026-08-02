'use client';

import { createRecoveryExportArtifact, type FinalSyncResult } from '@finmanager/sync';
import { usePowerSync } from '@powersync/react';
import { useState, type ReactNode } from 'react';

import { useAuth } from '@/components/providers';
import { Button, type ButtonProps } from '@/components/ui/button';

type SafeSignOutProps = Pick<ButtonProps, 'variant' | 'size' | 'className'> & {
  readonly children?: ReactNode;
};

function download(filename: string, contents: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SafeSignOut({ children = 'Sign out', ...buttonProps }: SafeSignOutProps) {
  const db = usePowerSync();
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
      const artifact = await createRecoveryExportArtifact(db);
      download(artifact.filename, artifact.contents, artifact.mimeType);
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
    <>
      <Button {...buttonProps} disabled={busy} onClick={() => void attemptSignOut()}>
        {busy ? 'Checking sync…' : children}
      </Button>
      {result ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="safe-sign-out-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4"
        >
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-5 shadow-xl">
            <div className="space-y-1">
              <h2
                id="safe-sign-out-title"
                className="font-display text-headline-sm text-foreground"
              >
                Unsynced work is still on this device
              </h2>
              <p className="font-body text-body-md text-foreground-muted">
                {result.snapshot.pendingWrites} queued write(s) and{' '}
                {result.snapshot.unresolvedFailures} unresolved sync failure(s) remain. Stay signed
                in to retry, or export a recovery file before discarding local-only changes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={busy} onClick={() => void attemptSignOut()}>
                Retry final sync
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => void exportRecovery()}>
                {recoveryExported ? 'Recovery downloaded' : 'Download recovery'}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={closeWarning}>
                Stay signed in
              </Button>
            </div>
            <label className="flex items-start gap-2 font-body text-caption text-foreground-muted">
              <input
                type="checkbox"
                checked={discardAcknowledged}
                onChange={(event) => setDiscardAcknowledged(event.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              I understand that signing out now permanently removes local-only changes from this
              device.
            </label>
            <Button
              variant="outline"
              disabled={busy || !recoveryExported || !discardAcknowledged}
              onClick={() => void discardAndSignOut()}
            >
              Discard local-only changes and sign out
            </Button>
            {error ? <p className="font-body text-caption text-loss">{error}</p> : null}
          </div>
        </div>
      ) : error ? (
        <span role="alert" className="font-body text-caption text-loss">
          {error}
        </span>
      ) : null}
    </>
  );
}
