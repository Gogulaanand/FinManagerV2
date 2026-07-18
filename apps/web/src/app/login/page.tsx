'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const { session, loading, signInWithPassword, signUpWithPassword, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A signed-in user has no business here; the auth listener redirects them home.
  useEffect(() => {
    if (!loading && session) router.replace('/');
  }, [loading, session, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const submit = mode === 'signin' ? signInWithPassword : signUpWithPassword;
    const message = await submit(email.trim(), password);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    if (mode === 'signup') {
      // With email confirmation on there is no session yet; with it off, the auth
      // listener already has a session and the effect above redirects home.
      setNotice('Account created. If email confirmation is enabled, check your inbox to finish.');
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-8">
      <div>
        <h1 className="font-display text-display-md text-foreground">
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="font-body text-body-md text-foreground-muted">
          Your finances stay private and on your device. Sign in to sync across web and mobile.
        </p>
      </div>

      <Card className="flex flex-col gap-5">
        <CardTitle>{mode === 'signin' ? 'Sign in' : 'Sign up'}</CardTitle>

        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1.5">
            <span className="font-body text-label font-medium text-foreground">Email</span>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              placeholder="you@example.com"
              onChange={(e) => {
                setEmail(e.target.value);
              }}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-body text-label font-medium text-foreground">Password</span>
            <Input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              placeholder="At least 6 characters"
              onChange={(e) => {
                setPassword(e.target.value);
              }}
            />
          </label>

          {error && (
            <p role="alert" className="font-body text-caption text-loss">
              {error}
            </p>
          )}
          {notice && <p className="font-body text-caption text-foreground-muted">{notice}</p>}

          <Button type="submit" disabled={busy || !email.trim() || password.length < 6}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="font-body text-caption text-foreground-muted">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="outline"
          onClick={() => {
            void signInWithGoogle();
          }}
        >
          Continue with Google
        </Button>
      </Card>

      <p className="text-center font-body text-caption text-foreground-muted">
        {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setNotice(null);
          }}
        >
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </div>
  );
}
