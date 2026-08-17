import Link from 'next/link';
import type { ReactNode } from 'react';

import { Card, CardLabel, CardTitle } from '@/components/ui/card';

const guideSections = [
  { href: '#at-a-glance', label: 'At a glance' },
  { href: '#storage-and-sync', label: 'Storage and sync' },
  { href: '#ai-insights', label: 'AI Insights' },
  { href: '#account-requests', label: 'Requests and deletion' },
  { href: '#home-screen', label: 'Add to Home Screen' },
] as const;

function GuideSection({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8">
      <p className="font-body text-label font-medium uppercase tracking-[0.14em] text-primary">
        {eyebrow}
      </p>
      <h2 id={`${id}-title`} className="mt-3 font-display text-headline-md text-foreground">
        {title}
      </h2>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function GuideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="space-y-2">
      <CardTitle className="text-title-md">{title}</CardTitle>
      {children}
    </Card>
  );
}

export function PrivacyPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-20" data-reveal>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:items-start">
        <header className="lg:sticky lg:top-8">
          <p className="font-body text-label font-medium uppercase tracking-[0.14em] text-primary">
            FinManager · web-first beta
          </p>
          <h1
            id="privacy-page-title"
            className="mt-4 max-w-xl font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.02] font-extrabold tracking-[-0.04em] text-foreground"
          >
            Privacy &amp; data, in plain language.
          </h1>
          <p className="mt-6 max-w-xl font-body text-body-lg leading-8 text-foreground-muted">
            This guide explains what the current web beta does with your data and what to check
            before clearing browser storage, switching accounts, or asking the owner for help.
          </p>
          <nav className="mt-8" aria-label="Privacy guide sections">
            <p className="font-body text-label font-medium text-foreground">On this page</p>
            <ul className="mt-3 space-y-2 border-l border-border pl-4">
              {guideSections.map((section) => (
                <li key={section.href}>
                  <a
                    href={section.href}
                    className="font-body text-body-md text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <div className="space-y-12">
          <GuideSection
            id="at-a-glance"
            eyebrow="The short version"
            title="A few things to know first"
          >
            <Card className="border-l-4 border-l-primary bg-primary/5 shadow-none ring-0">
              <CardTitle className="text-title-md">
                Your browser is part of the storage picture.
              </CardTitle>
              <p className="mt-2 font-body text-body-md leading-6 text-foreground-muted">
                The web app keeps its local PowerSync database in browser storage. Clearing site
                data can remove local and pending data from that browser profile, so check sync
                health and export a backup first.
              </p>
            </Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <GuideCard title="Local-first, not native encryption">
                <p className="font-body text-body-md leading-6 text-foreground-muted">
                  Web storage uses wa-sqlite backed by IndexedDB. It is not the native mobile
                  SQLCipher database. Use the browser profile and device protections you trust.
                </p>
              </GuideCard>
              <GuideCard title="Export before a risky change">
                <p className="font-body text-body-md leading-6 text-foreground-muted">
                  Before clearing site data, switching accounts, or removing a browser profile,
                  confirm sync is complete and download the full JSON backup in Settings.
                </p>
              </GuideCard>
            </div>
          </GuideSection>

          <GuideSection
            id="storage-and-sync"
            eyebrow="Where data moves"
            title="Storage, sync, and recovery"
          >
            <GuideCard title="Supabase and PowerSync have different jobs">
              <ul className="list-disc space-y-2 pl-5 font-body text-body-md leading-6 text-foreground-muted">
                <li>
                  Supabase provides authentication and the server-side Postgres boundary for the
                  account data.
                </li>
                <li>
                  PowerSync provides the local-first browser database and syncs the signed-in
                  account&apos;s records between the browser and Supabase.
                </li>
                <li>
                  The browser reads and writes through the local PowerSync database; sync health
                  shows pending writes, failed changes, and the last complete sync.
                </li>
              </ul>
            </GuideCard>
            <GuideCard title="A safe clearing or account-switch sequence">
              <ol className="list-decimal space-y-2 pl-5 font-body text-body-md leading-6 text-foreground-muted">
                <li>
                  Open Settings and wait for Sync health to show no pending writes or failures.
                </li>
                <li>Download the full JSON backup from Backup &amp; export.</li>
                <li>Only then clear site data, remove the browser profile, or switch accounts.</li>
              </ol>
              <p className="pt-2 font-body text-caption text-foreground-muted">
                If sync needs attention, stay signed in and retry it or keep the recovery export
                before discarding anything local.
              </p>
            </GuideCard>
          </GuideSection>

          <GuideSection id="ai-insights" eyebrow="Only when you choose it" title="AI Insights">
            <GuideCard title="What an AI request contains">
              <p className="font-body text-body-md leading-6 text-foreground-muted">
                The web app does not call AI just because you use FinManager. When you ask a
                question or request a monthly summary, the selected scope&apos;s derived financial
                digest is sent to the authenticated Supabase Edge Function. Chat also sends your
                question and up to the last ten chat messages; a monthly summary sends no chat
                history. The Edge Function forwards the request to Anthropic and streams back the
                answer.
              </p>
              <p className="font-body text-caption text-foreground-muted">
                The current source does not verify Anthropic&apos;s retention or deletion terms. Do
                not enter information in an AI question that you would not want sent with that
                request.
              </p>
            </GuideCard>
            <GuideCard title="Saved summaries stay in your product data">
              <p className="font-body text-body-md leading-6 text-foreground-muted">
                A generated monthly summary is saved back through the local PowerSync data path. If
                you need a copy before changing browser storage, include it in your full JSON
                backup.
              </p>
            </GuideCard>
          </GuideSection>

          <GuideSection
            id="account-requests"
            eyebrow="Private beta support"
            title="Requests, access, and deletion"
          >
            <GuideCard title="Beta access requests">
              <p className="font-body text-body-md leading-6 text-foreground-muted">
                The landing form accepts an email-only private-beta request. Approval is manual
                through the owner&apos;s Supabase workflow. Unapproved requests are retained for
                review and manually removed after 90 days.
              </p>
            </GuideCard>
            <GuideCard title="Account deletion is owner-assisted">
              <p className="font-body text-body-md leading-6 text-foreground-muted">
                The current web app has no self-service account-deletion control. Use the private
                invitation channel that gave you access to ask the owner for deletion assistance.
                Export first, confirm sync is complete, and identify the exact account in that
                private channel. The owner then follows the approved authenticated deletion path and
                confirms what was completed.
              </p>
              <p className="font-body text-caption text-foreground-muted">
                Signing out, deleting a row, or clearing browser storage is not the same as deleting
                the account and server-side records.
              </p>
            </GuideCard>
          </GuideSection>

          <GuideSection
            id="home-screen"
            eyebrow="A small convenience"
            title="Add the web app to your Home Screen"
          >
            <GuideCard title="Use your browser's shortcut option">
              <ol className="list-decimal space-y-2 pl-5 font-body text-body-md leading-6 text-foreground-muted">
                <li>On iPhone or iPad Safari, open Share and choose Add to Home Screen.</li>
                <li>On Android Chrome, open the menu and choose Add to Home screen or Install.</li>
              </ol>
              <p className="pt-2 font-body text-caption text-foreground-muted">
                Browser labels vary. This creates a convenient shortcut; it does not change web
                storage into native SQLCipher or change what sync and export checks you should do.
              </p>
            </GuideCard>
          </GuideSection>

          <div className="border-t border-border pt-6">
            <CardLabel>
              This page describes the current implementation and beta workflow. It is not a final
              legal-compliance certification or a promise about third-party retention.
            </CardLabel>
            <p className="mt-3 font-body text-body-md text-foreground-muted">
              Return to the{' '}
              <Link href="/" className="text-primary hover:underline">
                FinManager home page
              </Link>{' '}
              or review these controls from{' '}
              <Link href="/settings" className="text-primary hover:underline">
                Settings
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
