import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useStatus } from '@powersync/react';

import { useInsights } from '../../lib/insights';
import { Card, CardLabel, CardTitle } from '../card';
import { useAuth } from '../providers';
import { InsightAction } from './chat-message';

/** Local preference: skip the rerun cost-confirmation once the user opts out. */
const SKIP_REFRESH_CONFIRM_KEY = 'finmanager.insights.skipRefreshConfirm';

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
  const [confirming, setConfirming] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const skipConfirm = useRef(false);
  const content = streaming || api.latestSummary?.content;
  // A "rerun" is a refresh over an already-saved summary; the very first
  // generation has nothing to re-spend and does not need the cost warning.
  const isRerun = Boolean(api.latestSummary);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(SKIP_REFRESH_CONFIRM_KEY).then((value) => {
      if (active) skipConfirm.current = value === '1';
    });
    return () => {
      active = false;
    };
  }, []);

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
    if (isRerun && !skipConfirm.current) {
      setDontAskAgain(false);
      setConfirming(true);
      return;
    }
    void generate();
  }

  function confirmGenerate() {
    if (dontAskAgain) {
      skipConfirm.current = true;
      void AsyncStorage.setItem(SKIP_REFRESH_CONFIRM_KEY, '1');
    }
    setConfirming(false);
    void generate();
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
          disabled={!api.canChat || generating || api.loading || confirming}
          onPress={requestGenerate}
        />
      </View>
      {confirming ? (
        <View className="mb-3 rounded-md border-l-4 border-primary bg-surface-muted p-3">
          <Text className="font-body text-body-md text-foreground">
            Refreshing re-runs the AI analysis and uses your monthly AI allowance, which has a cost.
            Only refresh if your finances changed meaningfully this month.
          </Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: dontAskAgain }}
            onPress={() => setDontAskAgain((current) => !current)}
            className="mt-3 flex-row items-center gap-2"
          >
            <View
              className={`h-5 w-5 items-center justify-center rounded border ${
                dontAskAgain ? 'border-primary bg-primary' : 'border-border bg-surface'
              }`}
            >
              {dontAskAgain ? (
                <Text className="text-caption text-primary-foreground">✓</Text>
              ) : null}
            </View>
            <Text className="font-body text-caption text-foreground-muted">
              Don&rsquo;t show this again
            </Text>
          </Pressable>
          <View className="mt-3 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              onPress={confirmGenerate}
              className="rounded-md bg-primary px-3 py-2"
            >
              <Text className="text-primary-foreground">Refresh anyway</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirming(false)}
              className="rounded-md bg-surface-muted px-3 py-2"
            >
              <Text className="text-foreground">Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
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
