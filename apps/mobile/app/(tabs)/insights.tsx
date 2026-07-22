import type { ChatMessage, InsightScope } from '@finmanager/schema';
import { color } from '@finmanager/tokens';
import { useStatus } from '@powersync/react';
import { useColorScheme } from 'nativewind';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, CardLabel, CardTitle } from '../../components/card';
import { Choice } from '../../components/choice';
import {
  ChatMessageBubble,
  InsightAction,
  PromptChip,
} from '../../components/insights/chat-message';
import { MobileWorkspaceSkeleton, useInitialSkeleton } from '../../components/motion';
import { useAuth } from '../../components/providers';
import { useInsights } from '../../lib/insights';

const scopes: readonly { value: InsightScope; label: string }[] = [
  { value: 'everything', label: 'Everything' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'budget', label: 'Budget' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'goals', label: 'Goals' },
  { value: 'tax', label: 'Tax' },
];

const prompts: Readonly<Record<InsightScope, readonly string[]>> = {
  everything: ['How is my overall financial health?', 'What should I focus on next?'],
  expenses: ['Where did I spend the most this month?', 'What changed in my spending?'],
  budget: ['How am I doing on my budget this month?', 'Which budget needs attention?'],
  portfolio: ['How is my portfolio performing?', 'Is my allocation concentrated?'],
  goals: ['Which goal is furthest off track?', 'How is my path to FIRE looking?'],
  tax: ['Which tax regime currently looks better?', 'Summarise my tax position.'],
};

interface DisplayMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export default function InsightsScreen() {
  const status = useStatus();
  const { session, loading } = useAuth();
  if (loading || (session !== null && !status.hasSynced)) {
    return <MobileWorkspaceSkeleton label="Loading insights" />;
  }
  return <InsightsContent />;
}

function InsightsContent() {
  const { colorScheme } = useColorScheme();
  const scheme = color[colorScheme === 'dark' ? 'dark' : 'light'];
  const api = useInsights();
  const skeleton = useInitialSkeleton();
  const [scope, setScope] = useState<InsightScope>('everything');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const history = useMemo<ChatMessage[]>(
    () =>
      messages
        .filter((message) => message.content.trim())
        .map(({ role, content }) => ({ role, content })),
    [messages],
  );

  if (api.loading || skeleton) return <MobileWorkspaceSkeleton label="Loading insights" />;

  async function ask(value: string) {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    const assistantId = crypto.randomUUID();
    setQuestion('');
    setSending(true);
    setError(null);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: trimmed },
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    try {
      await api.sendMessage(trimmed, scope, history, (delta) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: message.content + delta } : message,
          ),
        );
      });
    } catch (caught) {
      const value = caught as Error & { code?: string };
      setMessages((current) => current.filter((message) => message.id !== assistantId));
      setError({ ...(value.code ? { code: value.code } : {}), message: value.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 p-4"
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text className="font-display text-headline-lg text-foreground">AI Insights</Text>
            <Text className="font-body text-body-md text-foreground-muted">
              Grounded answers from the financial data on this device.
            </Text>
          </View>

          {api.latestSummary ? (
            <Card>
              <CardLabel>Saved for offline</CardLabel>
              <CardTitle>Monthly financial health</CardTitle>
              <Text className="mt-3 font-body text-body-md text-foreground">
                {api.latestSummary.content}
              </Text>
              <Text className="mt-2 font-body text-caption text-foreground-muted">
                {new Date(api.latestSummary.generatedAt).toLocaleDateString('en-IN')}
              </Text>
            </Card>
          ) : null}

          {!api.canChat ? (
            <Card>
              <CardTitle>Chat is offline</CardTitle>
              <Text className="mt-2 font-body text-body-md text-foreground-muted">
                Connect to ask a question. Your saved monthly summary remains available.
              </Text>
            </Card>
          ) : null}

          {error ? (
            <Card>
              <CardTitle>
                {error.code === 'budget_exceeded' ? 'Monthly allowance used' : 'Could not answer'}
              </CardTitle>
              <Text className="mt-2 font-body text-body-md text-foreground-muted">
                {error.message}
              </Text>
            </Card>
          ) : null}

          <Card className="gap-4">
            <Choice label="Focus area" value={scope} options={scopes} onChange={setScope} />
            <View className="flex-row flex-wrap gap-2">
              {prompts[scope].map((prompt) => (
                <PromptChip
                  key={prompt}
                  label={prompt}
                  disabled={!api.canChat || sending}
                  onPress={() => void ask(prompt)}
                />
              ))}
            </View>
            <View className="min-h-56 gap-3" accessibilityLiveRegion="polite">
              {messages.length === 0 ? (
                <Text className="font-body text-body-md text-foreground-muted">
                  Chat is ephemeral and clears when this session ends.
                </Text>
              ) : (
                messages.map((message, index) => (
                  <ChatMessageBubble
                    key={message.id}
                    role={message.role}
                    content={message.content}
                    streaming={sending && index === messages.length - 1}
                  />
                ))
              )}
            </View>
          </Card>
        </ScrollView>

        <View className="flex-row gap-2 border-t border-border bg-surface p-4">
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask about your finances"
            placeholderTextColor={scheme.foregroundMuted}
            editable={api.canChat && !sending}
            onSubmitEditing={() => void ask(question)}
            className="min-h-11 flex-1 rounded-md border border-border bg-background px-3 font-body text-body-md text-foreground"
          />
          <InsightAction
            label={sending ? 'Answering…' : 'Send'}
            disabled={!api.canChat || sending || !question.trim()}
            onPress={() => void ask(question)}
          />
          {sending ? <InsightAction label="Stop" onPress={api.cancel} /> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
