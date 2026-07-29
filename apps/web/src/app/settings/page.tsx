'use client';

import { Settings } from 'lucide-react';
import { DeadmanSettingsPanel } from '@/components/settings/deadman-settings';
import { Card, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { DataExportPanel } from '@/components/settings/data-export';

export default function SettingsPage() {
  const { session, signOut } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Settings className="size-5" />
          <h1 className="font-display text-display-sm text-foreground">Settings</h1>
        </div>
        <p className="mt-1 font-body text-body-md text-foreground-muted">
          Account, appearance, sync, and inactivity protection.
        </p>
      </div>
      <Card>
        <CardTitle>Account</CardTitle>
        {session ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="font-body text-body-md">{session.user.email}</span>
            <Button variant="outline" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        ) : (
          <p className="mt-2 font-body text-body-md text-foreground-muted">
            Sign in to manage your account and dead-man switch.
          </p>
        )}
      </Card>
      <DataExportPanel />
      <DeadmanSettingsPanel />
    </div>
  );
}
