'use client';

import { Landmark, Settings, Target } from 'lucide-react';
import Link from 'next/link';

import { DeadmanSettingsPanel } from '@/components/settings/deadman-settings';
import { Card, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers';
import { DataExportPanel } from '@/components/settings/data-export';
import { DataRestorePanel } from '@/components/settings/data-restore';
import { SafeSignOut } from '@/components/safe-sign-out';
import { SyncHealthPanel } from '@/components/sync-health';
import { ThemeToggle } from '@/components/theme-toggle';

export default function SettingsPage() {
  const { session } = useAuth();
  return (
    <div className="page-stack">
      <div>
        <div className="flex items-center gap-2">
          <Settings className="size-5" />
          <div>
            <p className="font-utility text-label uppercase tracking-[0.14em] text-foreground-muted">
              Account &amp; controls
            </p>
            <h1 className="page-heading mt-1 font-display text-display-md text-foreground">
              Settings
            </h1>
          </div>
        </div>
        <p className="mt-1 font-body text-body-md text-foreground-muted">
          Account, appearance, sync, and inactivity protection.
        </p>
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Appearance</CardTitle>
            <p className="mt-1 font-body text-body-md text-foreground-muted">
              Use a light, dark, or device-matched workspace.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </Card>
      <Card>
        <CardTitle>Planning</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            href="/goals"
            className="font-utility flex items-center gap-3 rounded-xl border border-border p-3 text-foreground hover:bg-surface-muted"
          >
            <Target className="size-4 text-primary" aria-hidden="true" /> Goals &amp; FIRE
          </Link>
          <Link
            href="/tax"
            className="font-utility flex items-center gap-3 rounded-xl border border-border p-3 text-foreground hover:bg-surface-muted"
          >
            <Landmark className="size-4 text-primary" aria-hidden="true" /> Tax scenarios
          </Link>
        </div>
      </Card>
      <Card>
        <CardTitle>Account</CardTitle>
        {session ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="font-body text-body-md">{session.user.email}</span>
            <SafeSignOut variant="outline" />
          </div>
        ) : (
          <p className="mt-2 font-body text-body-md text-foreground-muted">
            Sign in to manage your account and dead-man switch.
          </p>
        )}
      </Card>
      <Card>
        <CardTitle>Privacy &amp; data</CardTitle>
        <p className="mt-2 max-w-2xl font-body text-body-md text-foreground-muted">
          Learn how browser storage, sync, exports, AI Insights, and private-beta requests work.
        </p>
        <Link
          href="/privacy"
          className="mt-4 inline-flex font-body text-body-md font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Read the privacy &amp; data guide
          <span aria-hidden="true" className="ml-1">
            →
          </span>
        </Link>
      </Card>
      <SyncHealthPanel />
      <DataExportPanel />
      <DataRestorePanel />
      <DeadmanSettingsPanel />
    </div>
  );
}
