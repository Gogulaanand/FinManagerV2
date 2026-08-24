'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { navItems } from '@/lib/nav';
import { cn } from '@/lib/utils';

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop navigation. Hidden below md, where the tab bar takes over. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[5.5rem] shrink-0 self-start overflow-y-auto border-r border-border/70 bg-surface/95 md:flex md:flex-col lg:w-60">
      <div className="flex h-20 items-center justify-center px-3 lg:justify-start lg:px-6">
        <span className="font-display text-xl font-semibold tracking-[-0.04em] text-foreground">
          <span aria-hidden="true" className="lg:hidden">
            F.
          </span>
          <span className="hidden lg:inline">FinManager</span>
        </span>
      </div>

      <nav className="flex flex-col gap-1 px-2 py-2 lg:px-3" aria-label="Main">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'font-utility flex min-h-11 items-center justify-center gap-3 rounded-xl px-3 py-2 text-body-md transition-colors lg:justify-start',
                'outline-none focus-visible:ring-2 focus-visible:ring-focus',
                active
                  ? 'bg-accent/12 font-medium text-primary'
                  : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
              )}
            >
              <Icon className="size-[1.1rem] shrink-0 stroke-[1.6]" aria-hidden="true" />
              <span className="sr-only lg:not-sr-only">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/** Mobile-width navigation. Mirrors the native tab bar so the two platforms agree. */
export function TabBar() {
  const pathname = usePathname();
  const mobileItems = navItems.filter(({ href }) =>
    ['/dashboard', '/expenses', '/portfolio', '/insights', '/settings'].includes(href),
  );

  return (
    <nav
      className="fixed inset-x-2 bottom-2 z-20 flex overflow-hidden rounded-[1.25rem] border border-border/70 bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur-xl md:hidden"
      aria-label="Main"
    >
      {mobileItems.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'font-utility flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[0.67rem] transition-colors',
              active ? 'bg-accent/10 text-primary' : 'text-foreground-muted',
            )}
          >
            <Icon className="size-5 stroke-[1.6]" aria-hidden="true" />
            {href === '/settings' ? 'More' : label}
          </Link>
        );
      })}
    </nav>
  );
}
