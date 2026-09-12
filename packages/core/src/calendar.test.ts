import { afterEach, describe, expect, it, vi } from 'vitest';

import { localDateIso } from './calendar.js';
import { monthNow } from './expenses/month.js';
import { todayIso } from './goals/time.js';

const originalTimezone = process.env.TZ;
afterEach(() => {
  vi.useRealTimers();
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

describe('local calendar defaults', () => {
  it('uses the new day and month before 05:30 IST', () => {
    process.env.TZ = 'Asia/Kolkata';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T19:30:00Z'));
    expect(localDateIso()).toBe('2026-09-01');
    expect(todayIso()).toBe('2026-09-01');
    expect(monthNow()).toBe('2026-09');
  });

  it('retains the previous local year west of UTC at New Year', () => {
    process.env.TZ = 'America/Los_Angeles';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-01T01:00:00Z'));
    expect(localDateIso()).toBe('2026-12-31');
    expect(monthNow()).toBe('2026-12');
  });

  it('pads leap-day calendar components', () => {
    expect(localDateIso(new Date(2028, 1, 29, 12))).toBe('2028-02-29');
  });
});
