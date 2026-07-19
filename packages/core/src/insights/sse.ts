export interface AnthropicSseParser {
  push(chunk: string): string[];
}

/** Incrementally extracts Anthropic `text_delta` payloads from SSE chunks. */
export function createAnthropicSseParser(): AnthropicSseParser {
  let pending = '';
  return {
    push(chunk: string): string[] {
      pending += chunk;
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      const deltas: string[] = [];
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6)) as {
            readonly type?: string;
            readonly delta?: { readonly type?: string; readonly text?: string };
          };
          if (
            event.type === 'content_block_delta' &&
            event.delta?.type === 'text_delta' &&
            typeof event.delta.text === 'string'
          ) {
            deltas.push(event.delta.text);
          }
        } catch {
          // A malformed or non-JSON frame is not assistant text.
        }
      }
      return deltas;
    },
  };
}
