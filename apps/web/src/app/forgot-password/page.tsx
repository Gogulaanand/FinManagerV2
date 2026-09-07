'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: failure } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (failure) throw failure;
      setNotice(
        'If this address has an eligible account, you will receive a password reset link. Open it in this browser.',
      );
    } catch {
      setError('Could not request a reset link. Please wait and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 py-8">
      <h1 className="font-display text-display-md">Reset your password</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label>
          Email
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={busy || !email.trim()}>
          {busy ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <Link href="/login">Back to sign in</Link>
    </main>
  );
}
