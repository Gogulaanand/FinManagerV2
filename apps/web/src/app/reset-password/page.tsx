'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const { session, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: failure } = await supabase.auth.updateUser({ password });
      if (failure) throw failure;
      setPassword('');
      setConfirmation('');
      setDone(true);
    } catch {
      setError(
        'Could not update the password. The link may have expired, or the password may not meet account requirements. Request a fresh link and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="p-8" role="status">
        Checking reset link…
      </main>
    );
  if (!session)
    return (
      <main className="p-8">
        <p>This reset link is missing, expired or already used.</p>
        <Link href="/forgot-password">Request a new reset link</Link>
      </main>
    );
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 py-8">
      <h1 className="font-display text-display-md">Choose a new password</h1>
      {done ? (
        <>
          <p role="status">Password updated.</p>
          <Link href="/dashboard">Continue to your dashboard</Link>
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label>
            New password
            <Input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label>
            Confirm password
            <Input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy || password.length < 8 || !confirmation}>
            {busy ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
