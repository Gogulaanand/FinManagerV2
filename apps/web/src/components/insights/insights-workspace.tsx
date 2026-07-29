'use client';

import type { ChatMessage, InsightScope } from '@finmanager/schema';
import { useStatus } from '@powersync/react';
import {
  BrainCircuit,
  BriefcaseBusiness,
  ChartPie,
  CircleDollarSign,
  Landmark,
  PiggyBank,
  ReceiptText,
  Send,
  Sparkles,
  Square,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import { useInitialSkeleton, WorkspaceSkeleton } from '@/components/motion/skeleton';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useInsights } from '@/lib/insights';

import { ChatMessageBubble } from './chat-message';

const scopeOptions: readonly { value: InsightScope; label: string; icon: LucideIcon }[] = [
  { value: 'everything', label: 'Everything', icon: Sparkles },
  { value: 'expenses', label: 'Expenses', icon: ReceiptText },
  { value: 'budget', label: 'Budget', icon: PiggyBank },
  { value: 'portfolio', label: 'Portfolio', icon: ChartPie },
  { value: 'goals', label: 'Goals', icon: CircleDollarSign },
  { value: 'tax', label: 'Tax', icon: Landmark },
];

const suggestedPrompts: Readonly<Record<InsightScope, readonly string[]>> = {
  everything: ['How is my overall financial health?', 'What should I focus on next?'],
  expenses: ['Where did I spend the most this month?', 'What changed in my recent spending?'],
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

export function InsightsWorkspace() {
  const status = useStatus();
  const { session, loading } = useAuth();
  if (loading || (session !== null && !status.hasSynced)) {
    return <WorkspaceSkeleton label="Loading insights" />;
  }
  return <InsightsWorkspaceContent />;
}

function InsightsWorkspaceContent() {
  const api = useInsights();
  const initialSkeleton = useInitialSkeleton();
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

  if (api.loading || initialSkeleton) return <WorkspaceSkeleton label="Loading insights" />;

  async function ask(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || sending) return;
    const assistantId = crypto.randomUUID();
    setQuestion('');
    setError(null);
    setSending(true);
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

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BrainCircuit aria-hidden="true" size={21} />
        </span>
        <div>
          <h1 className="font-display text-headline-lg text-foreground">AI Insights</h1>
          <p className="font-body text-body-md text-foreground-muted">
            A private financial assistant grounded in the data available on this device.
          </p>
        </div>
      </div>

      <div className="grid min-h-[38rem] gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4">
          {api.latestSummary ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <BriefcaseBusiness aria-hidden="true" size={18} />
                  </span>
                  <div>
                    <CardLabel>Saved for offline</CardLabel>
                    <CardTitle>Monthly health</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <p className="font-body text-body-md whitespace-pre-wrap text-foreground">
                {api.latestSummary.content}
              </p>
              <p className="mt-3 font-body text-caption text-foreground-muted">
                Generated {new Date(api.latestSummary.generatedAt).toLocaleDateString('en-IN')}
              </p>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardLabel>Monthly health</CardLabel>
              <p className="mt-2 font-body text-body-md text-foreground-muted">
                Your first saved monthly summary will remain readable offline.
              </p>
            </Card>
          )}

          <Card>
            <CardLabel id="insight-scope-label">Focus area</CardLabel>
            <div
              className="mt-3 grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-labelledby="insight-scope-label"
            >
              {scopeOptions.map((option) => {
                const Icon = option.icon;
                const selected = scope === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-left font-body text-label transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-foreground hover:bg-surface-muted'
                    }`}
                    onClick={() => setScope(option.value)}
                  >
                    <Icon aria-hidden="true" size={17} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardLabel>Suggested questions</CardLabel>
            <div className="mt-3 flex flex-col gap-2">
              {suggestedPrompts[scope].map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-auto justify-start py-2 text-left whitespace-normal"
                  disabled={!api.canChat || sending}
                  onClick={() => void ask(prompt)}
                >
                  <Sparkles aria-hidden="true" size={15} />
                  {prompt}
                </Button>
              ))}
            </div>
          </Card>
        </aside>

        <Card className="flex min-h-[38rem] flex-col gap-4 overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <CardTitle>Conversation</CardTitle>
              <CardLabel className="mt-1 block">
                Ephemeral chat · cleared when this session ends
              </CardLabel>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-body text-caption ${
                api.canChat ? 'bg-gain/10 text-gain' : 'bg-surface-muted text-foreground-muted'
              }`}
            >
              {api.canChat ? (
                <Sparkles aria-hidden="true" size={14} />
              ) : (
                <WifiOff aria-hidden="true" size={14} />
              )}
              {api.canChat ? 'Ready' : 'Offline'}
            </span>
          </div>

          {!api.canChat ? (
            <div
              role="status"
              className="mx-5 flex gap-3 rounded-md border border-border bg-surface-muted p-4"
            >
              <WifiOff
                className="mt-0.5 shrink-0 text-foreground-muted"
                aria-hidden="true"
                size={19}
              />
              <div>
                <p className="font-body text-label font-semibold text-foreground">
                  Chat is offline
                </p>
                <p className="mt-1 font-body text-body-md text-foreground-muted">
                  Connect to ask a question. Your saved monthly summary remains available.
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div
              role="status"
              aria-live="polite"
              className={`mx-5 rounded-md border-l-4 bg-surface-muted p-4 ${
                error.code === 'budget_exceeded' ? 'border-primary' : 'border-loss'
              }`}
            >
              <p
                className={`font-body text-label font-semibold ${
                  error.code === 'budget_exceeded' ? 'text-primary' : 'text-loss'
                }`}
              >
                {error.code === 'budget_exceeded' ? 'Monthly allowance used' : 'Could not answer'}
              </p>
              <p className="mt-1 font-body text-body-md text-foreground-muted">{error.message}</p>
            </div>
          ) : null}

          <div
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-2"
            aria-live="polite"
            aria-busy={sending}
          >
            {messages.length === 0 ? (
              <div className="m-auto max-w-md py-12 text-center">
                <span className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <BrainCircuit aria-hidden="true" size={23} />
                </span>
                <p className="font-display text-headline-sm text-foreground">
                  What would you like to understand?
                </p>
                <p className="mt-2 font-body text-body-md text-foreground-muted">
                  Choose a focus area and ask in your own words, or begin with a suggested question.
                </p>
              </div>
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
          </div>

          <form
            className="sticky bottom-0 flex gap-2 border-t border-border bg-surface px-5 py-4"
            onSubmit={submit}
          >
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={api.canChat ? 'Ask about your finances' : 'Connect to ask a question'}
              aria-label="Ask AI Insights"
              disabled={!api.canChat || sending}
            />
            <Button type="submit" disabled={!api.canChat || sending || !question.trim()}>
              <Send aria-hidden="true" size={16} />
              <span className="sr-only sm:not-sr-only">{sending ? 'Answering…' : 'Send'}</span>
            </Button>
            {sending ? (
              <Button type="button" variant="outline" onClick={api.cancel}>
                <Square aria-hidden="true" size={14} />
                Stop
              </Button>
            ) : null}
          </form>
        </Card>
      </div>
    </div>
  );
}
