'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { AuthStatus } from '@/components/auth-status';
import { useAuth } from '@/components/providers';
import { Sidebar, TabBar } from '@/components/sidebar';
import { SyncStatusBanner } from '@/components/sync-data-boundary';
import { ThemeToggle } from '@/components/theme-toggle';

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center gap-4 border-b border-border bg-surface px-4 md:px-8">
        <span className="font-display text-headline-md text-foreground">FinManager</span>
        <div className="ml-auto flex items-center gap-2">
          <AuthStatus />
          <ThemeToggle />
        </div>
      </header>
      <div>{children}</div>
    </div>
  );
}

function ProductShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-4 md:px-6">
          <span className="font-display text-headline-md text-foreground md:hidden">
            FinManager
          </span>
          <div className="ml-auto flex items-center gap-2">
            <AuthStatus />
            <ThemeToggle />
          </div>
        </header>

        {/* pb-20 clears the fixed tab bar, which only exists below md. */}
        <main className="flex-1 px-4 py-6 pb-20 md:px-6 md:pb-6">
          <div className="mx-auto w-full max-w-5xl">
            <SyncStatusBanner />
            {children}
          </div>
        </main>
      </div>

      <TabBar />
    </div>
  );
}

function RedirectingShell() {
  return (
    <PublicShell>
      <div className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4 py-12">
        <p className="font-body text-body-md text-foreground-muted" role="status">
          Redirecting to sign in…
        </p>
      </div>
    </PublicShell>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading } = useAuth();
  const isLandingRoute = pathname === '/';
  const isPublicRoute = isLandingRoute || pathname === '/login' || pathname === '/privacy';

  useEffect(() => {
    if (!loading && !session && !isPublicRoute) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isPublicRoute, loading, pathname, router, session]);

  if (!isPublicRoute && !session) return <RedirectingShell />;
  if (isLandingRoute) return <>{children}</>;
  if (pathname === '/privacy') return <PublicShell>{children}</PublicShell>;
  return session ? <ProductShell>{children}</ProductShell> : <PublicShell>{children}</PublicShell>;
}
