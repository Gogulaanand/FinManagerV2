import type { Metadata, Viewport } from 'next';
import { Manrope, Public_Sans, Sora } from 'next/font/google';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { ClientProviders } from '@/components/client-providers';
import { themeScript } from '@/components/theme-toggle';

import './globals.css';

// next/font self-hosts these, so there is no render-blocking request to Google
// and no flash of fallback text. The variables are consumed by the @theme font
// tokens in packages/tokens.
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-display-loaded',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-body-loaded',
  display: 'swap',
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-utility-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FinManager',
  description: 'A private, family-scale money OS.',
  applicationName: 'FinManager',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F3EE' },
    { media: '(prefers-color-scheme: dark)', color: '#101714' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: themeScript mutates <html>'s class list before
    // React hydrates, so the client markup legitimately differs from the server's.
    // The font variables live on <html>, not <body>: the theme's --font-display
    // is declared by @theme on :root and resolves var(--font-display-loaded)
    // there, which cannot see a variable defined further down on <body>.
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${sora.variable} ${manrope.variable} ${publicSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <ClientProviders>
          <AppShell>{children}</AppShell>
        </ClientProviders>
      </body>
    </html>
  );
}
