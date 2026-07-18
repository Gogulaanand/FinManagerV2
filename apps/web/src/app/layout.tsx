import type { Metadata, Viewport } from 'next';
import { Inter, Manrope } from 'next/font/google';
import type { ReactNode } from 'react';

import { AuthStatus } from '@/components/auth-status';
import { AppProviders } from '@/components/providers';
import { Sidebar, TabBar } from '@/components/sidebar';
import { ThemeToggle, themeScript } from '@/components/theme-toggle';

import './globals.css';

// next/font self-hosts these, so there is no render-blocking request to Google
// and no flash of fallback text. The variables are consumed by the @theme font
// tokens in packages/tokens.
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-display-loaded',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FinManager',
  description: 'A private, family-scale money OS.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F7F7' },
    { media: '(prefers-color-scheme: dark)', color: '#0A1211' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: themeScript mutates <html>'s class list before
    // React hydrates, so the client markup legitimately differs from the server's.
    // The font variables live on <html>, not <body>: the theme's --font-display
    // is declared by @theme on :root and resolves var(--font-display-loaded)
    // there, which cannot see a variable defined further down on <body>.
    <html lang="en" className={`${manrope.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <AppProviders>
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
                <div className="mx-auto w-full max-w-5xl">{children}</div>
              </main>
            </div>
          </div>

          <TabBar />
        </AppProviders>
      </body>
    </html>
  );
}
