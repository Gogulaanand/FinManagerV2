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

function FinancialHealthCardContent() {
  const api = useInsights();
  const [generating, setGenerating] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [error, setError] = useState<string | null>(null);
  const content = streaming || api.latestSummary?.content;

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
          disabled={!api.canChat || generating || api.loading}
          onClick={() => void generate()}
        >
          {generating ? 'Generating…' : content ? 'Refresh' : 'Generate'}
        </Button>
      </CardHeader>
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
