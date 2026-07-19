import { describe, expect, it } from 'vitest';

import { createAnthropicSseParser } from './sse.js';

describe('createAnthropicSseParser', () => {
  it('extracts text deltas split across network chunks', () => {
    const parser = createAnthropicSseParser();
    expect(
      parser.push(
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type"',
      ),
    ).toEqual([]);
    expect(
      parser.push(
        ':"text_delta","text":"Budget "}}\n\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"looks healthy."}}\n\n',
      ),
    ).toEqual(['Budget ', 'looks healthy.']);
  });

  it('ignores non-text events and malformed frames', () => {
    const parser = createAnthropicSseParser();
    expect(parser.push('data: {"type":"message_start"}\n\ndata: nope\n\n')).toEqual([]);
  });
});
