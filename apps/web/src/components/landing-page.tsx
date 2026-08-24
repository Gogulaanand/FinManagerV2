'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useAuth } from '@/components/providers';
import {
  PRIVATE_BETA_REQUEST_ERROR,
  PRIVATE_BETA_REQUEST_SUCCESS,
  submitBetaAccessRequest,
} from '@/lib/beta-access';
import { supabase } from '@/lib/supabase';

import { FlowDiagram } from './landing/flow-diagram';
import styles from './landing/landing-page.module.css';

type RequestStatus = 'idle' | 'success' | 'error';

export function LandingPage() {
  const { loading: authLoading, session } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const dashboardLink = !authLoading && session ? '/dashboard' : '/login';
  const dashboardLabel = !authLoading && session ? 'Open dashboard' : 'Sign In / Request';

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
      <nav className={styles.landingNav} aria-label="Primary">
        <div className={styles.navInner}>
          <div className={styles.navIdentity}>
            <Link className={styles.navBrand} href="/">
              FinManager
            </Link>
            <div className={styles.navCoordinates} aria-label="Reference coordinates">
              <span>LAT 40.7128° N</span>
              <span>LON 74.0060° W</span>
            </div>
          </div>
          <div className={styles.navActions}>
            <Link className={styles.navDashboard} href={dashboardLink}>
              {dashboardLabel}
            </Link>
          </div>
        </div>
      </nav>

      <section className={styles.flowSection} aria-labelledby="braided-horizons-title">
        <span className={`${styles.editorialMark} ${styles.editorialMarkLeft}`} aria-hidden="true">
          flow.inception.01
        </span>
        <span className={`${styles.editorialMark} ${styles.editorialMarkRight}`} aria-hidden="true">
          distribution.zone
        </span>
        <span className={`${styles.editorialMark} ${styles.editorialMarkMetrics}`} aria-hidden="true">
          velocity.metrics
        </span>
        <div className={styles.flowInner}>
          <header className={styles.flowHeader}>
            <h1 id="braided-horizons-title" className={styles.heroTitle}>
              Braided Horizons
            </h1>
            <p className={styles.heroSubtitle}>
              Watch the currents of your household wealth weave together into a single destination.
            </p>
          </header>

          <FlowDiagram />
          <p className={styles.flowVerification} aria-hidden="true">
            ⌁ OFFLINE-FIRST ARCHITECTURE VERIFIED
          </p>
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
            <div className={styles.horizonValues}>
              <p className={styles.horizonValue}>
                <span>horizon target</span>
                FIRE 2035
              </p>
              <p className={styles.horizonValue}>
                <span>ELEVATION_TOTAL (ELV: 18.42L)</span>
                ₹18,42,600
              </p>
            </div>

            <div className={styles.requestCard}>
              <p className={styles.convergenceEyebrow}>beta_access_portal</p>
              <h2 id="request-access-title">Join the private flow</h2>
              <p>Manual review flow. We onboard families slowly to ensure absolute privacy.</p>

              <form className={styles.requestForm} onSubmit={handleSubmit} noValidate>
                <label className={styles.srOnly} htmlFor="beta-email">
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
                  Requests are kept only for private-beta review and manually removed after 90 days.
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
            ⌁ private by design &nbsp; · &nbsp; ⌁ family-scale
          </p>
          <footer className={styles.footer}>
            <span>FinManager © 2024</span>
            <nav aria-label="Footer">
              <a href="#request-access">Manual review flow</a>
              <Link href="/privacy">Privacy policy</Link>
              <Link href="/privacy#at-a-glance">Data terms</Link>
            </nav>
          </footer>
        </div>
      </section>
    </main>
  );
}
