export function ChatMessageBubble({
  role,
  content,
  streaming = false,
}: {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 font-body text-body-md whitespace-pre-wrap text-foreground ${
          role === 'user' ? 'bg-primary/15' : 'bg-surface-muted'
        }`}
      >
        {content || (streaming ? 'Thinking…' : '')}
      </div>
    </div>
  );
}
