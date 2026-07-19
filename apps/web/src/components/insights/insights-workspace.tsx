'use client';

import type { ChatMessage, InsightScope } from '@finmanager/schema';
import { useStatus } from '@powersync/react';
import { useMemo, useState, type FormEvent } from 'react';

import { useInitialSkeleton, WorkspaceSkeleton } from '@/components/motion/skeleton';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardLabel, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useInsights } from '@/lib/insights';

import { ChatMessageBubble } from './chat-message';

const scopeOptions: readonly { value: InsightScope; label: string }[] = [
  { value: 'everything', label: 'Everything' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'budget', label: 'Budget' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'goals', label: 'Goals' },
  { value: 'tax', label: 'Tax' },
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
      <div>
        <h1 className="font-display text-headline-lg text-foreground">AI Insights</h1>
        <p className="font-body text-body-md text-foreground-muted">
          Grounded answers from the financial data currently visible on this device.
        </p>
      </div>

      {api.latestSummary ? (
        <Card>
          <CardHeader>
            <div>
              <CardLabel>Saved for offline</CardLabel>
              <CardTitle>Monthly financial health</CardTitle>
            </div>
            <span className="font-body text-caption text-foreground-muted">
              {new Date(api.latestSummary.generatedAt).toLocaleDateString('en-IN')}
            </span>
          </CardHeader>
          <p className="font-body text-body-md whitespace-pre-wrap text-foreground">
            {api.latestSummary.content}
          </p>
        </Card>
      ) : null}

      {!api.canChat ? (
        <Card>
          <CardTitle>Chat is offline</CardTitle>
          <p className="mt-2 font-body text-body-md text-foreground-muted">
            Connect to the internet to ask a question. Your saved monthly summary remains available.
          </p>
        </Card>
      ) : null}

      {error ? (
        <Card
          role="status"
          aria-live="polite"
          className={`border-l-4 bg-surface-muted ${
            error.code === 'budget_exceeded' ? 'border-primary' : 'border-loss'
          }`}
        >
          <CardTitle
            className={`flex items-center gap-2 ${
              error.code === 'budget_exceeded' ? 'text-primary' : 'text-loss'
            }`}
          >
            <span aria-hidden="true">{error.code === 'budget_exceeded' ? 'ⓘ' : '⚠'}</span>
            {error.code === 'budget_exceeded' ? 'Monthly allowance used' : 'Could not answer'}
          </CardTitle>
          <p className="mt-2 font-body text-body-md text-foreground-muted">{error.message}</p>
        </Card>
      ) : null}

      <Card className="flex min-h-[28rem] flex-col gap-4">
        <Field label="Focus area">
          {(id) => <Select id={id} value={scope} options={scopeOptions} onChange={setScope} />}
        </Field>

        <div className="flex flex-wrap gap-2">
          {suggestedPrompts[scope].map((prompt) => (
            <Button
              key={prompt}
              type="button"
              size="sm"
              variant="outline"
              disabled={!api.canChat || sending}
              onClick={() => void ask(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto" aria-live="polite">
          {messages.length === 0 ? (
            <p className="font-body text-body-md text-foreground-muted">
              Choose a focus area or start with a suggested question. Chat stays on this device and
              is cleared when the session ends.
            </p>
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

        <form className="sticky bottom-0 flex gap-2 bg-surface pt-2" onSubmit={submit}>
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about your finances"
            aria-label="Ask AI Insights"
            disabled={!api.canChat || sending}
          />
          <Button type="submit" disabled={!api.canChat || sending || !question.trim()}>
            {sending ? 'Answering…' : 'Send'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
