'use client';

import Link from 'next/link';

import { useAuth } from '@/components/providers';
import { SafeSignOut } from '@/components/safe-sign-out';

/** Header control: the signed-in email + sign out, or a link to the login screen. */
export function AuthStatus() {
  const { session, loading } = useAuth();

  if (loading) return null;

  if (!session) {
    return (
      <Link
        href="/login"
        className="rounded-md px-3 py-1.5 font-body text-label text-foreground transition-colors hover:bg-surface-muted"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[12rem] truncate font-body text-caption text-foreground-muted sm:inline">
        {session.user.email}
      </span>
      <SafeSignOut variant="ghost" size="sm" />
    </div>
  );
}
