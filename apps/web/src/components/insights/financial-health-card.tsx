'use client';

import { useState } from 'react';
import { useStatus } from '@powersync/react';

import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { useInsights } from '@/lib/insights';

export function FinancialHealthCard() {
  const status = useStatus();
  const { session, loading } = useAuth();
  if (loading || (session !== null && !status.hasSynced)) {
    return (
      <Card>
        <CardLabel>AI Insights</CardLabel>
        <p className="mt-2 font-body text-body-md text-foreground-muted">
          Loading your saved financial health summary…
        </p>
      </Card>
    );
  }
  return <FinancialHealthCardContent />;
}

/** Local preference: skip the rerun cost-confirmation once the user opts out. */
const SKIP_REFRESH_CONFIRM_KEY = 'finmanager.insights.skipRefreshConfirm';

function readSkipRefreshConfirm(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SKIP_REFRESH_CONFIRM_KEY) === '1';
}

function FinancialHealthCardContent() {
  const api = useInsights();
  const [generating, setGenerating] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const content = streaming || api.latestSummary?.content;
  // A "rerun" is a refresh over an already-saved summary; the very first
  // generation has nothing to re-spend and does not need the cost warning.
  const isRerun = Boolean(api.latestSummary);

  async function generate() {
    setGenerating(true);
    setStreaming('');
    setError(null);
    try {
      await api.generateMonthlySummary((delta) => setStreaming((current) => current + delta));
      setStreaming('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not generate the summary.');
    } finally {
      setGenerating(false);
    }
  }

  function requestGenerate() {
    if (isRerun && !readSkipRefreshConfirm()) {
      setDontAskAgain(false);
      setConfirming(true);
      return;
    }
    void generate();
  }

  function confirmGenerate() {
    if (dontAskAgain && typeof window !== 'undefined') {
      window.localStorage.setItem(SKIP_REFRESH_CONFIRM_KEY, '1');
    }
    setConfirming(false);
    void generate();
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardLabel>AI Insights</CardLabel>
          <CardTitle>Financial health</CardTitle>
        </div>
        <Button
          type="button"
          size="sm"
          variant={content ? 'outline' : 'primary'}
          disabled={!api.canChat || generating || api.loading || confirming}
          onClick={requestGenerate}
        >
          {generating ? 'Generating…' : content ? 'Refresh' : 'Generate'}
        </Button>
        {generating ? (
          <Button type="button" size="sm" variant="outline" onClick={api.cancel}>
            Stop
          </Button>
        ) : null}
      </CardHeader>
      {confirming ? (
        <div className="mb-4 rounded-md border-l-4 border-primary bg-surface-muted p-3">
          <p className="font-body text-body-md text-foreground">
            Refreshing re-runs the AI analysis and uses your monthly AI allowance, which has a cost.
            Only refresh if your finances changed meaningfully this month.
          </p>
          <label className="mt-3 flex items-center gap-2 font-body text-caption text-foreground-muted">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(event) => setDontAskAgain(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Don&rsquo;t show this again
          </label>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" variant="primary" onClick={confirmGenerate}>
              Refresh anyway
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {content ? (
        <p className="font-body text-body-md whitespace-pre-wrap text-foreground">{content}</p>
      ) : (
        <p className="font-body text-body-md text-foreground-muted">
          Generate a grounded monthly summary. Once saved, it remains readable offline.
        </p>
      )}
      {api.latestSummary && !streaming ? (
        <p className="mt-2 font-body text-caption text-foreground-muted">
          Updated {new Date(api.latestSummary.generatedAt).toLocaleString('en-IN')}
        </p>
      ) : null}
      {!api.canChat && !content ? (
        <p className="mt-2 font-body text-caption text-foreground-muted">
          Connect to generate your first summary.
        </p>
      ) : null}
      {error ? <p className="mt-2 font-body text-caption text-loss">{error}</p> : null}
    </Card>
  );
}
