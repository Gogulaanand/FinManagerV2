'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  PRIVATE_BETA_REQUEST_ERROR,
  PRIVATE_BETA_REQUEST_SUCCESS,
  submitBetaAccessRequest,
} from '@/lib/beta-access';
import { useAuth } from '@/components/providers';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const values = [
  {
    number: '01',
    title: 'See the whole picture',
    body: 'Bring expenses, accounts, investments, tax planning, and goals into one steady view.',
  },
  {
    number: '02',
    title: 'Keep your footing',
    body: 'A private, family-scale money OS with an offline-first foundation and no noisy feed.',
  },
  {
    number: '03',
    title: 'Choose the next move',
    body: 'Use clear totals, thoughtful tax context, and FIRE planning to turn information into action.',
  },
] as const;

function DashboardMockup() {
  return (
    <div
      className="overflow-hidden rounded-lg bg-surface shadow-xl ring-1 ring-border/70"
      aria-label="Illustrative FinManager dashboard"
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface-muted px-4 py-3">
        <span className="size-2 rounded-full bg-loss" />
        <span className="size-2 rounded-full bg-primary/50" />
        <span className="size-2 rounded-full bg-gain" />
        <span className="ml-3 font-body text-caption text-foreground-muted">
          Your money, in context
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[0.9fr_1.6fr] sm:p-6">
        <div className="hidden flex-col gap-2 border-r border-border pr-4 sm:flex">
          <span className="mb-3 font-display text-title-md text-foreground">FinManager</span>
          {['Dashboard', 'Expenses', 'Portfolio', 'Tax', 'Goals'].map((item, index) => (
            <span
              key={item}
              className={`rounded-md px-3 py-2 font-body text-caption ${index === 0 ? 'bg-primary/10 font-medium text-primary' : 'text-foreground-muted'}`}
            >
              {item}
            </span>
          ))}
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <span className="font-body text-caption text-foreground-muted">Good evening</span>
              <p className="font-display text-headline-md text-foreground">Dashboard</p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 font-body text-caption text-primary">
              Illustrative
            </span>
          </div>

          <div className="rounded-lg bg-background p-4 ring-1 ring-border/60">
            <span className="font-body text-caption text-foreground-muted">Total net worth</span>
            <p className="tabular mt-1 font-display text-display-md text-foreground">₹18,42,600</p>
            <span className="font-body text-caption text-foreground-muted">
              Across your accounts and holdings
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-background p-3 ring-1 ring-border/60">
              <span className="font-body text-caption text-foreground-muted">This month spend</span>
              <p className="tabular mt-1 font-display text-headline-md text-foreground">₹62,400</p>
              <span className="font-body text-caption text-gain">↓ 8.4% vs last month</span>
            </div>
            <div className="rounded-lg bg-background p-3 ring-1 ring-border/60">
              <span className="font-body text-caption text-foreground-muted">Invested</span>
              <p className="tabular mt-1 font-display text-headline-md text-foreground">
                ₹11,08,200
              </p>
              <span className="font-body text-caption text-foreground-muted">
                Across 4 holdings
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-background p-4 ring-1 ring-border/60">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-title-md text-foreground">
                Recent transactions
              </span>
              <span className="font-body text-caption text-primary">View all</span>
            </div>
            {[
              ['Salary', '₹1,80,000', 'Today'],
              ['Groceries', '−₹4,280', 'Yesterday'],
              ['Index fund', '₹12,000', '3 days ago'],
            ].map(([label, amount, date]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-t border-border/60 py-2.5 first:border-0"
              >
                <div>
                  <span className="block font-body text-caption text-foreground">{label}</span>
                  <span className="font-body text-caption text-foreground-muted">{date}</span>
                </div>
                <span className="tabular font-display text-title-md text-foreground">{amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type RequestStatus = 'idle' | 'success' | 'error';

export function LandingPage() {
  const { loading: authLoading, session } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const dashboardLink = !authLoading && session ? '/dashboard' : '/login';
  const dashboardLabel = !authLoading && session ? 'Open dashboard' : 'Sign in';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    setStatus('idle');

    const result = await submitBetaAccessRequest(supabase, email);
    if (!result.ok) {
      if (result.reason === 'invalid') {
        setValidationError('Enter a valid email address.');
      } else {
        setStatus('error');
      }
      return;
    }
    setStatus('success');
    setEmail('');
  }

  return (
    <main className="overflow-hidden" data-reveal>
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 md:grid-cols-[0.92fr_1.08fr] md:items-center md:px-8 md:py-24">
        <div className="max-w-xl">
          <p className="font-utility mb-5 text-label font-medium uppercase tracking-[0.14em] text-primary">
            FinManager · private beta
          </p>
          <h1 className="max-w-2xl font-display text-[clamp(2.6rem,7vw,5.4rem)] leading-[0.98] font-semibold tracking-[-0.055em] text-foreground">
            Your family&apos;s money, finally in one calm place.
          </h1>
          <p className="mt-6 max-w-lg font-body text-body-lg leading-8 text-foreground-muted">
            A private, family-scale money OS for the daily picture and the long view: expenses,
            investing, taxes, and goals without the noise.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <a href="#request-access">Request private beta access</a>
            </Button>
            <Link
              className="font-utility text-body-md font-medium text-primary hover:underline"
              href={dashboardLink}
            >
              {dashboardLabel}
            </Link>
          </div>
          <p className="mt-5 max-w-md font-body text-caption text-foreground-muted">
            Built for a small circle first. No billing, paywall, or automated invitation system.
          </p>
        </div>

        <div>
          <div>
            <DashboardMockup />
          </div>
        </div>
      </section>

      <section id="values" className="border-y border-border bg-surface-muted/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-3 md:px-8 md:py-20">
          {values.map((value) => (
            <article key={value.number} className="max-w-sm border-t border-border pt-5">
              <span className="font-utility text-caption font-medium text-primary">
                {value.number}
              </span>
              <h2 className="mt-8 font-display text-headline-md text-foreground">{value.title}</h2>
              <p className="mt-3 font-body text-body-md leading-6 text-foreground-muted">
                {value.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section aria-label="Product principles" className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-center font-body text-label text-foreground-muted md:justify-between">
          <span>Private by design</span>
          <span aria-hidden="true" className="hidden text-primary md:inline">
            ✦
          </span>
          <span>Offline-first foundation</span>
          <span aria-hidden="true" className="hidden text-primary md:inline">
            ✦
          </span>
          <span>Family-scale by default</span>
        </div>
      </section>

      <section
        id="how-it-works"
        className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[0.7fr_1.3fr] md:px-8 md:py-24"
      >
        <div>
          <p className="font-body text-label font-medium uppercase tracking-[0.14em] text-primary">
            A quiet start
          </p>
          <h2 className="mt-4 font-display text-display-md tracking-[-0.03em] text-foreground">
            Make it yours in three steps.
          </h2>
        </div>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            ['01', 'Request access', 'Share an email so the owner can review the small beta list.'],
            ['02', 'Get approved', 'Approved people can use the full current product.'],
            ['03', 'Sign in', 'Start with your own accounts, goals, and money picture.'],
          ].map(([number, title, body]) => (
            <li key={number} className="rounded-lg bg-surface p-5 ring-1 ring-border/60">
              <span className="font-body text-caption font-medium text-primary">{number}</span>
              <h3 className="mt-8 font-display text-headline-md text-foreground">{title}</h3>
              <p className="mt-2 font-body text-body-md leading-6 text-foreground-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="request-access"
        className="border-t border-border bg-foreground px-4 py-16 text-background md:px-8 md:py-24"
      >
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_0.8fr] md:items-end">
          <div>
            <p className="font-utility text-label font-medium uppercase tracking-[0.14em] text-background/70">
              Private beta access
            </p>
            <h2 className="mt-4 max-w-2xl font-display text-display-md tracking-[-0.03em]">
              Bring a little more calm to the money conversation.
            </h2>
            <p className="mt-4 max-w-xl font-body text-body-md leading-6 text-background/80">
              Leave an email-only request. We will review it manually while this beta stays small.
            </p>
          </div>

          <form
            className="rounded-lg bg-surface p-5 text-foreground shadow-lg md:p-6"
            onSubmit={handleSubmit}
            noValidate
          >
            <label
              htmlFor="beta-email"
              className="font-body text-label font-medium text-foreground"
            >
              Email address
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Input
                id="beta-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                placeholder="you@example.com"
                aria-invalid={validationError ? true : undefined}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Button type="submit" className="shrink-0" disabled={!email.trim()}>
                Request access
              </Button>
            </div>
            <p className="mt-3 font-body text-caption text-foreground-muted">
              We keep requests only for private-beta review and manually remove unapproved requests
              older than 90 days.
            </p>
            {validationError && (
              <p className="mt-3 font-body text-caption text-loss" role="alert">
                {validationError}
              </p>
            )}
            {status === 'success' && (
              <p className="mt-3 font-body text-caption text-gain" role="status">
                {PRIVATE_BETA_REQUEST_SUCCESS}
              </p>
            )}
            {status === 'error' && (
              <p className="mt-3 font-body text-caption text-loss" role="alert">
                {PRIVATE_BETA_REQUEST_ERROR}
              </p>
            )}
          </form>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 font-body text-caption text-foreground-muted sm:flex-row sm:items-center sm:justify-between md:px-8">
        <span>FinManager · a calmer money picture</span>
        <div className="flex items-center gap-5">
          <a href="#values" className="hover:text-foreground">
            Values
          </a>
          <a href="#how-it-works" className="hover:text-foreground">
            How it works
          </a>
          <Link href={dashboardLink} className="hover:text-foreground">
            {dashboardLabel}
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy &amp; data
          </Link>
        </div>
      </footer>
    </main>
  );
}
