import type { ChatMessage, InsightScope } from '@finmanager/schema';
import { color } from '@finmanager/tokens';
import { Ionicons } from '@expo/vector-icons';
import { useStatus } from '@powersync/react';
import { useColorScheme } from 'nativewind';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, CardLabel, CardTitle } from '../../components/card';
import {
  ChatMessageBubble,
  InsightAction,
  PromptChip,
} from '../../components/insights/chat-message';
import { MobileWorkspaceSkeleton, useInitialSkeleton } from '../../components/motion';
import { useAuth } from '../../components/providers';
import { useInsights } from '../../lib/insights';

const scopes: readonly {
  value: InsightScope;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'everything', label: 'Everything', icon: 'sparkles' },
  { value: 'expenses', label: 'Expenses', icon: 'receipt' },
  { value: 'budget', label: 'Budget', icon: 'wallet' },
  { value: 'portfolio', label: 'Portfolio', icon: 'pie-chart' },
  { value: 'goals', label: 'Goals', icon: 'flag' },
  { value: 'tax', label: 'Tax', icon: 'business' },
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
          <View className="flex-row items-start gap-3">
            <View className="mt-1 size-10 items-center justify-center rounded-full bg-primary/10">
              <Ionicons name="sparkles" size={21} color={scheme.primary} />
            </View>
            <View className="flex-1">
              <Text className="font-display text-headline-lg text-foreground">AI Insights</Text>
              <Text className="font-body text-body-md text-foreground-muted">
                A private assistant grounded in the financial data on this device.
              </Text>
            </View>
          </View>

          {api.latestSummary ? (
            <Card>
              <View className="flex-row items-center gap-3">
                <View className="size-9 items-center justify-center rounded-full bg-primary/10">
                  <Ionicons name="briefcase" size={18} color={scheme.primary} />
                </View>
                <View className="flex-1">
                  <CardLabel>Saved for offline</CardLabel>
                  <CardTitle>Monthly financial health</CardTitle>
                </View>
              </View>
              <Text className="mt-3 font-body text-body-md text-foreground">
                {api.latestSummary.content}
              </Text>
              <Text className="mt-2 font-body text-caption text-foreground-muted">
                {new Date(api.latestSummary.generatedAt).toLocaleDateString('en-IN')}
              </Text>
            </Card>
          ) : null}

          {!api.canChat ? (
            <Card className="flex-row gap-3">
              <Ionicons name="cloud-offline" size={21} color={scheme.foregroundMuted} />
              <View className="flex-1">
                <CardTitle>Chat is offline</CardTitle>
                <Text className="mt-1 font-body text-body-md text-foreground-muted">
                  Connect to ask a question. Your saved monthly summary remains available.
                </Text>
              </View>
            </Card>
          ) : null}

          {error ? (
            <Card>
              <View className="flex-row gap-3" accessibilityLiveRegion="polite">
                <Ionicons
                  name={error.code === 'budget_exceeded' ? 'information-circle' : 'warning'}
                  size={22}
                  color={error.code === 'budget_exceeded' ? scheme.primary : scheme.loss}
                />
                <View className="flex-1">
                  <CardTitle>
                    {error.code === 'budget_exceeded'
                      ? 'Monthly allowance used'
                      : 'Could not answer'}
                  </CardTitle>
                  <Text className="mt-1 font-body text-body-md text-foreground-muted">
                    {error.message}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          <Card className="gap-3">
            <CardLabel>Focus area</CardLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2"
            >
              {scopes.map((option) => {
                const selected = scope === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option.label} focus`}
                    onPress={() => setScope(option.value)}
                    className={`min-w-24 items-center gap-1 rounded-md border px-3 py-3 ${
                      selected ? 'border-primary bg-primary/10' : 'border-border bg-background'
                    }`}
                  >
                    <Ionicons
                      name={option.icon}
                      size={18}
                      color={selected ? scheme.primary : scheme.foregroundMuted}
                    />
                    <Text
                      className={`font-body text-label ${
                        selected ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Card>

          <Card className="gap-3">
            <View className="flex-row items-center gap-2">
              <Ionicons name="bulb" size={17} color={scheme.primary} />
              <CardLabel>Suggested questions</CardLabel>
            </View>
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
          </Card>

          <Card className="gap-4">
            <View className="flex-row items-center justify-between">
              <View>
                <CardTitle>Conversation</CardTitle>
                <CardLabel>Ephemeral · cleared after this session</CardLabel>
              </View>
              <View
                className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${
                  api.canChat ? 'bg-primary/10' : 'bg-surface-muted'
                }`}
              >
                <Ionicons
                  name={api.canChat ? 'sparkles' : 'cloud-offline'}
                  size={13}
                  color={api.canChat ? scheme.primary : scheme.foregroundMuted}
                />
                <Text
                  className={`font-body text-caption ${
                    api.canChat ? 'text-primary' : 'text-foreground-muted'
                  }`}
                >
                  {api.canChat ? 'Ready' : 'Offline'}
                </Text>
              </View>
            </View>
            <View className="min-h-56 gap-3" accessibilityLiveRegion="polite">
              {messages.length === 0 ? (
                <View className="items-center py-10">
                  <View className="mb-3 size-12 items-center justify-center rounded-full bg-primary/10">
                    <Ionicons name="chatbubbles" size={22} color={scheme.primary} />
                  </View>
                  <Text className="text-center font-display text-headline-sm text-foreground">
                    What would you like to understand?
                  </Text>
                  <Text className="mt-2 text-center font-body text-body-md text-foreground-muted">
                    Ask in your own words or begin with a suggested question.
                  </Text>
                </View>
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
            placeholder={api.canChat ? 'Ask about your finances' : 'Connect to ask'}
            placeholderTextColor={scheme.foregroundMuted}
            editable={api.canChat && !sending}
            onSubmitEditing={() => void ask(question)}
            returnKeyType="send"
            accessibilityLabel="Ask AI Insights"
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
