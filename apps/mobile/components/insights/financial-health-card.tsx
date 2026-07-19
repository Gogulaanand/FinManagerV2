import { useState } from 'react';
import { Text, View } from 'react-native';
import { useStatus } from '@powersync/react';

import { useInsights } from '../../lib/insights';
import { Card, CardLabel, CardTitle } from '../card';
import { useAuth } from '../providers';
import { InsightAction } from './chat-message';

export function FinancialHealthCard() {
  const status = useStatus();
  const { session, loading } = useAuth();
  if (loading || (session !== null && !status.hasSynced)) {
    return (
      <Card>
        <CardLabel>AI Insights</CardLabel>
        <Text className="mt-2 font-body text-body-md text-foreground-muted">
          Loading your saved financial health summary…
        </Text>
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
      <View className="mb-3 flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <CardLabel>AI Insights</CardLabel>
          <CardTitle>Financial health</CardTitle>
        </View>
        <InsightAction
          label={generating ? 'Generating…' : content ? 'Refresh' : 'Generate'}
          disabled={!api.canChat || generating || api.loading}
          onPress={() => void generate()}
        />
      </View>
      <Text
        className={`font-body text-body-md ${content ? 'text-foreground' : 'text-foreground-muted'}`}
      >
        {content ?? 'Generate a grounded monthly summary that remains readable offline.'}
      </Text>
      {api.latestSummary && !streaming ? (
        <Text className="mt-2 font-body text-caption text-foreground-muted">
          Updated {new Date(api.latestSummary.generatedAt).toLocaleString('en-IN')}
        </Text>
      ) : null}
      {!api.canChat && !content ? (
        <Text className="mt-2 font-body text-caption text-foreground-muted">
          Connect to generate your first summary.
        </Text>
      ) : null}
      {error ? <Text className="mt-2 font-body text-caption text-loss">{error}</Text> : null}
    </Card>
  );
}
