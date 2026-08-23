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

import { FlowDiagram } from './landing/flow-diagram';
import styles from './landing/landing-page.module.css';

type RequestStatus = 'idle' | 'success' | 'error';

const currents = [
  {
    number: '01',
    name: 'Spend',
    title: 'Know what leaves.',
    body: 'Bring daily expenses and household cash flow into one view that stays useful after the month ends.',
    dot: styles.panelDotSpend,
  },
  {
    number: '02',
    name: 'Protect',
    title: 'Keep your footing.',
    body: 'Make room for tax context, buffers, and the decisions that keep a family plan steady.',
    dot: styles.panelDotProtect,
  },
  {
    number: '03',
    name: 'Grow',
    title: 'Choose the long view.',
    body: 'Track holdings and FIRE goals together, so a good month becomes a more deliberate future.',
    dot: styles.panelDotGrow,
  },
] as const;

const steps = [
  ['01', 'Request access', 'Share an email so the owner can review the small beta list.'],
  ['02', 'Get approved', 'Approved people can use the full current product.'],
  ['03', 'Sign in', 'Start with your own accounts, goals, and money picture.'],
] as const;

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
    <main className={styles.page} data-reveal>
      <section className={styles.flowSection} aria-labelledby="braided-horizons-title">
        <div className={styles.flowInner}>
          <span className={styles.editorialMark} aria-hidden="true">
            flow.inception.01
          </span>
          <header className={styles.flowHeader}>
            <p className={styles.kicker}>FinManager · private beta</p>
            <h1
              id="braided-horizons-title"
              className={styles.heroTitle}
              aria-label="Your family's money, finally in one calm place."
            >
              <span aria-hidden="true">Braided Horizons</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Watch the currents of your household wealth weave together into a single destination.
            </p>
            <p className={styles.heroSubtext}>
              A private, family-scale money OS for expenses, investing, taxes, and goals without the
              noise.
            </p>
          </header>

          <FlowDiagram />

          <nav className={styles.discoveryBar} aria-label="Landing page sections">
            <a href="#values">The three currents</a>
            <a href="#how-it-works">How it works</a>
            <a href="#request-access">Request private beta access</a>
            <Link className={styles.dashboardLink} href={dashboardLink}>
              {dashboardLabel}
            </Link>
          </nav>
        </div>
      </section>

      <section id="values" className={styles.currentsSection} aria-labelledby="currents-title">
        <div className={styles.currentsInner}>
          <div className={styles.currentsHeader}>
            <div>
              <p className={styles.kicker}>The household picture</p>
              <h2 id="currents-title" className={styles.sectionTitle}>
                Three currents. One calmer read.
              </h2>
            </div>
            <p className={styles.sectionLead}>
              FinManager keeps the daily picture and the long view in conversation, without asking
              you to become a spreadsheet.
            </p>
          </div>

          <div className={styles.currentGrid}>
            {currents.map((current) => (
              <article key={current.number} className={styles.currentPanel}>
                <div className={styles.currentPanelTop}>
                  <span className={styles.currentPanelIndex}>
                    {current.number} / {current.name}
                  </span>
                  <span className={`${styles.panelDot} ${current.dot}`} aria-hidden="true" />
                </div>
                <h3>{current.title}</h3>
                <p>{current.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.howSection} aria-labelledby="how-title">
        <div className={styles.howInner}>
          <div className={styles.howHeader}>
            <div>
              <p className={styles.kicker}>A quiet start</p>
              <h2 id="how-title" className={styles.sectionTitle}>
                Make it yours in three steps.
              </h2>
            </div>
            <p className={styles.howHint}>
              Built for a small circle first. No billing, paywall, or automated invitation system.
            </p>
          </div>

          <ol className={styles.steps}>
            {steps.map(([number, title, body]) => (
              <li key={number} className={styles.step}>
                <span className={styles.stepNumber}>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="request-access"
        className={styles.convergenceSection}
        aria-labelledby="request-access-title"
      >
        <div className={styles.convergenceInner}>
          <div className={styles.convergenceHero}>
            <p className={styles.convergenceEyebrow}>deep current · investments</p>
            <p className={styles.convergenceValue}>₹11,08,200</p>
            <p className={styles.convergenceDescription}>
              Compounding beneath the surface, untouched by daily weather.
            </p>
          </div>

          <div className={styles.convergenceGrid}>
            <div>
              <p className={styles.horizonValue}>
                <span>horizon target · illustrative</span>
                FIRE 2035
              </p>
              <p className={styles.horizonValue}>
                <span>elevation total · illustrative</span>
                ₹18,42,600
              </p>
            </div>

            <div className={styles.requestCard}>
              <p className={styles.convergenceEyebrow}>beta_access_portal</p>
              <h2 id="request-access-title">Bring a little more calm to the money conversation.</h2>
              <p>
                Leave an email-only request. We will review it manually while this beta stays small.
              </p>

              <form className={styles.requestForm} onSubmit={handleSubmit} noValidate>
                <label className={styles.requestLabel} htmlFor="beta-email">
                  Email address
                </label>
                <div className={styles.requestControls}>
                  <input
                    className={styles.requestInput}
                    id="beta-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    value={email}
                    placeholder="family@example.com"
                    aria-invalid={validationError ? true : undefined}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <button className={styles.requestButton} type="submit" disabled={!email.trim()}>
                    Request access
                  </button>
                </div>
                <span className={styles.formHint}>
                  We keep requests only for private-beta review and manually remove unapproved
                  requests older than 90 days.
                </span>
                {validationError ? (
                  <span className={`${styles.formMessage} ${styles.formError}`} role="alert">
                    {validationError}
                  </span>
                ) : null}
                {status === 'success' ? (
                  <span className={`${styles.formMessage} ${styles.formSuccess}`} role="status">
                    {PRIVATE_BETA_REQUEST_SUCCESS}
                  </span>
                ) : null}
                {status === 'error' ? (
                  <span className={`${styles.formMessage} ${styles.formError}`} role="alert">
                    {PRIVATE_BETA_REQUEST_ERROR}
                  </span>
                ) : null}
              </form>
            </div>
          </div>

          <p className={styles.convergenceFootnote}>
            ⌁ private by design &nbsp; · &nbsp; family-scale by default
          </p>
          <footer className={styles.footer}>
            <span>FinManager · a calmer money picture</span>
            <nav aria-label="Footer">
              <a href="#values">Values</a>
              <a href="#how-it-works">How it works</a>
              <Link href={dashboardLink}>{dashboardLabel}</Link>
              <Link href="/privacy">Privacy &amp; data</Link>
            </nav>
          </footer>
        </div>
      </section>
    </main>
  );
}
