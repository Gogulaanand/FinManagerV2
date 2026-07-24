import { describe, expect, it } from 'vitest';

import { IsoTimestamp, normalizeTimestamp } from './timestamps';

// PowerSync renders a Postgres `timestamptz` as `YYYY-MM-DD hh:mm:ss.sssZ`.
// Every row written by the deadman-check or ai-insights Edge Functions reaches
// the client in this form, so rejecting it would break those screens entirely.
const POWERSYNC_SHAPES = [
  '2026-07-24 06:00:52.618Z',
  '2026-07-24 06:00:52.618869+00',
  '2026-07-24 06:00:52+00',
  '2026-07-23 02:27:13.778779+00',
];

describe('IsoTimestamp', () => {
  it.each(POWERSYNC_SHAPES)('accepts the PowerSync rendering %s', (value) => {
    expect(IsoTimestamp.safeParse(value).success).toBe(true);
  });

  it('accepts a plain JavaScript ISO string unchanged', () => {
    const iso = new Date('2026-07-24T06:00:52.618Z').toISOString();
    expect(IsoTimestamp.parse(iso)).toBe(iso);
  });

  it('preserves the instant it describes', () => {
    const parsed = IsoTimestamp.parse('2026-07-24 06:00:52.618Z') as string;
    expect(new Date(parsed).getTime()).toBe(Date.parse('2026-07-24T06:00:52.618Z'));
  });

  it('still rejects values that are not timestamps', () => {
    for (const value of ['', 'yesterday', '2026-07-24', 42, null]) {
      expect(IsoTimestamp.safeParse(value).success).toBe(false);
    }
  });

  it('leaves an already-normal timestamp alone', () => {
    expect(normalizeTimestamp('2026-07-24T06:00:52.618Z')).toBe('2026-07-24T06:00:52.618Z');
  });
});
