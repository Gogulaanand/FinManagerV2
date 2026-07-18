'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { navItems } from '@/lib/nav';
import { cn } from '@/lib/utils';

function isActive(pathname: string, href: string): boolean {
  // '/' is the dashboard and would otherwise prefix-match every route.
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/** Desktop navigation. Hidden below md, where the tab bar takes over. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 self-start overflow-y-auto border-r border-border bg-surface md:flex md:flex-col">
      <div className="flex h-16 items-center px-6">
        <span className="font-display text-headline-md text-foreground">FinManager</span>
      </div>

      <nav className="flex flex-col gap-1 px-3 py-2" aria-label="Main">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 font-body text-body-md transition-colors',
                'outline-none focus-visible:ring-2 focus-visible:ring-focus',
                active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
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

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Main"
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2 font-body text-caption transition-colors',
              active ? 'text-primary' : 'text-foreground-muted',
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
